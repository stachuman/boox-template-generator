"""Project management API endpoints for multi-user workspaces."""

from __future__ import annotations

import logging
import os
import sys
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

# Ensure src is on path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from einkpdf.core.preview import PreviewError, generate_ground_truth_preview
from einkpdf.core.profiles import DeviceProfileError, load_device_profile
from einkpdf.core.project_schema import Project, ProjectListItem
from einkpdf.services.compilation_service import CompilationService, CompilationServiceError
from einkpdf.services.project_service import ProjectService, ProjectServiceError
from einkpdf.services.png_export_service import PNGExportService, PNGExportError

from ..db.dependencies import get_current_user
from ..db.models import User
from ..models import CloneProjectRequest, MakeProjectPublicRequest
from ..core_services import PDFService
from ..utils import convert_enums_for_serialization
from ..workspaces import (
    PublicProjectManager,
    PublicProjectNotFoundError,
    UserWorkspaceManager,
    WorkspaceError,
    get_public_project_manager,
    get_workspace_manager,
)

router = APIRouter(prefix="/projects", tags=["projects"])

logger = logging.getLogger(__name__)

workspace_manager: UserWorkspaceManager = get_workspace_manager()
public_project_manager: PublicProjectManager = get_public_project_manager()
compilation_service = CompilationService()
pdf_service = PDFService()
png_export_service = PNGExportService()


class CreateProjectRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field("", max_length=500)
    device_profile: str = Field("boox-note-air-4c")
    author: str = Field("", max_length=100)
    category: str = Field("planner", max_length=50)


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    device_profile: Optional[str] = None
    author: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, max_length=50)


class AddMasterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    template_yaml: str = Field(..., min_length=1)
    description: str = Field("", max_length=500)


class UpdateMasterRequest(BaseModel):
    template_yaml: Optional[str] = None
    new_name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None


class UpdatePlanRequest(BaseModel):
    plan_data: Dict[str, Any] = Field(..., description="Plan configuration data")


class CompileProjectResponse(BaseModel):
    template_yaml: str = Field(..., description="Compiled template YAML")
    compilation_stats: Dict[str, Any] = Field(..., description="Compilation statistics")
    warnings: List[str] = Field(default_factory=list, description="Constraint warnings from PDF rendering")


# Helper utilities

def _get_user_project_service(current_user: User) -> ProjectService:
    return workspace_manager.get_project_service(current_user.id)


def _get_project_or_404(service: ProjectService, project_id: str) -> Project:
    try:
        project = service.get_project(project_id)
    except ProjectServiceError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found")
    return project


def _project_dir(current_user: User, project_id: str) -> Path:
    return workspace_manager.get_project_directory(current_user.id, project_id)


def _clean_author(request_author: str, current_user: User) -> str:
    author = request_author.strip()
    return author or current_user.username


# Project CRUD endpoints


@router.post("", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(
    request: CreateProjectRequest,
    current_user: User = Depends(get_current_user),
) -> Project:
    service = _get_user_project_service(current_user)
    try:
        project = service.create_project(
            name=request.name,
            description=request.description,
            device_profile=request.device_profile,
            author=_clean_author(request.author, current_user),
            category=request.category,
        )
    except ProjectServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return project


@router.get("", response_model=List[ProjectListItem])
async def list_projects(current_user: User = Depends(get_current_user)) -> List[ProjectListItem]:
    service = _get_user_project_service(current_user)
    try:
        return service.list_projects()
    except ProjectServiceError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str, current_user: User = Depends(get_current_user)) -> Project:
    service = _get_user_project_service(current_user)
    return _get_project_or_404(service, project_id)


