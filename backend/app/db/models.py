"""
SQLAlchemy database models for multi-user e-ink PDF system.

All models use declarative base and follow CLAUDE.md standards.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship

from . import Base


def utc_now() -> datetime:
    """Get current UTC timestamp."""
    return datetime.now(timezone.utc)


class User(Base):
    """User account table."""

    __tablename__ = "users"

    id = Column(String(32), primary_key=True)  # 32-char hex token
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    terms_accepted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    assets = relationship("Asset", back_populates="owner", cascade="all, delete-orphan")
    pdf_jobs = relationship("PDFJob", back_populates="owner", cascade="all, delete-orphan")
    public_projects = relationship("PublicProject", back_populates="owner", cascade="all, delete-orphan")
    password_resets = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username={self.username})>"


class Project(Base):
    """User project table."""

    __tablename__ = "projects"

    id = Column(String(32), primary_key=True)
    owner_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=False, default="")
    device_profile = Column(String(50), nullable=False)
    metadata_json = Column(Text, nullable=False)  # JSON serialized project metadata
    plan_yaml = Column(Text, nullable=True)  # YAML plan content
    version = Column(Integer, nullable=False, default=1)  # For optimistic locking
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    owner = relationship("User", back_populates="projects")

    # Indexes for common queries
    __table_args__ = (
        Index("ix_projects_owner_updated", "owner_id", "updated_at"),
    )

    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name={self.name}, owner_id={self.owner_id})>"


class Asset(Base):
    """User-uploaded assets (images)."""

    __tablename__ = "assets"

    id = Column(String(64), primary_key=True)  # SHA256 hash of content
    owner_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(50), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    file_path = Column(String(512), nullable=False)  # Relative path in storage/assets
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    # Relationships
    owner = relationship("User", back_populates="assets")

    # Indexes
    __table_args__ = (
        Index("ix_assets_owner_created", "owner_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Asset(id={self.id}, filename={self.filename}, owner_id={self.owner_id})>"


class PDFJob(Base):
    """PDF generation job tracking."""

    __tablename__ = "pdf_jobs"

    id = Column(String(32), primary_key=True)
    owner_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(String(32), nullable=True)  # Optional link to project
    status = Column(String(20), nullable=False, default="pending")  # pending, running, completed, failed
    error_message = Column(Text, nullable=True)
    output_path = Column(String(512), nullable=True)  # Relative path in storage/jobs
    size_bytes = Column(Integer, nullable=True)
    page_count = Column(Integer, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    diagnostics = Column(Text, nullable=True)  # JSON payload with compile/render diagnostics

    # Relationships
    owner = relationship("User", back_populates="pdf_jobs")

    # Indexes for job queries
    __table_args__ = (
        Index("ix_pdf_jobs_owner_status", "owner_id", "status"),
        Index("ix_pdf_jobs_created", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<PDFJob(id={self.id}, status={self.status}, owner_id={self.owner_id})>"


class PublicProject(Base):
    """Public project index for sharing/cloning."""

    __tablename__ = "public_projects"

    id = Column(String(32), primary_key=True)  # Same as project ID
    owner_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_username = Column(String(50), nullable=False)
    metadata_json = Column(Text, nullable=False)  # JSON serialized metadata
    url_slug = Column(String(80), unique=True, nullable=True, index=True)
    clone_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    owner = relationship("User", back_populates="public_projects")

    def __repr__(self) -> str:
        return f"<PublicProject(id={self.id}, slug={self.url_slug})>"


class PasswordResetToken(Base):
    """Password reset token tracking."""

    __tablename__ = "password_reset_tokens"

    token_hash = Column(String(64), primary_key=True)  # SHA256 hash
    user_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    # Relationships
    user = relationship("User", back_populates="password_resets")

    # Index for cleanup queries
    __table_args__ = (
        Index("ix_password_resets_expires", "expires_at"),
    )

    def __repr__(self) -> str:
        return f"<PasswordResetToken(user_id={self.user_id}, expires_at={self.expires_at})>"


class UserQuota(Base):
    """User resource usage tracking for quotas."""

    __tablename__ = "user_quotas"

    user_id = Column(String(32), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    project_count = Column(Integer, nullable=False, default=0)
    asset_count = Column(Integer, nullable=False, default=0)
    storage_bytes = Column(Integer, nullable=False, default=0)
    pdf_jobs_today = Column(Integer, nullable=False, default=0)
    quota_reset_date = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    def __repr__(self) -> str:
        return f"<UserQuota(user_id={self.user_id}, projects={self.project_count})>"
