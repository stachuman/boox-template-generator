"""
FastAPI dependencies for database services.

Provides dependency injection for auth services, database sessions, etc.
"""

from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from .auth_service import (
    DBAuthService,
    DBPasswordResetService,
    UserNotFoundError,
)
from .models import User
from . import get_db
from ..config import settings
from ..models import TokenPayload

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_auth_service(db: Session = Depends(get_db)) -> DBAuthService:
    """
    Dependency to get database-backed auth service.

    Usage:
        @app.post("/register")
        def register(auth: DBAuthService = Depends(get_auth_service)):
            user = auth.register_user(...)
    """
    return DBAuthService(db)


def get_password_reset_service(
    db: Session = Depends(get_db),
    auth_service: DBAuthService = Depends(get_auth_service)
) -> DBPasswordResetService:
    """Dependency to get password reset service."""
    return DBPasswordResetService(db, auth_service)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get current authenticated user from JWT token.

    Raises:
        HTTPException 401: If token is invalid or user not found
        HTTPException 403: If user is inactive

    Usage:
        @app.get("/me")
        def get_profile(user: User = Depends(get_current_user)):
            return {"username": user.username}
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Decode JWT token
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    # Get user from database
    auth_service = DBAuthService(db)
    try:
        user = auth_service.get_user_by_id(user_id)
    except UserNotFoundError:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Dependency to get current active user.

    This is a convenience wrapper around get_current_user
    that explicitly checks is_active (though get_current_user already does this).
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user