@router.patch("/{project_id}", response_model=Project)
async def update_project(
    project_id: str,
    request: UpdateProjectRequest,
    current_user: User = Depends(get_current_user),
) -> Project:
    service = _get_user_project_service(current_user)
    project = _get_project_or_404(service, project_id)
    update_fields: Dict[str, Any] = {
        key: value
        for key, value in request.model_dump(exclude_none=True).items()
    }
    if "author" in update_fields:
        update_fields["author"] = update_fields["author"].strip()
    try:
        updated = service.update_project_metadata(project_id, **update_fields)
    except ProjectServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return updated or project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, current_user: User = Depends(get_current_user)) -> Response:
    service = _get_user_project_service(current_user)
    project = _get_project_or_404(service, project_id)
    try:
        deleted = service.delete_project(project_id)
    except ProjectServiceError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found")
    project_path = _project_dir(current_user, project_id)
    shutil.rmtree(project_path, ignore_errors=True)
    if project.metadata.is_public:
        public_project_manager.revoke_publication(project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Master management endpoints


@router.post("/{project_id}/masters", response_model=Project)
async def add_master(
    project_id: str,
    request: AddMasterRequest,
    current_user: User = Depends(get_current_user),
) -> Project:
    service = _get_user_project_service(current_user)
    _get_project_or_404(service, project_id)
    try:
        project = service.add_master(
            project_id=project_id,
            name=request.name,
            template_yaml=request.template_yaml,
            description=request.description,
        )
    except ProjectServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found")
    return project


@router.patch("/{project_id}/masters/{master_name}", response_model=Project)
async def update_master(
    project_id: str,
    master_name: str,
    request: UpdateMasterRequest,
    current_user: User = Depends(get_current_user),
) -> Project:
    service = _get_user_project_service(current_user)
    _get_project_or_404(service, project_id)
    try:
        project = service.update_master(
            project_id=project_id,
            master_name=master_name,
            template_yaml=request.template_yaml,
            new_name=request.new_name,
            description=request.description,
        )
    except ProjectServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found")
    return project


@router.delete("/{project_id}/masters/{master_name}", response_model=Project)
async def remove_master(
    project_id: str,
    master_name: str,
    current_user: User = Depends(get_current_user),
) -> Project:
    service = _get_user_project_service(current_user)
    _get_project_or_404(service, project_id)
    try:
        project = service.remove_master(project_id, master_name)
    except ProjectServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Master '{master_name}' not found")
    return project


# Plan management


@router.put("/{project_id}/plan", response_model=Project)
async def update_plan(
    project_id: str,
    request: UpdatePlanRequest,
    current_user: User = Depends(get_current_user),
) -> Project:
    service = _get_user_project_service(current_user)
    _get_project_or_404(service, project_id)
    try:
        project = service.update_plan(project_id, request.plan_data)
    except ProjectServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found")
    return project


# Compilation and outputs


@router.post("/{project_id}/compile", response_model=CompileProjectResponse)
async def compile_project(project_id: str, current_user: User = Depends(get_current_user)) -> CompileProjectResponse:
    service = _get_user_project_service(current_user)
    project = _get_project_or_404(service, project_id)

    device_profile_payload: Optional[Dict[str, Any]] = None
    try:
        profile_obj = load_device_profile(project.metadata.device_profile)
        device_profile_payload = profile_obj.model_dump()
    except DeviceProfileError as exc:
        logger = logging.getLogger(__name__)
        logger.warning("Failed to load profile %s: %s", project.metadata.device_profile, exc)

    try:
        # Pass max_pages from settings to fail fast before compilation
        from ..config import settings
        result = compilation_service.compile_project(
            project,
            device_profile_payload,
            max_pages=settings.MAX_PDF_PAGES
        )
    except CompilationServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Unexpected compilation error for project %s: %s", project_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Compilation failed: {str(exc)}"
        ) from exc

    import yaml

    template_yaml = yaml.safe_dump(
        convert_enums_for_serialization(result.template.model_dump()),
        sort_keys=False,
        allow_unicode=True,
    )

    warnings: List[str] = []
    compiled_dir = _project_dir(current_user, project_id) / "compiled"
    compiled_dir.mkdir(parents=True, exist_ok=True)

    # Clean previous outputs
    for old in compiled_dir.glob("*"):
        try:
            if old.is_file() or old.is_symlink():
                old.unlink()
            else:
                shutil.rmtree(old)
        except OSError:
            continue

    (compiled_dir / "latest.yaml").write_text(template_yaml)

    try:
        pdf_bytes, warnings = pdf_service.generate_pdf_with_warnings(
            yaml_content=template_yaml,
            profile=project.metadata.device_profile,
            deterministic=True,
        )
        tmp_path = compiled_dir / "latest.pdf.tmp"
        with open(tmp_path, "wb") as handle:
            handle.write(pdf_bytes)
            try:
                handle.flush()
                os.fsync(handle.fileno())
            except OSError:
                pass
        os.replace(tmp_path, compiled_dir / "latest.pdf")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"PDF generation failed: {exc}") from exc

    # If project is public, sync all project files to public directory and update timestamp
    try:
        public_dir = public_project_manager._public_root / project_id  # noqa: SLF001
        if public_dir.exists():
            # Project is public - sync all project files (not just PDF)
            source_dir = _project_dir(current_user, project_id)

            # Sync compiled directory (PDF and YAML)
            public_compiled_dir = public_dir / "compiled"
            public_compiled_dir.mkdir(parents=True, exist_ok=True)
            if (compiled_dir / "latest.pdf").exists():
                shutil.copy2(compiled_dir / "latest.pdf", public_compiled_dir / "latest.pdf")
            if (compiled_dir / "latest.yaml").exists():
                shutil.copy2(compiled_dir / "latest.yaml", public_compiled_dir / "latest.yaml")

            # Sync masters directory
            masters_dir = source_dir / "masters"
            if masters_dir.exists():
                public_masters_dir = public_dir / "masters"
                if public_masters_dir.exists():
                    shutil.rmtree(public_masters_dir)
                shutil.copytree(masters_dir, public_masters_dir)

            # Sync plan.yaml
            plan_path = source_dir / "plan.yaml"
            if plan_path.exists():
                shutil.copy2(plan_path, public_dir / "plan.yaml")

            # Sync project.yaml
            project_yaml_path = source_dir / "project.yaml"
            if project_yaml_path.exists():
                shutil.copy2(project_yaml_path, public_dir / "project.yaml")

            # Update the public project's updated_at timestamp
            with public_project_manager._lock:  # noqa: SLF001
                entry = public_project_manager._index.get(project_id)  # noqa: SLF001
                if entry:
                    from datetime import timezone
                    entry.updated_at = datetime.now(timezone.utc).isoformat()
                    # Also update metadata in index to reflect any project changes
                    entry.metadata = project.metadata.model_dump()
                    public_project_manager._index[project_id] = entry  # noqa: SLF001
                    public_project_manager._save_index()  # noqa: SLF001
    except Exception as e:
        # Don't fail compilation if public sync fails - just log it
        logging.warning(f"Failed to sync project files to public directory: {e}")

    return CompileProjectResponse(
        template_yaml=template_yaml,
        compilation_stats=result.compilation_stats,
        warnings=warnings or [],
    )


