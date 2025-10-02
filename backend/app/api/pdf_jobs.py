"""
PDF jobs API endpoints for async PDF generation.

Provides job-based PDF generation with status tracking and downloads.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import json
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..db.dependencies import get_current_user
from ..db.models import PDFJob, User
from ..services.pdf_job_service import (
    PDFJobService,
    PDFJobServiceError,
    PDFJobNotFoundError
)
from ..services.pdf_worker import get_pdf_worker

router = APIRouter(prefix="/pdf/jobs", tags=["pdf-jobs"])
logger = logging.getLogger(__name__)


# Request/Response Models

class PDFJobCreateRequest(BaseModel):
    """Request to create a new PDF generation job."""
    yaml_content: Optional[str] = Field(default=None, description="Optional YAML template content")
    profile: Optional[str] = Field(default=None, description="Override device profile name")
    deterministic: bool = Field(default=False, description="Use deterministic rendering")
    strict_mode: bool = Field(default=False, description="Use strict validation")
    project_id: str | None = Field(default=None, description="Optional project ID")


class PDFJobResponse(BaseModel):
    """Response with job information."""
    id: str
    project_id: str | None = None
    status: str
    error_message: str | None = None
    size_bytes: int | None = None
    page_count: int | None = None
    created_at: str
    started_at: str | None = None
    completed_at: str | None = None
    diagnostics: Dict[str, Any] | None = None

    class Config:
        from_attributes = True


class PDFJobListResponse(BaseModel):
    """Response with list of jobs."""
    jobs: List[PDFJobResponse]
    total: int


def _job_to_response(job: PDFJob) -> PDFJobResponse:
    diagnostics = None
    if job.diagnostics:
        try:
            diagnostics = json.loads(job.diagnostics)
        except ValueError:
            diagnostics = None

    return PDFJobResponse(
        id=job.id,
        project_id=job.project_id,
        status=job.status,
        error_message=job.error_message,
        size_bytes=job.size_bytes,
        page_count=job.page_count,
        created_at=job.created_at.isoformat(),
        started_at=job.started_at.isoformat() if job.started_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        diagnostics=diagnostics,
    )


# API Endpoints

@router.post("", response_model=PDFJobResponse, status_code=status.HTTP_201_CREATED)
async def create_pdf_job(
    request: PDFJobCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> PDFJobResponse:
    """
    Create a new PDF generation job.

    The job is processed asynchronously in the background.
    Returns immediately with job ID and pending status.

    Args:
        request: PDF generation request
        background_tasks: FastAPI background tasks
        current_user: Authenticated user
        db: Database session

    Returns:
        Created job with pending status
    """
    try:
        job_service = PDFJobService(db)

        if request.project_id is None and request.yaml_content is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide either project_id or yaml_content to create a PDF job",
            )

        # Create job record
        job = job_service.create_job(
            owner_id=current_user.id,
            project_id=request.project_id
        )

        logger.info(f"Created PDF job {job.id} for user {current_user.username}")

        # Schedule background processing
        worker = get_pdf_worker()
        background_tasks.add_task(
            worker.process_job,
            job_id=job.id,
            owner_id=current_user.id,
            project_id=request.project_id,
            yaml_content=request.yaml_content,
            profile=request.profile,
            deterministic=request.deterministic,
            strict_mode=request.strict_mode
        )

        return _job_to_response(job)

    except PDFJobServiceError as e:
        logger.error(f"Failed to create PDF job: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create job: {e}"
        )


@router.get("", response_model=PDFJobListResponse)
async def list_pdf_jobs(
    status_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> PDFJobListResponse:
    """
    List PDF generation jobs for current user.

    Args:
        status_filter: Optional status filter (pending, processing, completed, failed, cancelled)
        limit: Maximum number of jobs to return (default 50)
        offset: Number of jobs to skip (default 0)
        current_user: Authenticated user
        db: Database session

    Returns:
        List of jobs, newest first
    """
    try:
        job_service = PDFJobService(db)

        jobs = job_service.list_jobs(
            owner_id=current_user.id,
            status=status_filter,
            limit=limit,
            offset=offset
        )

        job_responses = [_job_to_response(job) for job in jobs]

        return PDFJobListResponse(
            jobs=job_responses,
            total=len(job_responses)
        )

    except PDFJobServiceError as e:
        logger.error(f"Failed to list jobs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list jobs: {e}"
        )


@router.get("/{job_id}", response_model=PDFJobResponse)
async def get_pdf_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> PDFJobResponse:
    """
    Get status of a PDF generation job.

    Args:
        job_id: Job ID
        current_user: Authenticated user
        db: Database session

    Returns:
        Job information with current status
    """
    try:
        job_service = PDFJobService(db)
        job = job_service.get_job(job_id, owner_id=current_user.id)

        return _job_to_response(job)

    except PDFJobNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PDFJobServiceError as e:
        logger.error(f"Failed to get job {job_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job: {e}"
        )


@router.get("/{job_id}/download")
async def download_pdf(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> FileResponse:
    """
    Download generated PDF file.

    Only works for completed jobs. Returns 404 if job is not complete
    or PDF file is missing.

    Args:
        job_id: Job ID
        current_user: Authenticated user
        db: Database session

    Returns:
        PDF file download
    """
    try:
        job_service = PDFJobService(db)
        pdf_path = job_service.get_pdf_file(job_id, current_user.id)

        return FileResponse(
            path=pdf_path,
            media_type="application/pdf",
            filename=f"template_{job_id}.pdf",
            headers={
                "Content-Disposition": f"attachment; filename=template_{job_id}.pdf"
            }
        )

    except PDFJobNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PDFJobServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_pdf_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> None:
    """
    Cancel a pending or processing PDF job.

    Cannot cancel already completed, failed, or cancelled jobs.

    Args:
        job_id: Job ID
        current_user: Authenticated user
        db: Database session
    """
    try:
        job_service = PDFJobService(db)
        job_service.cancel_job(job_id, current_user.id)
        logger.info(f"User {current_user.username} cancelled job {job_id}")

    except PDFJobNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PDFJobServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
