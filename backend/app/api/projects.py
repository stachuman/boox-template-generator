"""
Project management API endpoints for master/plan architecture.

Provides CRUD operations for projects, masters, and plans.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import sys
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# Ensure src is on path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from einkpdf.services.project_service import ProjectService, ProjectServiceError
from einkpdf.services.compilation_service import CompilationService, CompilationServiceError
from einkpdf.core.project_schema import Project, ProjectListItem, CompilationResult, Master
from einkpdf.core.profiles import load_device_profile, DeviceProfileError
from einkpdf.core.preview import generate_ground_truth_preview, PreviewError
from ..services import PDFService


router = APIRouter(prefix="/projects", tags=["projects"])

# Initialize services
project_service = ProjectService()
compilation_service = CompilationService()
pdf_service = PDFService()


# Request/Response models
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


# Project CRUD endpoints
@router.post("", response_model=Project, status_code=status.HTTP_201_CREATED)
async def create_project(request: CreateProjectRequest) -> Project:
    """Create a new project."""
    try:
        project = project_service.create_project(
            name=request.name,
            description=request.description,
            device_profile=request.device_profile,
            author=request.author,
            category=request.category
        )
        return project
    except ProjectServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=List[ProjectListItem])
async def list_projects() -> List[ProjectListItem]:
    """List all projects."""
    try:
        return project_service.list_projects()
    except ProjectServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str) -> Project:
    """Get project by ID."""
    try:
        project = project_service.get_project(project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )
        return project
    except ProjectServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.patch("/{project_id}", response_model=Project)
async def update_project(project_id: str, request: UpdateProjectRequest) -> Project:
    """Update project metadata."""
    try:
        # Only include non-None fields
        update_fields = {k: v for k, v in request.model_dump().items() if v is not None}

        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        project = project_service.update_project_metadata(project_id, **update_fields)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )
        return project
    except ProjectServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str):
    """Delete project by ID."""
    try:
        deleted = project_service.delete_project(project_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )
    except ProjectServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Master management endpoints
@router.post("/{project_id}/masters", response_model=Project)
async def add_master(project_id: str, request: AddMasterRequest) -> Project:
    """Add a master to project."""
    try:
        project = project_service.add_master(
            project_id=project_id,
            name=request.name,
            template_yaml=request.template_yaml,
            description=request.description
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )
        return project
    except ProjectServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/{project_id}/masters/{master_name}", response_model=Project)
async def update_master(project_id: str, master_name: str, request: UpdateMasterRequest) -> Project:
    """Update a master in project."""
    try:
        project = project_service.update_master(
            project_id=project_id,
            master_name=master_name,
            template_yaml=request.template_yaml,
            new_name=request.new_name,
            description=request.description
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} or master '{master_name}' not found"
            )
        return project
    except ProjectServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{project_id}/masters/{master_name}", response_model=Project)
async def remove_master(project_id: str, master_name: str) -> Project:
    """Remove a master from project."""
    try:
        project = project_service.remove_master(project_id, master_name)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )
        return project
    except ProjectServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# Plan management endpoints
@router.put("/{project_id}/plan", response_model=Project)
async def update_plan(project_id: str, request: UpdatePlanRequest) -> Project:
    """Update plan for project."""
    try:
        project = project_service.update_plan(project_id, request.plan_data)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )
        return project
    except ProjectServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{project_id}/compile", response_model=CompileProjectResponse)
async def compile_project(project_id: str) -> CompileProjectResponse:
    """Compile project into final template."""
    try:
        # Get project
        project = project_service.get_project(project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project {project_id} not found"
            )

        # Load device profile
        device_profile = None
        try:
            profile_obj = load_device_profile(project.metadata.device_profile)
            device_profile = profile_obj.model_dump()  # Convert to dict for compilation service
        except DeviceProfileError as e:
            # Log warning but continue with compilation using defaults
            print(f"Warning: Could not load device profile '{project.metadata.device_profile}': {e}")

        # Compile project
        result = compilation_service.compile_project(project, device_profile)

        # Convert template to YAML
        import yaml

        # Convert enum values to strings for YAML serialization
        def convert_enums(obj):
            if isinstance(obj, dict):
                return {k: convert_enums(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_enums(item) for item in obj]
            elif hasattr(obj, 'value'):  # Enum
                return obj.value
            else:
                return obj

        template_data = convert_enums(result.template.model_dump())
        template_yaml = yaml.safe_dump(template_data, sort_keys=False, allow_unicode=True)

        # Persist compiled template and final PDF (no history, only latest files)
        warnings: List[str] = []
        try:
            from pathlib import Path
            import os
            # Resolve base projects dir
            env_base = os.getenv("EINK_PROJECTS_DIR")
            if env_base:
                base_dir = Path(env_base)
            else:
                backend_dir = Path(__file__).resolve().parents[2]
                base_dir = backend_dir / "data" / "projects"
            pdir = base_dir / project.id / "compiled"
            pdir.mkdir(parents=True, exist_ok=True)

            # Remove previous outputs to avoid stale previews
            for old in pdir.glob("*"):
                try:
                    old.unlink()
                except Exception:
                    pass

            # Write latest.yaml
            with open(pdir / "latest.yaml", "w", encoding="utf-8") as f:
                f.write(template_yaml)

            # Generate final PDF once during compilation with warnings
            try:
                pdf_bytes, warnings = pdf_service.generate_pdf_with_warnings(
                    yaml_content=template_yaml,
                    profile=project.metadata.device_profile,
                    deterministic=True,
                )
                # Atomic write of PDF to prevent partial reads in preview
                tmp_path = pdir / "latest.pdf.tmp"
                with open(tmp_path, "wb") as pf:
                    pf.write(pdf_bytes)
                    try:
                        pf.flush()
                        import os
                        os.fsync(pf.fileno())
                    except Exception:
                        pass
                import os
                os.replace(tmp_path, pdir / "latest.pdf")
            except Exception as e:
                # PDF generation failed - this is a critical error that should be reported
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"PDF generation failed: {e}"
                )
        except HTTPException:
            # Re-raise HTTP exceptions (like PDF generation failures)
            raise
        except Exception as e:
            # File system errors are non-fatal: continue without blocking response but log warning
            warnings = warnings or []
            warnings.append(f"Failed to save compiled files: {e}")

        return CompileProjectResponse(
            template_yaml=template_yaml,
            compilation_stats=result.compilation_stats,
            warnings=warnings or []
        )

    except ProjectServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except CompilationServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Compilation failed: {e}"
        )


@router.get("/{project_id}/pdf")
async def get_project_pdf(project_id: str, inline: bool = False):
    """Return the last compiled PDF for the project."""
    try:
        project = project_service.get_project(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        import os
        from pathlib import Path
        env_base = os.getenv("EINK_PROJECTS_DIR")
        if env_base:
            base_dir = Path(env_base)
        else:
            backend_dir = Path(__file__).resolve().parents[2]
            base_dir = backend_dir / "data" / "projects"
        pdf_path = base_dir / project.id / "compiled" / "latest.pdf"
        if not pdf_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not available. Compile the project first.")
        data = pdf_path.read_bytes()
        disp = "inline" if inline else "attachment"
        return Response(content=data, media_type="application/pdf", headers={
            "Content-Disposition": f"{disp}; filename={project.metadata.name or 'project'}.pdf",
            "Content-Length": str(len(data)),
            # Prevent client/proxy caching so preview always shows the latest PDF
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.head("/{project_id}/pdf")
async def head_project_pdf(project_id: str):
    """HEAD probe for compiled PDF availability."""
    try:
        project = project_service.get_project(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        import os
        from pathlib import Path
        env_base = os.getenv("EINK_PROJECTS_DIR")
        if env_base:
            base_dir = Path(env_base)
        else:
            backend_dir = Path(__file__).resolve().parents[2]
            base_dir = backend_dir / "data" / "projects"
        pdf_path = base_dir / project.id / "compiled" / "latest.pdf"
        if not pdf_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PDF not available")
        # Return 200 with no body for HEAD
        return Response(status_code=status.HTTP_200_OK)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{project_id}/preview")
async def get_project_preview(project_id: str, page: int = 1, scale: float = 2.0):
    """Return a PNG preview rendered from the last compiled PDF."""
    try:
        project = project_service.get_project(project_id)
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        import os
        from pathlib import Path
        env_base = os.getenv("EINK_PROJECTS_DIR")
        if env_base:
            base_dir = Path(env_base)
        else:
            backend_dir = Path(__file__).resolve().parents[2]
            base_dir = backend_dir / "data" / "projects"
        pdf_path = base_dir / project.id / "compiled" / "latest.pdf"
        if not pdf_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preview not available. Compile the project first.")
        pdf_bytes = pdf_path.read_bytes()
        try:
            png = generate_ground_truth_preview(pdf_bytes=pdf_bytes, page_number=page, scale=scale)
        except PreviewError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Preview failed: {e}")
        return Response(content=png, media_type="image/png", headers={
            "Content-Disposition": f"inline; filename=preview-page-{page}.png",
            "Content-Length": str(len(png)),
            # Prevent caching of previews derived from the latest compiled PDF
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except CompilationServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Compilation failed: {e}"
        )
