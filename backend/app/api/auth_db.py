"""
Database-backed authentication API endpoints.

Replaces file-based auth with SQLAlchemy database auth.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..db.dependencies import get_auth_service, get_current_user, get_password_reset_service
from ..db.auth_service import (
    DBAuthService,
    DBPasswordResetService,
    AuthServiceError,
    InvalidCredentialsError,
    UserInactiveError,
)
from ..db.jwt_service import get_jwt_service
from ..db.models import User
from ..auth import EmailService
import os
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from ..models import (
    AcceptTermsRequest,
    MessageResponse,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# Initialize email service for password resets
_email_service = EmailService()


def _build_reset_link(token: str) -> str:
    """Build password reset link with token."""
    reset_base_url = os.getenv("EINK_PASSWORD_RESET_URL", "http://localhost:5173/reset-password")
    parsed = urlparse(reset_base_url)
    query_params = dict(parse_qsl(parsed.query))
    query_params["token"] = token
    new_query = urlencode(query_params)
    return urlunparse(parsed._replace(query=new_query))


def _to_user_response(user: User) -> UserResponse:
    """Convert User model to UserResponse."""
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at,
        is_active=user.is_active,
        is_admin=user.is_admin,
        terms_accepted_at=user.terms_accepted_at,
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserCreate,
    auth_service: DBAuthService = Depends(get_auth_service)
) -> UserResponse:
    """Register a new user account."""
    try:
        user = auth_service.register_user(
            payload.username,
            payload.email,
            payload.password
        )
        return _to_user_response(user)
    except AuthServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        ) from exc


@router.post("/login", response_model=Token)
async def login(
    payload: UserLogin,
    auth_service: DBAuthService = Depends(get_auth_service)
) -> Token:
    """Authenticate user and issue a JWT access token."""
    try:
        user = auth_service.authenticate_user(payload.username, payload.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc)
        ) from exc
    except UserInactiveError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc)
        ) from exc

    # Create JWT token
    jwt_service = get_jwt_service()
    access_token = jwt_service.create_token_for_user(user)

    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def me(request: Request, current_user: User = Depends(get_current_user)) -> UserResponse:
    """Return the authenticated user's profile."""
    user_response = _to_user_response(current_user)

    # Check if admin is impersonating this user
    impersonate_cookie = request.cookies.get("admin_impersonate")
    user_response.is_impersonating = impersonate_cookie is not None

    return user_response


@router.post(
    "/password-reset/request",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def request_password_reset(
    payload: PasswordResetRequest,
    reset_service: DBPasswordResetService = Depends(get_password_reset_service)
) -> MessageResponse:
    """Initiate password reset by sending an email with a secure token."""
    try:
        token_value, expires_at, recipient_email = reset_service.initiate_reset(payload.email)

        if token_value and recipient_email and expires_at:
            logger.info(f"Password reset initiated for {recipient_email}")

            # Build reset link with token
            reset_link = _build_reset_link(token_value)

            # Send password reset email
            try:
                _email_service.send_password_reset_email(recipient_email, reset_link, expires_at)
                logger.info(f"Password reset email sent to {recipient_email}")
            except Exception as email_exc:
                logger.error(f"Failed to send password reset email to {recipient_email}: {email_exc}")
                # Log token for manual recovery if email fails
                logger.warning(f"Reset token for {recipient_email} (email delivery failed): {token_value}")

    except Exception as exc:
        logger.error("Failed to initiate password reset: %s", exc)
        # Don't expose internal errors to user
        pass

    # Always return success message (security best practice)
    return MessageResponse(
        message=(
            "If an account with that email exists, a password reset link has been sent. "
            "Please check your inbox and spam folder."
        )
    )


@router.post(
    "/password-reset/confirm",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
)
async def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    reset_service: DBPasswordResetService = Depends(get_password_reset_service)
) -> MessageResponse:
    """Confirm password reset using token and set a new password."""
    try:
        reset_service.reset_password(payload.token, payload.new_password)
        return MessageResponse(message="Password updated successfully.")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        ) from exc


@router.post(
    "/accept-terms",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
async def accept_terms(
    payload: AcceptTermsRequest,
    current_user: User = Depends(get_current_user),
    auth_service: DBAuthService = Depends(get_auth_service)
) -> UserResponse:
    """Accept the terms of use for the current user."""
    if not payload.accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Terms must be accepted to continue using the system"
        )

    try:
        updated_user = auth_service.accept_terms(current_user.id)
        return _to_user_response(updated_user)
    except AuthServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        ) from exc
