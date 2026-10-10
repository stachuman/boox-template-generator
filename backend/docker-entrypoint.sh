#!/bin/bash
set -e

# Generate a JWT secret on first run unless one is supplied directly.
# An existing file (e.g. from earlier deployments) is always reused.
if [ -z "${JWT_SECRET_KEY:-}" ] && [ -n "${JWT_SECRET_KEY_FILE:-}" ] && [ ! -s "$JWT_SECRET_KEY_FILE" ]; then
    mkdir -p "$(dirname "$JWT_SECRET_KEY_FILE")"
    (umask 077 && python3 -c 'import secrets; print(secrets.token_hex(32))' > "$JWT_SECRET_KEY_FILE")
    echo "Generated JWT secret at $JWT_SECRET_KEY_FILE"
fi

echo "Running database migrations..."
python3 /app/backend/scripts/migrate.py

echo "Starting application..."
exec "$@"
