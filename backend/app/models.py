"""
Pydantic models for FastAPI request/response validation.

These models define the API contract for the web interface,
separate from the core einkpdf schema models.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class TemplateCreateRequest(BaseModel):
    """Request to create a new template."""
    name: str = Field(..., min_length=1, max_length=100, description="Template name")
    description: str = Field("", max_length=500, description="Template description")
    profile: str = Field(..., description="Device profile name")
    yaml_content: str = Field(..., min_length=1, description="YAML template content")


class TemplateUpdateRequest(BaseModel):
    """Request to update an existing template."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    profile: Optional[str] = None
    yaml_content: Optional[str] = Field(None, min_length=1)


class TemplateResponse(BaseModel):
    """Response containing template information."""
    id: str = Field(..., description="Template unique identifier")
    name: str = Field(..., description="Template name")
    description: str = Field(..., description="Template description")
    profile: str = Field(..., description="Device profile name")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    yaml_content: str = Field(..., description="YAML template content")
    parsed_template: Optional[Dict[str, Any]] = Field(None, description="Parsed template as JSON (optional)")


class TemplateListResponse(BaseModel):
    """Response containing list of templates."""
    templates: List[TemplateResponse] = Field(..., description="List of templates")
    total: int = Field(..., description="Total number of templates")


class PDFGenerateRequest(BaseModel):
    """Request to generate PDF from template."""
    yaml_content: str = Field(..., min_length=1, description="YAML template content")
    profile: str = Field(..., description="Device profile name")
    deterministic: bool = Field(True, description="Generate deterministic PDF")
    strict_mode: bool = Field(False, description="Fail on constraint violations")


class PreviewGenerateRequest(BaseModel):
    """Request to generate preview from template."""
    yaml_content: str = Field(..., min_length=1, description="YAML template content")
    profile: str = Field(..., description="Device profile name")
    page_number: int = Field(1, ge=1, description="Page number to preview")
    scale: float = Field(2.0, ge=0.5, le=4.0, description="Preview scale factor")


class DeviceProfileResponse(BaseModel):
    """Response containing device profile information."""
    name: str = Field(..., description="Profile name")
    display: Dict[str, Any] = Field(..., description="Display specifications")
    pdf_settings: Dict[str, Any] = Field(..., description="PDF settings")
    constraints: Dict[str, Any] = Field(..., description="Device constraints")


class ValidationError(BaseModel):
    """Validation error details."""
    field: str = Field(..., description="Field that failed validation")
    message: str = Field(..., description="Error message")
    value: Any = Field(..., description="Invalid value")


class APIError(BaseModel):
    """Standard API error response."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[List[ValidationError]] = Field(None, description="Validation error details")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(..., description="Service status")
    version: str = Field(..., description="API version")
    einkpdf_available: bool = Field(..., description="Whether einkpdf library is available")


class WebSocketMessage(BaseModel):
    """WebSocket message for real-time preview updates."""
    type: str = Field(..., description="Message type: preview_request, preview_response, error")
    data: Dict[str, Any] = Field(..., description="Message payload")
