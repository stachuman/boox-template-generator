#!/bin/bash
set -e

echo "Running database migrations..."

# Run migration: Add is_admin column if it doesn't exist
python3 << 'PYTHON_SCRIPT'
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path('/app/backend')))

from app.db import get_db_context
from sqlalchemy import text

print("Checking database schema...")

with get_db_context() as db:
    # Check if is_admin column exists
    result = db.execute(text('PRAGMA table_info(users)'))
    columns = [row[1] for row in result.fetchall()]

    if 'is_admin' not in columns:
        print('  - Adding is_admin column to users table...')
        db.execute(text('ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0'))
        db.commit()
        print('  ✓ Migration completed successfully')
    else:
        print('  ✓ Database schema is up to date')

print("Database migrations complete!")
PYTHON_SCRIPT

echo "Starting application..."
exec "$@"
