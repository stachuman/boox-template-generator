"""
Application configuration with environment-based settings.

Centralizes all configuration values with sensible defaults for development.
Production values should be set via environment variables.
Follows CLAUDE.md: No dummy implementations, explicit validation.
"""

from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    # Application
    APP_NAME: str = "einkpdf"
    APP_VERSION: str = "0.4.0"
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
    PDF_PREVIEW_RATE_LIMIT: str = "30/minute"
    IMAGE_UPLOAD_RATE_LIMIT: str = "20/minute"
    PROJECT_CREATE_RATE_LIMIT: str = "30/minute"
    GLOBAL_RATE_LIMIT: str = "100/minute"

    # Job Management
    JOB_RETENTION_HOURS: int = 24
    JOB_CLEANUP_INTERVAL_HOURS: int = 6

    # Authentication
    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 90
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_RESET_TTL_MINUTES: int = 60  # Password reset token validity

    # User Migration
    AUTH_LEGACY_FALLBACK: bool = False  # Enable during user migration

    # User Quotas (per tier)
    FREE_TIER_MAX_PROJECTS: int = 100
    FREE_TIER_MAX_STORAGE_MB: int = 100
    FREE_TIER_MAX_IMAGES: int = 50
    FREE_TIER_MAX_PDF_JOBS_PER_DAY: int = 100

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

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


# Global settings instance
settings = Settings()

# Ensure directories exist on import
settings.ensure_directories()
