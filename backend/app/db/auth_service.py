"""
Database-backed authentication service for multi-user system.

Migrates from JSON file storage to SQLAlchemy database.
Follows CLAUDE.md: No dummy implementations, explicit error handling.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from pydantic import EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import User, PasswordResetToken
from ..config import settings

logger = logging.getLogger(__name__)


# ----------------------
# Exceptions
# ----------------------


class AuthServiceError(Exception):
    """Base exception for authentication service errors."""


class UserAlreadyExistsError(AuthServiceError):
    """Raised when attempting to create a user that already exists."""


class UserNotFoundError(AuthServiceError):
    """Raised when a requested user cannot be found."""


class InvalidCredentialsError(AuthServiceError):
    """Raised when provided credentials are invalid."""


class UserInactiveError(AuthServiceError):
    """Raised when trying to authenticate an inactive user."""


# ----------------------
# Database Auth Service
# ----------------------


class DBAuthService:
    """Database-backed authentication service using SQLAlchemy."""

    def __init__(self, db: Session):
        self.db = db

    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt with 12 rounds."""
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            raise AuthServiceError(
                f"Password is too long ({len(password_bytes)} bytes). "
                "Passwords must be 72 bytes or less when encoded as UTF-8."
            )
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

    def verify_password(self, password: str, password_hash: str) -> bool:
        """Verify password against bcrypt hash."""
        try:
            password_bytes = password.encode('utf-8')
            hash_bytes = password_hash.encode('utf-8')
            return bcrypt.checkpw(password_bytes, hash_bytes)
        except (ValueError, UnicodeError):
            return False

    def register_user(self, username: str, email: EmailStr, password: str) -> User:
        """Register a new user account."""
        cleaned_username = username.strip()
        if not cleaned_username:
            raise AuthServiceError("Username cannot be blank")

        # Check for existing user (case-insensitive)
        from sqlalchemy import func

        existing_email = self.db.execute(
            select(User).where(User.email == email.lower())
        ).scalar_one_or_none()

        if existing_email is not None:
            raise UserAlreadyExistsError(f"User with email {email} already exists")

        existing_username = self.db.execute(
            select(User).where(func.lower(User.username) == cleaned_username.lower())
        ).scalar_one_or_none()

        if existing_username is not None:
            raise UserAlreadyExistsError(f"Username {cleaned_username} already exists")

        if len(password) < 8:
            raise AuthServiceError("Password must be at least 8 characters long")

        # Create new user
        user_id = secrets.token_hex(16)
        now = datetime.now(timezone.utc)

        user = User(
            id=user_id,
            username=cleaned_username,
            email=email.lower(),
            password_hash=self.hash_password(password),
            is_active=True,
            created_at=now,
            updated_at=now
        )

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        return user

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email address."""
        normalized = email.strip().lower()
        return self.db.execute(
            select(User).where(User.email == normalized)
        ).scalar_one_or_none()

    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username (case-insensitive)."""
        normalized = username.strip()
        # Use func.lower for case-insensitive comparison
        from sqlalchemy import func
        return self.db.execute(
            select(User).where(func.lower(User.username) == normalized.lower())
        ).scalar_one_or_none()

    def get_user_by_id(self, user_id: str) -> User:
        """Get user by ID, raises UserNotFoundError if not found."""
        user = self.db.execute(
            select(User).where(User.id == user_id)
        ).scalar_one_or_none()

        if user is None:
            raise UserNotFoundError(f"User {user_id} not found")

        return user

    def authenticate_user(self, username: str, password: str) -> User:
        """Authenticate user with username and password."""
        user = self.get_user_by_username(username)

        if user is None:
            raise InvalidCredentialsError("Invalid username or password")

        if not user.is_active:
            raise UserInactiveError(f"User {username} is inactive")

        if not self.verify_password(password, user.password_hash):
            raise InvalidCredentialsError("Invalid username or password")

        return user

    def update_user_password(self, user_id: str, new_password: str) -> None:
        """Update a user's password."""
        user = self.get_user_by_id(user_id)

        if len(new_password) < 8:
            raise AuthServiceError("Password must be at least 8 characters long")

        # Check bcrypt length limit before hashing
        password_bytes = new_password.encode('utf-8')
        if len(password_bytes) > 72:
            raise AuthServiceError(
                f"Password is too long ({len(password_bytes)} bytes). "
                "Passwords must be 72 bytes or less when encoded as UTF-8."
            )

        user.password_hash = self.hash_password(new_password)
        user.updated_at = datetime.now(timezone.utc)

        self.db.commit()

    def accept_terms(self, user_id: str) -> User:
        """Mark that a user has accepted the terms of use."""
        user = self.get_user_by_id(user_id)

        user.terms_accepted_at = datetime.now(timezone.utc)
        user.updated_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(user)

        return user


