"""
Project management API endpoints for master/plan architecture.

Provides CRUD operations for projects, masters, and plans.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import sys
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# Ensure src is on path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from einkpdf.services.project_service import ProjectService, ProjectServiceError
from einkpdf.services.compilation_service import CompilationService, CompilationServiceError
from einkpdf.core.project_schema import Project, ProjectListItem, CompilationResult, Master
from einkpdf.core.profiles import load_device_profile, DeviceProfileError


router = APIRouter(prefix="/projects", tags=["projects"])

# Initialize services
project_service = ProjectService()
compilation_service = CompilationService()


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

        # Persist compiled template under project directory for diagnostics
        try:
            from pathlib import Path
            import os
            # Resolve base projects dir
            env_base = os.getenv("EINK_PROJECTS_DIR")
            if env_base:
                base_dir = Path(env_base)
            else:
                # from backend/app/api -> parents[2] == backend
                backend_dir = Path(__file__).resolve().parents[2]
                base_dir = backend_dir / "data" / "projects"
            pdir = base_dir / project.id / "compiled"
            pdir.mkdir(parents=True, exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d-%H%M%S")
            with open(pdir / f"compiled-{ts}.yaml", "w", encoding="utf-8") as f:
                f.write(template_yaml)
            # Also refresh latest.yaml pointer
            with open(pdir / "latest.yaml", "w", encoding="utf-8") as f:
                f.write(template_yaml)
        except Exception:
            # Non-fatal: continue without blocking response
            pass

        return CompileProjectResponse(
            template_yaml=template_yaml,
            compilation_stats=result.compilation_stats
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
