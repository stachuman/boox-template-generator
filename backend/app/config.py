"""
Application configuration with environment-based settings.

Centralizes all configuration values with sensible defaults for development.
Production values should be set via environment variables.
Follows CLAUDE.md: No dummy implementations, explicit validation.
"""

import logging
import os
from pathlib import Path
from typing import Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    # Application
    APP_NAME: str = "einkpdf"
    APP_VERSION: str = "0.8.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite:///data/einkpdf.sqlite"
    DB_ECHO: bool = False  # SQLAlchemy query logging

    # Storage Paths (relative to backend working directory)
    STORAGE_DIR: Path = Path("data")
    ASSETS_DIR: Path = Path("data/assets")
    JOBS_DIR: Path = Path("data/jobs")

    # PDF Generation Limits
    MAX_PDF_PAGES: int = 1000
    MAX_PDF_SIZE_MB: int = 50
    PDF_TIMEOUT_SECONDS: int = 600  # 10 minutes
    MAX_PDF_MEMORY_MB: int = 2048  # 2GB per process

    # Image Upload Limits
    MAX_IMAGE_SIZE_BYTES: int = 512 * 1024  # 0.5MB
    ALLOWED_IMAGE_TYPES: set[str] = {'image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'}

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    PDF_GENERATE_RATE_LIMIT: str = "10/minute"
    PROJECT_CREATE_RATE_LIMIT: str = "30/minute"

    # Auth-specific limits — tighter to slow brute force without blocking real
    # users. Login is intentionally lower than reset because reset costs more
    # (sends email) and is more attractive for enumeration.
    LOGIN_RATE_LIMIT: str = "10/minute"
    REGISTER_RATE_LIMIT: str = "5/minute"
    PASSWORD_RESET_REQUEST_RATE_LIMIT: str = "3/minute"
    PASSWORD_RESET_CONFIRM_RATE_LIMIT: str = "10/minute"

    # WebSocket preview caps. The endpoint is intentionally anonymous (the
    # public gallery needs to render previews for non-logged-in users), so we
    # defend with payload caps + per-connection rate limit + render timeout.
    WS_MAX_YAML_BYTES: int = 256 * 1024  # 256 KB per preview submission
    WS_PREVIEW_REQUESTS_PER_MINUTE: int = 30  # per open connection
    WS_MAX_CONNECTIONS_PER_IP: int = 10
    WS_PREVIEW_TIMEOUT_SECONDS: int = 30

    # Job Management
    JOB_RETENTION_HOURS: int = 24
    JOB_CLEANUP_INTERVAL_HOURS: int = 6

    # Authentication
    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production"
    # Path to a file whose contents become JWT_SECRET_KEY. Useful when the
    # secret is mounted as a Docker secret or stored on a volume that the
    # legacy auth.py also reads (EINK_JWT_SECRET_FILE). Used only when
    # JWT_SECRET_KEY itself is still the dev default.
    JWT_SECRET_KEY_FILE: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 90
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_RESET_TTL_MINUTES: int = 60  # Password reset token validity

    # Default value the JWT secret must NOT have in production.
    _DEV_JWT_SECRET_KEY: str = "dev-secret-key-change-in-production"

    # User Migration
    AUTH_LEGACY_FALLBACK: bool = False  # Enable during user migration

    # User Quotas (per tier)
    FREE_TIER_MAX_PROJECTS: int = 100
    FREE_TIER_MAX_STORAGE_MB: int = 100
    FREE_TIER_MAX_IMAGES: int = 50
    FREE_TIER_MAX_PDF_JOBS_PER_DAY: int = 100

    # CORS — defaults cover dev (Vite + alternate port) and the deployed
    # public site. Prod can override via the CORS_ORIGINS env var.
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://eink.cgpsmapper.com",
    ]

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json or text

    # Monitoring
    METRICS_ENABLED: bool = True
    SENTRY_DSN: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

    @model_validator(mode="after")
    def _resolve_jwt_secret_from_file(self) -> "Settings":
        """Replace the dev-default JWT_SECRET_KEY with file contents if available.

        Honors two env vars: the canonical JWT_SECRET_KEY_FILE plus the legacy
        EINK_JWT_SECRET_FILE used by the older auth.py. An explicit
        JWT_SECRET_KEY env value always wins — file resolution is only the
        fallback for the dev default.
        """
        # An empty value (e.g. compose's ${JWT_SECRET_KEY:-}) means "unset":
        # fall back to the file, and keep assert_production_safe effective.
        if not self.JWT_SECRET_KEY:
            object.__setattr__(self, "JWT_SECRET_KEY", self._DEV_JWT_SECRET_KEY)
        if self.JWT_SECRET_KEY != self._DEV_JWT_SECRET_KEY:
            return self

        path_str = self.JWT_SECRET_KEY_FILE or os.getenv("EINK_JWT_SECRET_FILE")
        if not path_str:
            return self

        path = Path(path_str)
        if not path.is_file():
            logger.warning(
                "JWT secret file '%s' not found; JWT_SECRET_KEY remains the dev default",
                path,
            )
            return self

        try:
            secret = path.read_text(encoding="utf-8").strip()
        except OSError as exc:
            logger.error("Failed to read JWT secret file '%s': %s", path, exc)
            return self

        if not secret:
            logger.warning("JWT secret file '%s' is empty; ignoring", path)
            return self

        # Settings is mutable, but we use object.__setattr__ to be explicit
        # about bypassing any future validation guard.
        object.__setattr__(self, "JWT_SECRET_KEY", secret)
        return self

    def ensure_directories(self) -> None:
        """Create required storage directories if they don't exist."""
        self.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        self.ASSETS_DIR.mkdir(parents=True, exist_ok=True)
        self.JOBS_DIR.mkdir(parents=True, exist_ok=True)

        # Create .gitkeep files
        (self.STORAGE_DIR / ".gitkeep").touch(exist_ok=True)
        (self.ASSETS_DIR / ".gitkeep").touch(exist_ok=True)
        (self.JOBS_DIR / ".gitkeep").touch(exist_ok=True)

    @property
    def database_path(self) -> Path:
        """Get absolute path to database file."""
        if self.DATABASE_URL.startswith("sqlite:///"):
            db_path = self.DATABASE_URL.replace("sqlite:///", "")
            return Path(db_path)
        raise ValueError(f"Unsupported database URL: {self.DATABASE_URL}")

    def assert_production_safe(self) -> None:
        """Refuse to run with insecure defaults when DEBUG is off.

        Called from the FastAPI startup hook. CLAUDE.md rule #3: fail fast,
        loud, and with a specific message.
        """
        if self.DEBUG:
            return
        if self.JWT_SECRET_KEY == self._DEV_JWT_SECRET_KEY:
            raise RuntimeError(
                "JWT_SECRET_KEY is still the development default. "
                "Set the JWT_SECRET_KEY environment variable to a strong "
                "random value before running with DEBUG=False."
            )


# Global settings instance
settings = Settings()

# Ensure directories exist on import
settings.ensure_directories()
