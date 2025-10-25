"""
PDF job service for managing asynchronous PDF generation.

Handles job creation, status tracking, file storage, and cleanup.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import hashlib
import json
import logging
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from ..db.models import PDFJob
from ..config import settings

logger = logging.getLogger(__name__)


class PDFJobServiceError(Exception):
    """Raised when PDF job operations fail."""
    pass


class PDFJobNotFoundError(PDFJobServiceError):
    """Raised when a job cannot be found."""
    pass


class PDFJobService:
    """
    Service for managing PDF generation jobs.

    Responsibilities:
    - Create and track job records in database
    - Store generated PDF files to disk
    - Query job status and history
    - Clean up old jobs and files
    """

    def __init__(self, db: Session):
        """
        Initialize PDF job service.

        Args:
            db: SQLAlchemy database session
        """
        self.db = db
        self.jobs_dir = settings.JOBS_DIR
        self.jobs_dir.mkdir(parents=True, exist_ok=True)

    def create_job(
        self,
        owner_id: str,
        project_id: Optional[str] = None
    ) -> PDFJob:
        """
        Create a new PDF generation job.

        Args:
            owner_id: User ID who owns this job
            project_id: Optional project ID this job is for

        Returns:
            Created PDFJob record

        Raises:
            PDFJobServiceError: If job creation fails
        """
        try:
            # Generate unique job ID
            timestamp = datetime.now(timezone.utc).isoformat()
            content = f"{owner_id}:{project_id}:{timestamp}"
            job_id = hashlib.md5(content.encode()).hexdigest()

            job = PDFJob(
                id=job_id,
                owner_id=owner_id,
                project_id=project_id,
                status="pending",
                created_at=datetime.now(timezone.utc)
            )

            self.db.add(job)
            self.db.commit()
            self.db.refresh(job)

            logger.info(f"Created PDF job {job_id} for user {owner_id}")
            return job

        except Exception as e:
            self.db.rollback()
            raise PDFJobServiceError(f"Failed to create job: {e}") from e

    def get_job(self, job_id: str, owner_id: Optional[str] = None) -> PDFJob:
        """
        Get a job by ID.

        Args:
            job_id: Job ID to retrieve
            owner_id: If provided, verify job belongs to this user

        Returns:
            PDFJob record

        Raises:
            PDFJobNotFoundError: If job doesn't exist or doesn't belong to user
        """
        query = select(PDFJob).where(PDFJob.id == job_id)

        if owner_id:
            query = query.where(PDFJob.owner_id == owner_id)

        job = self.db.execute(query).scalar_one_or_none()

        if not job:
            if owner_id:
                raise PDFJobNotFoundError(f"Job {job_id} not found for user {owner_id}")
            else:
                raise PDFJobNotFoundError(f"Job {job_id} not found")

        return job

    def list_jobs(
        self,
        owner_id: str,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[PDFJob]:
        """
        List jobs for a user.

        Args:
            owner_id: User ID to filter by
            status: Optional status filter
            limit: Maximum number of jobs to return
            offset: Number of jobs to skip

        Returns:
            List of PDFJob records, newest first
        """
        query = select(PDFJob).where(PDFJob.owner_id == owner_id)

        if status:
            query = query.where(PDFJob.status == status)

        query = query.order_by(PDFJob.created_at.desc()).limit(limit).offset(offset)

        jobs = self.db.execute(query).scalars().all()
        return list(jobs)

    def update_job_status(
        self,
        job_id: str,
        status: str,
        error_message: Optional[str] = None,
        diagnostics: Optional[Dict[str, Any]] = None
    ) -> PDFJob:
        """
        Update job status.

        Args:
            job_id: Job ID to update
            status: New status (pending, processing, completed, failed, cancelled)
            error_message: Optional error message if failed

        Returns:
            Updated PDFJob record

        Raises:
            PDFJobNotFoundError: If job doesn't exist
        """
        job = self.get_job(job_id)

        job.status = status

        if status == "processing" and not job.started_at:
            job.started_at = datetime.now(timezone.utc)

        if status in ["completed", "failed", "cancelled"]:
            job.completed_at = datetime.now(timezone.utc)

        if error_message:
            job.error_message = error_message

        if diagnostics is not None:
            job.diagnostics = self._serialize_diagnostics(diagnostics)

        self.db.commit()
        self.db.refresh(job)

        logger.info(f"Job {job_id} status updated to {status}")
        return job

    def save_pdf_output(
        self,
        job_id: str,
        pdf_bytes: bytes,
        page_count: int,
        diagnostics: Optional[Dict[str, Any]] = None
    ) -> Path:
        """
        Save generated PDF to disk and update job record.
        Also copies PDF to project directory if project_id is set.

        Args:
            job_id: Job ID
            pdf_bytes: PDF file content
            page_count: Number of pages in PDF
            diagnostics: Optional diagnostics data

        Returns:
            Path to saved PDF file

        Raises:
            PDFJobServiceError: If save fails
        """
        try:
            job = self.get_job(job_id)

            # Save PDF to jobs directory
            output_path = self.jobs_dir / f"{job_id}.pdf"
            output_path.write_bytes(pdf_bytes)

            # If this job is associated with a project, move PDF to project directory for preview
            # Following CLAUDE.md Rule #3: Explicit behavior - project PDFs are permanent, not temporary job files
            moved_to_project = False
            if job.project_id:
                try:
                    from ..workspaces import get_workspace_manager
                    workspace = get_workspace_manager()
                    project_service = workspace.get_project_service(job.owner_id)
                    project_dir = project_service._get_project_dir(job.project_id)

                    # Ensure compiled directory exists
                    compiled_dir = project_dir / "compiled"
                    compiled_dir.mkdir(parents=True, exist_ok=True)

                    # Move PDF to project directory at the expected location
                    project_pdf_path = compiled_dir / "latest.pdf"
                    shutil.move(str(output_path), str(project_pdf_path))

                    # Verify the source file was removed by move operation
                    if output_path.exists():
                        # If move didn't remove source (e.g., cross-device), remove it explicitly
                        output_path.unlink()
                        logger.debug(f"Removed source PDF file from jobs directory after move")

                    moved_to_project = True
                    logger.info(f"Moved PDF for job {job_id} to permanent project storage at {project_pdf_path}")
                except Exception as e:
                    # Non-fatal - job still succeeds even if move fails
                    logger.warning(f"Failed to move PDF to project directory: {e}")
                    # output_path remains at jobs directory if move fails

            # Update job record
            # Following CLAUDE.md Rule #3: Don't track project PDFs in output_path to prevent cleanup deletion
            # Project PDFs are permanent storage managed by ProjectService, not temporary job files
            if moved_to_project:
                job.output_path = None  # Clear path - PDF now owned by project, not job cleanup
            else:
                job.output_path = str(output_path)  # Keep path for temporary jobs directory cleanup
            job.size_bytes = len(pdf_bytes)
            job.page_count = page_count
            job.status = "completed"
            job.completed_at = datetime.now(timezone.utc)

            if diagnostics is not None:
                job.diagnostics = self._serialize_diagnostics(diagnostics)

            self.db.commit()
            self.db.refresh(job)

            logger.info(f"Saved PDF for job {job_id}: {len(pdf_bytes)} bytes, {page_count} pages")
            return output_path

        except Exception as e:
            raise PDFJobServiceError(f"Failed to save PDF output: {e}") from e

    def get_pdf_file(self, job_id: str, owner_id: str) -> Path:
        """
        Get path to PDF file for a completed job.

        Args:
            job_id: Job ID
            owner_id: Owner user ID (for access control)

        Returns:
            Path to PDF file

        Raises:
            PDFJobNotFoundError: If job doesn't exist or not owned by user
            PDFJobServiceError: If job not completed or file missing
        """
        job = self.get_job(job_id, owner_id)

        if job.status != "completed":
            raise PDFJobServiceError(f"Job {job_id} is not completed (status: {job.status})")

        if not job.output_path:
            raise PDFJobServiceError(f"Job {job_id} has no output path")

        output_path = Path(job.output_path)

        if not output_path.exists():
            raise PDFJobServiceError(f"PDF file not found: {output_path}")

        return output_path

    def cancel_job(self, job_id: str, owner_id: str) -> PDFJob:
        """
        Cancel a pending or processing job.

        Args:
            job_id: Job ID to cancel
            owner_id: Owner user ID (for access control)

        Returns:
            Updated PDFJob record

        Raises:
            PDFJobNotFoundError: If job doesn't exist
            PDFJobServiceError: If job cannot be cancelled
        """
        job = self.get_job(job_id, owner_id)

        if job.status in ["completed", "failed", "cancelled"]:
            raise PDFJobServiceError(f"Cannot cancel job with status {job.status}")

        job.status = "cancelled"
        job.completed_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(job)

        logger.info(f"Cancelled job {job_id}")
        return job

    def cleanup_old_jobs(self, retention_hours: Optional[int] = None) -> int:
        """
        Clean up old completed jobs and their files.

        Args:
            retention_hours: How many hours to keep jobs (defaults to settings.JOB_RETENTION_HOURS)

        Returns:
            Number of jobs cleaned up
        """
        if retention_hours is None:
            retention_hours = settings.JOB_RETENTION_HOURS

        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=retention_hours)

        # Find old jobs
        query = select(PDFJob).where(
            and_(
                PDFJob.completed_at.isnot(None),
                PDFJob.completed_at < cutoff_time
            )
        )

        old_jobs = self.db.execute(query).scalars().all()

        cleaned_count = 0
        for job in old_jobs:
            try:
                # Delete PDF file if exists
                if job.output_path:
                    output_path = Path(job.output_path)
                    if output_path.exists():
                        output_path.unlink()
                        logger.debug(f"Deleted PDF file for job {job.id}")

                # Delete job record
                self.db.delete(job)
                cleaned_count += 1

            except Exception as e:
                logger.error(f"Failed to clean up job {job.id}: {e}")
                continue

        if cleaned_count > 0:
            self.db.commit()
            logger.info(f"Cleaned up {cleaned_count} old jobs")

        return cleaned_count

    def _serialize_diagnostics(self, diagnostics: Dict[str, Any]) -> str:
        try:
            return json.dumps(diagnostics, default=str)
        except (TypeError, ValueError):
            logger.warning("Failed to serialize diagnostics payload for pdf job")
            return json.dumps({"serialization_error": True})
