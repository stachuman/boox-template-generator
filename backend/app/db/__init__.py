"""
Database initialization and session management.

Uses SQLAlchemy with SQLite in WAL mode for multi-user concurrency.
Follows CLAUDE.md: No dummy implementations, explicit error handling.
"""

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from ..config import settings

# SQLAlchemy base for all models
Base = declarative_base()

# Create engine with connection pooling
# SQLite-specific settings for concurrency
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    connect_args={
        "check_same_thread": False,  # Allow multi-threaded access
        "timeout": 30.0,  # 30 second busy timeout
    },
    pool_pre_ping=True,  # Verify connections before using
    pool_size=10,  # Connection pool size
    max_overflow=20,  # Additional connections beyond pool_size
)


# Enable WAL mode for better concurrency
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """Configure SQLite for optimal concurrent access."""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")  # Write-Ahead Logging
    cursor.execute("PRAGMA busy_timeout=30000")  # 30 second timeout
    cursor.execute("PRAGMA synchronous=NORMAL")  # Balance safety/performance
    cursor.execute("PRAGMA foreign_keys=ON")  # Enable foreign key constraints
    cursor.close()


# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency for FastAPI routes to get database session.

    Usage:
        @app.get("/items")
        def read_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """
    Context manager for database sessions outside of FastAPI routes.

    Usage:
        with get_db_context() as db:
            user = db.query(User).filter_by(email=email).first()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Initialize database schema.

    Creates all tables defined in models.
    Should be called on application startup or via migration tool.
    """
    # Import all models to register them with Base
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
