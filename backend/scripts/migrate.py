#!/usr/bin/env python3
"""Bring the database schema to alembic head. Called by docker-entrypoint.sh.

Databases created before alembic was wired in (tables via create_all, no
alembic_version table) are first stamped at the revision their schema matches.
"""
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import create_engine, inspect  # noqa: E402

from app.config import settings  # noqa: E402

INITIAL = "29e8204f390a"
DIAGNOSTICS = "3b2e8a4f1d6b"


def legacy_revision() -> str | None:
    """Revision a pre-alembic database matches; None if alembic can handle it as-is."""
    engine = create_engine(settings.DATABASE_URL)
    try:
        insp = inspect(engine)
        tables = insp.get_table_names()
        if "alembic_version" in tables or "users" not in tables:
            return None
        pdf_job_columns = {c["name"] for c in insp.get_columns("pdf_jobs")}
        return DIAGNOSTICS if "diagnostics" in pdf_job_columns else INITIAL
    finally:
        engine.dispose()


def main() -> None:
    cfg = Config(str(BACKEND / "alembic.ini"))
    revision = legacy_revision()
    if revision:
        print(f"Pre-alembic database detected; stamping {revision}")
        command.stamp(cfg, revision)
    command.upgrade(cfg, "head")


if __name__ == "__main__":
    main()
