"""Authentication-related API endpoints."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import (
    AuthService,
    AuthServiceError,
    EmailService,
    EmailServiceError,
    InvalidCredentialsError,
    PasswordResetService,
    PasswordResetServiceError,
    UserInactiveError,
    UserRecord,
    get_auth_service,
    get_current_user,
    get_jwt_service,
)
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

_auth_service = get_auth_service()
_jwt_service = get_jwt_service()
_email_service = EmailService()
_password_reset_service = PasswordResetService(
    auth_service=_auth_service,
    email_service=_email_service,
)


def _to_user_response(record: UserRecord) -> UserResponse:
    return UserResponse(
        id=record.id,
        username=record.username,
        email=record.email,
        created_at=record.created_at,
        is_active=record.is_active,
        terms_accepted_at=record.terms_accepted_at,
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate) -> UserResponse:
    """Register a new user account."""
    try:
        user = _auth_service.register_user(payload.username, payload.email, payload.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except AuthServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_user_response(user)


@router.post("/login", response_model=Token)
async def login(payload: UserLogin) -> Token:
    """Authenticate user and issue a JWT access token."""
    try:
        user = _auth_service.authenticate_user(payload.username, payload.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except UserInactiveError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    access_token = _jwt_service.create_token_for_user(user)
    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: UserRecord = Depends(get_current_user)) -> UserResponse:
    """Return the authenticated user's profile."""
    return _to_user_response(current_user)


@router.post(
    "/password-reset/request",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def request_password_reset(payload: PasswordResetRequest) -> MessageResponse:
    """Initiate password reset by sending an email with a secure token."""
    try:
        _password_reset_service.initiate_reset(payload.email)
    except EmailServiceError as exc:
        logger.error("Failed to send password reset email: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset email could not be sent. Contact support."
        ) from exc
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
async def confirm_password_reset(payload: PasswordResetConfirmRequest) -> MessageResponse:
    """Confirm password reset using token and set a new password."""
    try:
        _password_reset_service.reset_password(payload.token, payload.new_password)
    except PasswordResetServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        ) from exc
    return MessageResponse(message="Password updated successfully.")


@router.post(
    "/accept-terms",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
async def accept_terms(
    payload: AcceptTermsRequest,
    current_user: UserRecord = Depends(get_current_user),
) -> UserResponse:
    """Accept the terms of use for the current user."""
    if not payload.accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Terms must be accepted to continue using the system"
        )

    try:
        updated_user = _auth_service.accept_terms(current_user.id)
        return UserResponse(
            id=updated_user.id,
            username=updated_user.username,
            email=updated_user.email,
            created_at=updated_user.created_at,
            is_active=updated_user.is_active,
            terms_accepted_at=updated_user.terms_accepted_at,
        )
    except AuthServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        ) from exc

