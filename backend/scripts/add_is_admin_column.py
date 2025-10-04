#!/usr/bin/env python3
"""
Migration script to add is_admin column to users table.

Usage:
    python backend/scripts/add_is_admin_column.py
"""

import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

import os
os.chdir(backend_path)

from app.db import get_db_context
from sqlalchemy import text


def migrate():
    """Add is_admin column to users table."""
    with get_db_context() as session:
        try:
            # For SQLite, check if column exists by querying table info
            result = session.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]

            if 'is_admin' in columns:
                print("✓ Column is_admin already exists")
                return

            # Add column
            print("Adding is_admin column to users table...")
            session.execute(text(
                "ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0"
            ))
            session.commit()
            print("✓ Migration completed successfully")

        except Exception as e:
            session.rollback()
            print(f"✗ Migration failed: {e}")
            raise


if __name__ == "__main__":
    migrate()
