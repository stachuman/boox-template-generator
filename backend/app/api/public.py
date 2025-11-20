"""Public project gallery endpoints."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException, Response, status, Query
from typing import Optional

# Ensure src is on path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from einkpdf.core.project_schema import Project

from ..workspaces import PublicProjectNotFoundError, get_public_project_manager
from ..models import PublicProjectListResponse, PublicProjectResponse
from ..core_services import PDFService
from ..utils import convert_enums_for_serialization

router = APIRouter(prefix="/public", tags=["public-projects"])

public_project_manager = get_public_project_manager()
pdf_service = PDFService()


@router.get("/projects", response_model=PublicProjectListResponse)
async def list_public_projects(
    limit: int = Query(20, ge=1, le=50, description="Number of projects per page"),
    offset: int = Query(0, ge=0, description="Number of projects to skip"),
    device_profile: Optional[str] = Query(None, description="Filter by device profile"),
    sort_by: str = Query("recent", regex="^(recent|popular|name)$", description="Sort order")
) -> PublicProjectListResponse:
    """
    Return paginated public project gallery.

    Pagination is required to avoid loading hundreds of PDF previews simultaneously.
    Default page size is 20 projects (max 50) to balance UX and performance.
    """
    return public_project_manager.list_public_projects(
        limit=limit,
        offset=offset,
        device_profile=device_profile,
        sort_by=sort_by
    )


@router.get("/projects/{project_id}", response_model=PublicProjectResponse)
async def get_public_project(project_id: str) -> PublicProjectResponse:
    """Return metadata for a public project by ID."""
    try:
        _, entry, _ = public_project_manager.get_public_project(project_id)
    except PublicProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return public_project_manager._build_response(entry)  # noqa: SLF001


@router.get("/projects/slug/{slug}", response_model=PublicProjectResponse)
async def get_public_project_by_slug(slug: str) -> PublicProjectResponse:
    """Return metadata for a public project by slug."""
    try:
        _, entry, _ = public_project_manager.get_public_project_by_slug(slug)
    except PublicProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return public_project_manager._build_response(entry)  # noqa: SLF001


@router.get("/projects/{project_id}/definition", response_model=Project)
async def get_public_project_definition(project_id: str) -> Project:
    """Return the full project definition for public consumption."""
    try:
        project, _, _ = public_project_manager.get_public_project(project_id)
    except PublicProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return project


@router.get("/projects/{project_id}/pdf")
async def download_public_project_pdf(project_id: str, inline: bool = False):
    """Download the compiled PDF for a public project."""
    try:
        project, _, public_dir = public_project_manager.get_public_project(project_id)
    except PublicProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    # Check if compiled PDF exists in the public directory
    pdf_path = public_dir / "compiled" / "latest.pdf"
    if not pdf_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PDF not available for project '{project_id}'. The project owner needs to compile it first."
        )
        # No compile on demand!

    # Read and return PDF
    try:
        data = pdf_path.read_bytes()
        disposition = "inline" if inline else "attachment"
        filename = f"{project.metadata.name or 'project'}.pdf"

        return Response(
            content=data,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"{disposition}; filename={filename}",
                "Content-Length": str(len(data)),
                "Cache-Control": "public, max-age=3600",  # Cache for 1 hour for public projects
            },
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read PDF: {exc}"
        ) from exc


@router.get("/projects/slug/{slug}/pdf")
async def download_public_project_pdf_by_slug(slug: str, inline: bool = False):
    """Download the compiled PDF for a public project by slug."""
    try:
        project, _, public_dir = public_project_manager.get_public_project_by_slug(slug)
    except PublicProjectNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    # Reuse the same logic as the ID endpoint
    return await download_public_project_pdf(project.id, inline)

