#!/usr/bin/env python3
"""Self-check for container startup: schema migration and JWT secret resolution.

Run inside the backend image (it has alembic/sqlalchemy; the host may not):
    docker run --rm --entrypoint python3 -v "$PWD/backend:/app/backend" \
        eink-backend:latest scripts/check_startup.py
"""
import os
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
HEAD = "5c1d9e7a2f40"


def run(args, db, extra_env=None):
    """Run python with DATABASE_URL pointed at db; return stdout."""
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{db}", **(extra_env or {})}
    return subprocess.run(
        [sys.executable, *args], cwd=db.parent, env=env,
        check=True, capture_output=True, text=True,
    ).stdout


def alembic(db, *args):
    run(["-m", "alembic", "-c", str(BACKEND / "alembic.ini"), *args], db)


def sql(db, statement):
    conn = sqlite3.connect(db)
    rows = conn.execute(statement).fetchall()
    conn.commit()
    conn.close()
    return rows


def columns(db, table):
    return {row[1] for row in sql(db, f"PRAGMA table_info({table})")}


def add_is_admin(db):
    # What the old entrypoint heredoc did to running deployments.
    sql(db, "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0")


SCENARIOS = {
    "fresh database": lambda db: None,
    "pre-alembic, initial schema": lambda db: (
        alembic(db, "upgrade", "29e8204f390a"),
        sql(db, "DROP TABLE alembic_version"),
    ),
    "pre-alembic, diagnostics + is_admin": lambda db: (
        alembic(db, "upgrade", "3b2e8a4f1d6b"),
        add_is_admin(db),
        sql(db, "DROP TABLE alembic_version"),
    ),
    "alembic-tracked, is_admin added by old entrypoint": lambda db: (
        alembic(db, "upgrade", "3b2e8a4f1d6b"),
        add_is_admin(db),
    ),
}


def check_migrations():
    for name, setup in SCENARIOS.items():
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "test.sqlite"
            setup(db)
            for _ in range(2):  # second run proves idempotence
                run([str(BACKEND / "scripts" / "migrate.py")], db)
            assert sql(db, "SELECT version_num FROM alembic_version") == [(HEAD,)], name
            assert "is_admin" in columns(db, "users"), name
            assert "diagnostics" in columns(db, "pdf_jobs"), name
            print(f"ok  migrate: {name}")


DEV_SECRET = "dev-secret-key-change-in-production"


def jwt_secret(tmp, **env):
    code = f"import sys; sys.path.insert(0, {str(BACKEND)!r}); from app.config import settings; print(settings.JWT_SECRET_KEY)"
    return run(["-c", code], Path(tmp) / "test.sqlite", env).strip()


def check_jwt_secret():
    with tempfile.TemporaryDirectory() as tmp:
        secret_file = Path(tmp) / "jwt_secret.txt"
        secret_file.write_text("from-file\n")
        missing = str(Path(tmp) / "missing.txt")
        # compose forwards ${JWT_SECRET_KEY:-}, so "" must mean "unset", never a usable secret
        assert jwt_secret(tmp, JWT_SECRET_KEY="", JWT_SECRET_KEY_FILE=str(secret_file)) == "from-file"
        assert jwt_secret(tmp, JWT_SECRET_KEY="   ", JWT_SECRET_KEY_FILE=str(secret_file)) == "from-file"
        assert jwt_secret(tmp, JWT_SECRET_KEY="", JWT_SECRET_KEY_FILE=missing) == DEV_SECRET
        assert jwt_secret(tmp, JWT_SECRET_KEY="explicit", JWT_SECRET_KEY_FILE=str(secret_file)) == "explicit"
        print("ok  jwt secret resolution")


if __name__ == "__main__":
    check_migrations()
    check_jwt_secret()