# ----------------------
# Password Reset Service
# ----------------------


class PasswordResetServiceError(Exception):
    """Raised when password reset workflow fails."""


class DBPasswordResetService:
    """Database-backed password reset service."""

    def __init__(self, db: Session, auth_service: DBAuthService):
        self.db = db
        self.auth_service = auth_service
        # Default to 60 minutes if not configured
        ttl_minutes = getattr(settings, 'PASSWORD_RESET_TTL_MINUTES', 60)
        self.token_ttl = timedelta(minutes=ttl_minutes)

    @staticmethod
    def _hash_token(token: str) -> str:
        """Hash token using SHA256."""
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def _purge_expired_tokens(self, now: datetime) -> None:
        """Remove expired password reset tokens."""
        self.db.query(PasswordResetToken).filter(
            PasswordResetToken.expires_at <= now
        ).delete()
        self.db.commit()

    def _remove_tokens_for_user(self, user_id: str) -> None:
        """Remove all password reset tokens for a user."""
        self.db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user_id
        ).delete()
        self.db.commit()

    @staticmethod
    def _validate_password(password: str) -> None:
        """Validate password meets requirements."""
        if len(password) < 8:
            raise PasswordResetServiceError("Password must be at least 8 characters long")
        if password.strip() == "":
            raise PasswordResetServiceError("Password cannot be blank")

    def initiate_reset(self, email: str) -> tuple[Optional[str], Optional[datetime], Optional[str]]:
        """
        Initiate password reset for email address.

        Returns:
            (token_value, expires_at, recipient_email) tuple if user exists, else (None, None, None)
        """
        now = datetime.now(timezone.utc)
        self._purge_expired_tokens(now)

        user = self.auth_service.get_user_by_email(email)

        if user is None or not user.is_active:
            logger.info("Password reset requested for unknown or inactive email %s", email)
            return (None, None, None)

        # Remove existing tokens for this user
        self._remove_tokens_for_user(user.id)

        # Generate new token
        token_value = secrets.token_urlsafe(48)
        token_hash = self._hash_token(token_value)
        expires_at = now + self.token_ttl

        reset_token = PasswordResetToken(
            token_hash=token_hash,
            user_id=user.id,
            email=user.email,
            created_at=now,
            expires_at=expires_at
        )

        self.db.add(reset_token)
        self.db.commit()

        return (token_value, expires_at, user.email)

    def reset_password(self, token: str, new_password: str) -> None:
        """Reset password using a valid token."""
        token = token.strip()
        if not token:
            raise PasswordResetServiceError("Password reset token must be provided")

        self._validate_password(new_password)

        token_hash = self._hash_token(token)
        now = datetime.now(timezone.utc)

        # Purge expired tokens
        self._purge_expired_tokens(now)

        # Find token record
        reset_token = self.db.execute(
            select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
        ).scalar_one_or_none()

        if reset_token is None or reset_token.expires_at <= now:
            # Clean up if found but expired
            if reset_token:
                self.db.delete(reset_token)
                self.db.commit()
            raise PasswordResetServiceError("Password reset token is invalid or has expired")

        user_id = reset_token.user_id

        # Delete the token (one-time use)
        self.db.delete(reset_token)
        self.db.commit()

        # Update password
        try:
            self.auth_service.update_user_password(user_id, new_password)
        except AuthServiceError as exc:
            raise PasswordResetServiceError(str(exc)) from exc
