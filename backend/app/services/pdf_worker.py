"""
Async PDF generation worker with resource limits.

Handles background PDF generation jobs with proper resource constraints,
timeout enforcement, and error handling.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import logging
import multiprocessing
import signal
from datetime import datetime, timezone
from pathlib import Path
from queue import Empty
from typing import Any, Dict, Optional

from ..config import settings
from ..db import get_db_context
from .pdf_job_service import PDFJobService

logger = logging.getLogger(__name__)


class PDFWorkerError(Exception):
    """Raised when PDF worker operations fail."""
    pass


class TimeoutError(PDFWorkerError):
    """Raised when PDF generation times out."""
    pass


def _generate_pdf_subprocess(
    job_id: str,
    owner_id: str,
    project_id: Optional[str],
    yaml_content: Optional[str],
    profile: Optional[str],
    deterministic: bool,
    strict_mode: bool,
    timeout_seconds: int,
    result_queue: multiprocessing.Queue
) -> None:
    """Run compilation and PDF rendering in a separate process."""

    # Import here to avoid circular import issues
    import sys
    import yaml

    sys.path.insert(0, str(Path(__file__).parent.parent.parent))

    from app.core_services import PDFService, EinkPDFServiceError
    from app.utils import convert_enums_for_serialization
    from app.workspaces import get_workspace_manager
    from einkpdf.core.profiles import DeviceProfileError, load_device_profile
    from einkpdf.services.compilation_service import CompilationService, CompilationServiceError

    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    diagnostics: Dict[str, Dict[str, Any]] = {
        "compile": {
            "started_at": None,
            "completed_at": None,
            "error": None,
            "stats": None,
            "warnings": [],
        },
        "render": {
            "started_at": None,
            "completed_at": None,
            "error": None,
            "warnings": [],
            "page_count": None,
            "size_bytes": None,
        },
    }

    def _timeout_handler(signum, frame):  # noqa: ANN001
        raise TimeoutError(f"PDF generation exceeded {timeout_seconds}s timeout")

    signal.signal(signal.SIGALRM, _timeout_handler)
    signal.alarm(timeout_seconds)

    try:
        template_yaml = yaml_content
        profile_name = profile

        if template_yaml is None:
            diagnostics["compile"]["started_at"] = _now_iso()

            if not project_id:
                raise RuntimeError("PDF job missing project_id")

            workspace = get_workspace_manager()
            service = workspace.get_project_service(owner_id)
            project = service.get_project(project_id)
            if project is None:
                raise RuntimeError("Project not found for PDF job")

            device_profile_payload = None
            try:
                profile_obj = load_device_profile(project.metadata.device_profile)
                device_profile_payload = profile_obj.model_dump()
            except DeviceProfileError as exc:
                logger.warning(
                    "Failed to load device profile '%s' for project %s: %s",
                    project.metadata.device_profile,
                    project_id,
                    exc,
                )

            compilation_service = CompilationService()
            result = compilation_service.compile_project(project, device_profile_payload)
            diagnostics["compile"]["completed_at"] = _now_iso()
            diagnostics["compile"]["stats"] = result.compilation_stats

            template_yaml = yaml.safe_dump(
                convert_enums_for_serialization(result.template.model_dump()),
                sort_keys=False,
                allow_unicode=True,
            )
            profile_name = profile_name or project.metadata.device_profile
        else:
            diagnostics["compile"]["started_at"] = _now_iso()
            diagnostics["compile"]["completed_at"] = diagnostics["compile"]["started_at"]

        profile_name = profile_name or "Boox-Note-Air-4C"

        if not template_yaml:
            raise RuntimeError("No template YAML available for PDF job")

        diagnostics["render"]["started_at"] = _now_iso()
        pdf_service = PDFService()

        try:
            pdf_bytes, warnings = pdf_service.generate_pdf_with_warnings(
                yaml_content=template_yaml,
                profile=profile_name,
                deterministic=deterministic,
            )
            diagnostics["render"]["warnings"] = warnings or []

            if strict_mode:
                pdf_bytes = pdf_service.generate_pdf(
                    yaml_content=template_yaml,
                    profile=profile_name,
                    deterministic=deterministic,
                    strict_mode=True,
                )
        except EinkPDFServiceError as exc:
            diagnostics["render"]["error"] = str(exc)
            diagnostics["render"]["completed_at"] = _now_iso()
            result_queue.put({
                "success": False,
                "error": str(exc),
                "error_type": "render",
                "diagnostics": diagnostics,
            })
            return

        page_count = pdf_bytes.count(b"/Type /Page") or 1
        diagnostics["render"]["completed_at"] = _now_iso()
        diagnostics["render"]["page_count"] = page_count
        diagnostics["render"]["size_bytes"] = len(pdf_bytes)

        result_queue.put({
            "success": True,
            "pdf_bytes": pdf_bytes,
            "page_count": page_count,
            "diagnostics": diagnostics,
        })

    except TimeoutError as exc:
        diagnostics["render"]["error"] = str(exc)
        diagnostics["render"]["completed_at"] = _now_iso()
        logger.error("Job %s timed out: %s", job_id, exc)
        result_queue.put({
            "success": False,
            "error": str(exc),
            "error_type": "timeout",
            "diagnostics": diagnostics,
        })
    except CompilationServiceError as exc:
        diagnostics["compile"]["error"] = str(exc)
        diagnostics["compile"]["completed_at"] = _now_iso()
        logger.error("Job %s compilation failed: %s", job_id, exc)
        result_queue.put({
            "success": False,
            "error": str(exc),
            "error_type": "compile",
            "diagnostics": diagnostics,
        })
    except Exception as exc:  # noqa: BLE001
        if diagnostics["compile"]["started_at"] and not diagnostics["compile"]["completed_at"]:
            diagnostics["compile"]["error"] = str(exc)
            diagnostics["compile"]["completed_at"] = _now_iso()
        else:
            diagnostics["render"]["error"] = str(exc)
            diagnostics["render"]["completed_at"] = _now_iso()
        logger.error("Job %s unexpected error: %s", job_id, exc, exc_info=True)
        result_queue.put({
            "success": False,
            "error": f"Unexpected error: {exc}",
            "error_type": "unknown",
            "diagnostics": diagnostics,
        })
    finally:
        try:
            signal.alarm(0)
        except Exception:  # noqa: BLE001
            pass


class PDFWorker:
    """Async PDF generation worker."""

    def __init__(self) -> None:
        self.max_timeout = settings.PDF_TIMEOUT_SECONDS
        self.max_pages = settings.MAX_PDF_PAGES
        self.max_size_mb = settings.MAX_PDF_SIZE_MB

    def process_job(
        self,
        job_id: str,
        owner_id: str,
        project_id: Optional[str] = None,
        yaml_content: Optional[str] = None,
        profile: str = "Boox-Note-Air-4C",
        deterministic: bool = False,
        strict_mode: bool = False,
    ) -> None:
        """Process a single PDF job in the background."""

        with get_db_context() as db:
            job_service = PDFJobService(db)

            try:
                job_service.update_job_status(job_id, "processing")
                logger.info("Starting PDF generation for job %s", job_id)

                result_queue = multiprocessing.Queue()
                process = multiprocessing.Process(
                    target=_generate_pdf_subprocess,
                    args=(
                        job_id,
                        owner_id,
                        project_id,
                        yaml_content,
                        profile,
                        deterministic,
                        strict_mode,
                        self.max_timeout,
                        result_queue,
                    ),
                )

                process.start()

                result = None
                try:
                    result = result_queue.get(timeout=self.max_timeout + 5)
                except Empty:
                    logger.error("Job %s did not return a result within timeout window", job_id)

                process.join(timeout=5)
                if process.is_alive():
                    logger.error("Job %s process did not terminate, killing it", job_id)
                    process.terminate()
                    process.join(timeout=5)
                    if process.is_alive():
                        process.kill()
                        process.join()

                result_queue.close()
                result_queue.join_thread()

                if result is None:
                    job_service.update_job_status(
                        job_id,
                        "failed",
                        error_message="No result returned from PDF generation process",
                        diagnostics=None,
                    )
                    return

                if result["success"]:
                    pdf_bytes = result["pdf_bytes"]
                    page_count = result["page_count"]

                    if page_count > self.max_pages:
                        job_service.update_job_status(
                            job_id,
                            "failed",
                            error_message=f"PDF has {page_count} pages, exceeds limit of {self.max_pages}",
                            diagnostics=result.get("diagnostics"),
                        )
                        return

                    size_mb = len(pdf_bytes) / (1024 * 1024)
                    if size_mb > self.max_size_mb:
                        job_service.update_job_status(
                            job_id,
                            "failed",
                            error_message=f"PDF is {size_mb:.1f}MB, exceeds limit of {self.max_size_mb}MB",
                            diagnostics=result.get("diagnostics"),
                        )
                        return

                    job_service.save_pdf_output(
                        job_id,
                        pdf_bytes,
                        page_count,
                        diagnostics=result.get("diagnostics"),
                    )
                    logger.info(
                        "Job %s completed successfully: %.2fMB, %d pages",
                        job_id,
                        size_mb,
                        page_count,
                    )
                else:
                    error = result.get("error", "Unknown error")
                    job_service.update_job_status(
                        job_id,
                        "failed",
                        error_message=error,
                        diagnostics=result.get("diagnostics"),
                    )
                    logger.error("Job %s failed: %s", job_id, error)

            except Exception as exc:  # noqa: BLE001
                logger.error("Job %s processing error: %s", job_id, exc, exc_info=True)
                try:
                    job_service.update_job_status(
                        job_id,
                        "failed",
                        error_message=f"Worker error: {exc}",
                    )
                except Exception as db_error:  # noqa: BLE001
                    logger.error("Failed to update job status for %s: %s", job_id, db_error)


_worker_instance: Optional[PDFWorker] = None


def get_pdf_worker() -> PDFWorker:
    """Get or create global PDF worker instance."""
    global _worker_instance
    if _worker_instance is None:
        _worker_instance = PDFWorker()
    return _worker_instance
