"""
Template management API endpoints.

Provides CRUD operations for template management.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

from typing import List
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response

from ..models import (
    TemplateCreateRequest, TemplateUpdateRequest, TemplateResponse, 
    TemplateListResponse, APIError
)
from ..services import TemplateService, EinkPDFServiceError

router = APIRouter(prefix="/templates", tags=["templates"])

# Initialize template service
template_service = TemplateService()


@router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(request: TemplateCreateRequest) -> TemplateResponse:
    """
    Create a new template.
    
    Args:
        request: Template creation request
        
    Returns:
        Created template information
        
    Raises:
        HTTPException: If creation fails
    """
    try:
        template = template_service.create_template(
            name=request.name,
            description=request.description,
            profile=request.profile,
            yaml_content=request.yaml_content
        )
        return template
    except EinkPDFServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/", response_model=TemplateListResponse)
async def list_templates() -> TemplateListResponse:
    """
    List all templates.
    
    Returns:
        List of all templates
        
    Raises:
        HTTPException: If listing fails
    """
    try:
        templates = template_service.list_templates()
        return TemplateListResponse(
            templates=templates,
            total=len(templates)
        )
    except EinkPDFServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str) -> TemplateResponse:
    """
    Get template by ID.
    
    Args:
        template_id: Template unique identifier
        
    Returns:
        Template information
        
    Raises:
        HTTPException: If template not found or retrieval fails
    """
    try:
        template = template_service.get_template(template_id)
        if template is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID '{template_id}' not found"
            )
        return template
    except EinkPDFServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: str, request: TemplateUpdateRequest) -> TemplateResponse:
    """
    Update existing template.
    
    Args:
        template_id: Template unique identifier
        request: Template update request
        
    Returns:
        Updated template information
        
    Raises:
        HTTPException: If template not found or update fails
    """
    try:
        template = template_service.update_template(
            template_id=template_id,
            name=request.name,
            description=request.description,
            profile=request.profile,
            yaml_content=request.yaml_content
        )
        if template is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID '{template_id}' not found"
            )
        return template
    except EinkPDFServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(template_id: str) -> Response:
    """
    Delete template by ID.
    
    Args:
        template_id: Template unique identifier
        
    Returns:
        Empty response
        
    Raises:
        HTTPException: If template not found or deletion fails
    """
    try:
        deleted = template_service.delete_template(template_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID '{template_id}' not found"
            )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except EinkPDFServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )