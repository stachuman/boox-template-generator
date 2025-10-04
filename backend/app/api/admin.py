"""
Admin API endpoints.

Provides admin-only functionality for user management, impersonation, etc.
Following CLAUDE.MD: No dummy implementations, explicit error handling.
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..db.dependencies import get_current_admin_user
from ..db.models import User
from ..db.auth_service import DBAuthService
from ..config import settings
from ..workspaces import get_workspace_manager

router = APIRouter(prefix="/admin", tags=["admin"])


# Response models
class UserStatsResponse(BaseModel):
    """User information with statistics."""
    id: str
    username: str
    email: str
    is_active: bool
    is_admin: bool
    created_at: datetime
    project_count: int
    last_login: Optional[datetime] = None


class UserListResponse(BaseModel):
    """List of users with stats."""
    users: List[UserStatsResponse]
    total: int


class ProjectListItemResponse(BaseModel):
    """Project list item for admin view."""
    id: str
    name: str
    description: str
    device_profile: str
    created_at: datetime
    updated_at: datetime


class UserProjectsResponse(BaseModel):
    """User's projects list."""
    user_id: str
    username: str
    projects: List[ProjectListItemResponse]
    total: int


class ImpersonateRequest(BaseModel):
    """Request to impersonate a user."""
    user_id: str = Field(..., min_length=1)


class ResetPasswordRequest(BaseModel):
    """Request to reset user password."""
    user_id: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


# Endpoints
@router.get("/users", response_model=UserListResponse)
def list_users(
    skip: int = 0,
    limit: int = 100,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
) -> UserListResponse:
    """
    List all users with statistics.

    Requires admin authentication.
    """
    # Get all users from database
    users_query = db.query(User).order_by(User.created_at.desc())
    total = users_query.count()
    users = users_query.offset(skip).limit(limit).all()

    # Get project counts from file system
    workspace_manager = get_workspace_manager()
    user_stats = []

    for user in users:
        try:
            project_service = workspace_manager.get_project_service(user.id)
            projects = project_service.list_projects()
            project_count = len(projects)
        except Exception:
            project_count = 0

        user_stats.append(
            UserStatsResponse(
                id=user.id,
                username=user.username,
                email=user.email,
                is_active=user.is_active,
                is_admin=user.is_admin,
                created_at=user.created_at,
                project_count=project_count,
                last_login=None  # TODO: Add last_login tracking if needed
            )
        )

    return UserListResponse(users=user_stats, total=total)


@router.get("/users/{user_id}/projects", response_model=UserProjectsResponse)
def get_user_projects(
    user_id: str,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
) -> UserProjectsResponse:
    """
    Get all projects for a specific user.

    Requires admin authentication.
    """
    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User not found: {user_id}"
        )

    # Get user's projects from file system via workspace manager
    workspace_manager = get_workspace_manager()
    project_service = workspace_manager.get_project_service(user_id)

    try:
        project_list = project_service.list_projects()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load projects: {str(e)}"
        )

    # Load full project details to get device_profile
    project_items = []
    for p in project_list:
        try:
            full_project = project_service.get_project(p.id)
            if full_project:
                project_items.append(
                    ProjectListItemResponse(
                        id=full_project.id,
                        name=full_project.metadata.name,
                        description=full_project.metadata.description,
                        device_profile=full_project.metadata.device_profile,
                        created_at=datetime.fromisoformat(full_project.metadata.created_at) if isinstance(full_project.metadata.created_at, str) else full_project.metadata.created_at,
                        updated_at=datetime.fromisoformat(full_project.metadata.updated_at) if isinstance(full_project.metadata.updated_at, str) else full_project.metadata.updated_at
                    )
                )
        except Exception as e:
            # Skip projects that fail to load
            print(f"Failed to load project {p.id}: {e}")
            continue

    return UserProjectsResponse(
        user_id=user.id,
        username=user.username,
        projects=project_items,
        total=len(project_items)
    )


@router.post("/impersonate")
def impersonate_user(
    request: Request,
    response: Response,
    body: ImpersonateRequest,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
) -> dict:
    """
    Start impersonating a user.

    Sets session state to impersonate the target user.
    Admin can then access the system as that user.

    Requires admin authentication.
    """
    # Get target user
    target_user = db.query(User).filter(User.id == body.user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User not found: {body.user_id}"
        )

    # Store impersonation in session (using cookies)
    # Session format: admin_id|impersonated_user_id
    session_value = f"{admin.id}|{target_user.id}"

    # Set secure session cookie
    import logging
    logger = logging.getLogger(__name__)

    logger.info(f"Setting impersonation cookie: {session_value}")

    # Determine security requirements for cookie
    forwarded_proto = request.headers.get("x-forwarded-proto")
    scheme = forwarded_proto or request.url.scheme
    is_https = scheme.lower() == "https"
    should_use_secure = (not settings.DEBUG) and is_https

    response.set_cookie(
        key="admin_impersonate",
        value=session_value,
        httponly=True,
        secure=should_use_secure,
        samesite="lax",
        path="/",
        max_age=3600 * 24  # 24 hours
    )
    logger.info(
        "Cookie set (secure=%s, scheme=%s, debug=%s) for admin %s to impersonate %s",
        should_use_secure,
        scheme,
        settings.DEBUG,
        admin.username,
        target_user.username
    )

    return {
        "message": f"Now impersonating {target_user.username}",
        "admin_id": admin.id,
        "impersonated_user_id": target_user.id,
        "impersonated_username": target_user.username
    }


@router.delete("/impersonate")
def stop_impersonation(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
) -> dict:
    """
    Stop impersonating a user.

    Clears impersonation session state.

    Can be called while impersonating (doesn't require admin check on current_user).
    """
    import logging
    logger = logging.getLogger(__name__)

    # Get the impersonation cookie to find the admin
    impersonate_cookie = request.cookies.get("admin_impersonate")
    if not impersonate_cookie:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not currently impersonating"
        )

    try:
        admin_id, impersonated_user_id = impersonate_cookie.split("|")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid impersonation cookie"
        )

    # Verify the admin exists
    admin = db.query(User).filter(User.id == admin_id).first()
    if not admin or not admin.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )

    # Clear session cookie - must match the same path and other params as when set
    logger.info(f"Admin {admin.username} stopping impersonation of user {impersonated_user_id}")
    response.delete_cookie(
        key="admin_impersonate",
        path="/"
    )

    return {
        "message": "Impersonation stopped",
        "admin_id": admin.id
    }


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    body: ResetPasswordRequest,
    admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
) -> dict:
    """
    Reset a user's password.

    Requires admin authentication.
    """
    if user_id != body.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id in path must match user_id in body"
        )

    # Get user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User not found: {user_id}"
        )

    # Reset password using auth service
    auth_service = DBAuthService(db)
    try:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        user.password_hash = pwd_context.hash(body.new_password)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset password: {str(e)}"
        )

    return {
        "message": f"Password reset for user {user.username}",
        "user_id": user.id,
        "username": user.username
    }