def _read_compiled_pdf(project_id: str, current_user: User) -> Path:
    pdf_path = _project_dir(current_user, project_id) / "compiled" / "latest.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not available. Compile the project first.")
    return pdf_path


@router.get("/{project_id}/pdf")
async def get_project_pdf(
    project_id: str,
    inline: bool = False,
    current_user: User = Depends(get_current_user),
):
    service = _get_user_project_service(current_user)
    project = _get_project_or_404(service, project_id)
    pdf_path = _read_compiled_pdf(project_id, current_user)
    data = pdf_path.read_bytes()
    disposition = "inline" if inline else "attachment"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"{disposition}; filename={project.metadata.name or 'project'}.pdf",
            "Content-Length": str(len(data)),
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.head("/{project_id}/pdf")
async def head_project_pdf(project_id: str, current_user: User = Depends(get_current_user)) -> Response:
    _read_compiled_pdf(project_id, current_user)
    return Response(status_code=status.HTTP_200_OK)


@router.get("/{project_id}/preview")
async def get_project_preview(
    project_id: str,
    page: int = 1,
    scale: float = 2.0,
    current_user: User = Depends(get_current_user),
):
    service = _get_user_project_service(current_user)
    _get_project_or_404(service, project_id)
    pdf_path = _read_compiled_pdf(project_id, current_user)
    try:
        png_bytes = generate_ground_truth_preview(pdf_bytes=pdf_path.read_bytes(), page_number=page, scale=scale)
    except PreviewError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Preview failed: {exc}") from exc
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f"inline; filename=preview-page-{page}.png",
            "Content-Length": str(len(png_bytes)),
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


# Public sharing and cloning


