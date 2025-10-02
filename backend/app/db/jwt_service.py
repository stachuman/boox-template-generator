"""
JWT token service for authentication.

Handles creation and validation of JWT access tokens.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt

from .models import User
from ..config import settings


class TokenServiceError(Exception):
    """Base exception for token management failures."""


class InvalidTokenError(TokenServiceError):
    """Raised when a token is invalid or expired."""


class JWTService:
    """Handle JWT creation and validation for API authentication."""

    def __init__(
        self,
        secret_key: Optional[str] = None,
        algorithm: Optional[str] = None,
        access_token_ttl: Optional[timedelta] = None,
    ):
        self.secret_key = secret_key or settings.JWT_SECRET_KEY
        self.algorithm = algorithm or settings.JWT_ALGORITHM
        self.access_token_ttl = access_token_ttl or timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    def create_access_token(
        self,
        subject: str,
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """
        Create JWT access token.

        Args:
            subject: User ID to encode in token
            expires_delta: Optional custom expiration time

        Returns:
            Encoded JWT token string
        """
        if not subject:
            raise TokenServiceError("Token subject cannot be empty")

        expire_at = datetime.now(timezone.utc) + (
            expires_delta or self.access_token_ttl
        )

        payload = {
            "sub": subject,
            "exp": int(expire_at.timestamp()),
        }

        try:
            return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
        except Exception as exc:
            raise TokenServiceError(f"Failed to encode JWT: {exc}") from exc

    def create_token_for_user(self, user: User) -> str:
        """
        Create access token for a user.

        Args:
            user: User model instance

        Returns:
            JWT token string
        """
        return self.create_access_token(user.id)

    def decode_access_token(self, token: str) -> dict:
        """
        Decode and validate JWT token.

        Args:
            token: JWT token string

        Returns:
            Decoded payload dictionary

        Raises:
            InvalidTokenError: If token is invalid or expired
        """
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm]
            )
        except JWTError as exc:
            raise InvalidTokenError("Invalid or expired token") from exc

        sub = payload.get("sub")
        exp = payload.get("exp")

        if not sub or not exp:
            raise InvalidTokenError("Token payload missing required claims")

        return {"sub": str(sub), "exp": int(exp)}


# Global JWT service instance
_jwt_service: Optional[JWTService] = None


def get_jwt_service() -> JWTService:
    """Get or create global JWT service instance."""
    global _jwt_service
    if _jwt_service is None:
        _jwt_service = JWTService()
    return _jwt_service
