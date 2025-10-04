"""
Pydantic models for FastAPI request/response validation.

These models define the API contract for the web interface,
separate from the core einkpdf schema models.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field


# ----------------------
# Authentication models
# ----------------------


class UserCreate(BaseModel):
    """Payload for registering a new user account."""

    username: str = Field(..., min_length=3, max_length=50, description="Unique username")
    email: EmailStr = Field(..., description="Account email address")
    password: str = Field(..., min_length=8, max_length=64, description="Account password (max 64 characters to ensure UTF-8 compatibility)")


class UserLogin(BaseModel):
    """Payload for authenticating an existing user."""

    username: str = Field(..., min_length=3, max_length=50, description="Account username")
    password: str = Field(..., min_length=8, max_length=64, description="Account password (max 64 characters to ensure UTF-8 compatibility)")


class UserResponse(BaseModel):
    """Response shape for user profile information."""

    id: str = Field(..., description="Unique user identifier")
    username: str = Field(..., description="Account username")
    email: EmailStr = Field(..., description="Account email address")
    created_at: datetime = Field(..., description="Account creation timestamp")
    is_active: bool = Field(True, description="Whether the account is active")
    is_admin: bool = Field(False, description="Whether the user has admin privileges")
    terms_accepted_at: Optional[datetime] = Field(default=None, description="When user accepted terms of use")
    is_impersonating: bool = Field(False, description="Whether an admin is currently impersonating this user")


class AcceptTermsRequest(BaseModel):
    """Request to accept terms of use."""

    accepted: bool = Field(..., description="Whether user accepts the terms")


class Token(BaseModel):
    """Access token response."""

    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field("bearer", description="Token type descriptor")


class TokenPayload(BaseModel):
    """Decoded token payload contents."""

    sub: str = Field(..., description="Subject identifier (user ID)")
    exp: int = Field(..., description="Expiration timestamp (seconds since epoch)")


class PasswordResetRequest(BaseModel):
    """Request to initiate password reset flow via email."""

    email: EmailStr = Field(..., description="Account email address")


class PasswordResetConfirmRequest(BaseModel):
    """Request to confirm password reset with token."""

    token: str = Field(..., min_length=32, max_length=256, description="Password reset token")
    new_password: str = Field(..., min_length=8, max_length=64, description="New account password (max 64 characters to ensure UTF-8 compatibility)")


class MessageResponse(BaseModel):
    """Generic response containing a status message."""

    message: str = Field(..., description="Human-readable status message")


# ----------------------
# Template and rendering models
# ----------------------


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


# ----------------------
# Project sharing models
# ----------------------


class MakeProjectPublicRequest(BaseModel):
    """Request to toggle project public visibility."""

    is_public: bool = Field(..., description="Whether the project should be public")
    url_slug: Optional[str] = Field(None, max_length=80, description="Optional custom slug for public URL")


class CloneProjectRequest(BaseModel):
    """Payload for cloning a public project into a user's workspace."""

    new_name: str = Field(..., min_length=1, max_length=100, description="Name for the cloned project")
    new_description: Optional[str] = Field(None, max_length=500, description="Description for the cloned project")


class PublicProjectResponse(BaseModel):
    """Response describing a public project entry."""

    id: str = Field(..., description="Public project identifier")
    metadata: Dict[str, Any] = Field(..., description="Project metadata payload")
    url_slug: Optional[str] = Field(None, description="Public URL slug")
    author: str = Field(..., description="Current project author")
    original_author: Optional[str] = Field(None, description="Original project author if cloned")
    clone_count: int = Field(..., ge=0, description="Number of times the project has been cloned")
    created_at: datetime = Field(..., description="When the public entry was created")
    updated_at: datetime = Field(..., description="When the public entry was last updated")


class PublicProjectListResponse(BaseModel):
    """Wrapper for listing public projects."""

    projects: List[PublicProjectResponse] = Field(..., description="Collection of public projects")
    total: int = Field(..., ge=0, description="Total number of public projects")