@router.post("/{project_id}/share", response_model=Project)
async def set_project_visibility(
    project_id: str,
    request: MakeProjectPublicRequest,
    current_user: User = Depends(get_current_user),
) -> Project:
    service = _get_user_project_service(current_user)
    project = _get_project_or_404(service, project_id)
    try:
        if request.is_public:
            # First validate the publication (including slug validation) before updating metadata
            # This ensures we fail fast without partial state changes
            public_project_manager.publish_project(
                owner=current_user,
                project=project,
                source_dir=_project_dir(current_user, project_id),
                desired_slug=request.url_slug,
            )

            # Only update metadata after successful publication
            updates: Dict[str, Any] = {
                "is_public": True,
                "public_url_slug": request.url_slug,
                "original_author": project.metadata.original_author or current_user.username,
            }
            project = service.update_project_metadata(project_id, **updates) or project
            project = _get_project_or_404(service, project_id)
        else:
            service.update_project_metadata(project_id, is_public=False, public_url_slug=None)
            public_project_manager.revoke_publication(project_id)
            project = _get_project_or_404(service, project_id)
    except (ProjectServiceError, WorkspaceError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return project


@router.post("/public/{project_id}/clone", response_model=Project, status_code=status.HTTP_201_CREATED)
async def clone_public_project(
    project_id: str,
    request: CloneProjectRequest,
    current_user: User = Depends(get_current_user),
) -> Project:
    try:
        public_project, entry, public_dir = public_project_manager.get_public_project(project_id)
    except PublicProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    cloned_project = public_project_manager.clone_into_workspace(
        target_user=current_user,
        public_project=public_project,
        public_directory=public_dir,
        workspace=workspace_manager,
        new_name=request.new_name,
        new_description=request.new_description,
    )
    new_clone_count = public_project_manager.increment_clone_count(public_project.id)
    try:
        owner_service = workspace_manager.get_project_service(entry.owner_id)
        owner_service.update_project_metadata(public_project.id, clone_count=new_clone_count)
    except ProjectServiceError:
        pass
    return cloned_project

@router.post("/public/slug/{slug}/clone", response_model=Project, status_code=status.HTTP_201_CREATED)
async def clone_public_project_by_slug(
    slug: str,
    request: CloneProjectRequest,
    current_user: User = Depends(get_current_user),
) -> Project:
    try:
        public_project, entry, public_dir = public_project_manager.get_public_project_by_slug(slug)
    except PublicProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    cloned_project = public_project_manager.clone_into_workspace(
        target_user=current_user,
        public_project=public_project,
        public_directory=public_dir,
        workspace=workspace_manager,
        new_name=request.new_name,
        new_description=request.new_description,
    )
    new_clone_count = public_project_manager.increment_clone_count(public_project.id)
    try:
        owner_service = workspace_manager.get_project_service(entry.owner_id)
        owner_service.update_project_metadata(public_project.id, clone_count=new_clone_count)
    except ProjectServiceError:
        pass
    return cloned_project


class ExportMasterPNGRequest(BaseModel):
    """Request model for exporting master as PNG."""
    master_name: str = Field(..., description="Name of master to export")
    context: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional context for variable preview"
    )


@router.post("/{project_id}/export/master-png")
async def export_master_as_png(
    project_id: str,
    request: ExportMasterPNGRequest,
    current_user: User = Depends(get_current_user)
) -> Response:
    """
    Export a master template as PNG for e-ink device.

    This generates a static PNG image at the device's native resolution,
    suitable for use as a reusable template on e-ink devices like
    reMarkable, Supernote, or Boox.

    Flow:
    1. Load project and master
    2. Build single-page template from master
    3. Render to PDF (using existing renderer)
    4. Convert PDF to PNG at device resolution
    5. Return PNG bytes
    """
    logger.info(f"User {current_user.id} exporting master '{request.master_name}' as PNG from project {project_id}")

    # Get project
    try:
        service = workspace_manager.get_project_service(current_user.id)
        project = service.get_project(project_id)
    except WorkspaceError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Find master
    master = next(
        (m for m in project.masters if m.name == request.master_name),
        None
    )
    if not master:
        raise HTTPException(
            status_code=404,
            detail=f"Master '{request.master_name}' not found"
        )

    # Load device profile
    try:
        device_profile = load_device_profile(project.metadata.device_profile)
    except DeviceProfileError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid device profile: {e}"
        )

    # Build single-page template from master
    from einkpdf.core.schema import Template, TemplateMetadata, Canvas

    # Filter out navigation-related widgets (links) since PNG is static
    # Link widgets reference destinations that don't exist in isolation
    static_widgets = [
        w for w in master.widgets
        if w.type not in ('internal_link', 'tap_zone')
    ]

    logger.info(f"Filtered {len(master.widgets)} widgets to {len(static_widgets)} static widgets for PNG export")

    # Create a simple template with the master's static widgets
    template = Template(
        schema_version="1.0",
        metadata=TemplateMetadata(
            name=f"{request.master_name}_template",
            description=f"PNG template from {request.master_name}",
            category="template",
            version="1.0",
            author=current_user.username or "User",
            created=datetime.now().isoformat(),
            profile=project.metadata.device_profile
        ),
        canvas=Canvas(**project.default_canvas),
        widgets=static_widgets  # Use filtered static widgets only
    )

    # Render to PDF
    try:
        import yaml
        template_yaml = yaml.safe_dump(
            convert_enums_for_serialization(template.model_dump()),
            sort_keys=False,
            allow_unicode=True
        )
        pdf_bytes = pdf_service.generate_pdf(
            yaml_content=template_yaml,
            profile=project.metadata.device_profile
        )
    except Exception as e:
        logger.error(f"PDF rendering failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to render PDF: {e}"
        )

    # Convert PDF to PNG
    try:
        png_bytes = png_export_service.export_template_to_png(
            pdf_bytes=pdf_bytes,
            device_profile=device_profile
        )
    except PNGExportError as e:
        logger.error(f"PNG export failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to export PNG: {e}"
        )

    # Return PNG file
    filename = f"{request.master_name}_template.png"
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
