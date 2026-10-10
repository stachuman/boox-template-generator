#!/bin/bash
set -e

echo "Running database migrations..."
python3 /app/backend/scripts/migrate.py

echo "Starting application..."
exec "$@"
