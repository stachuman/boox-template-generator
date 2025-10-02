  Docker working directory: /app/backend (set by Dockerfile)

  Migration script paths:
  - data/users/ → /app/backend/data/users/ ✅
  - data/users/backup/ → /app/backend/data/users/backup/ ✅

  Database path:
  - sqlite:///data/einkpdf.sqlite → /app/backend/data/einkpdf.sqlite ✅

  Workspace data root:
  - Uses EINK_DATA_DIR=/app/backend/data (from docker-compose.yml) ✅
  - All user projects accessible at /app/backend/data/users/{user_id}/projects/ ✅

  Production Migration Steps

  # 1. Dry run to preview (safe, no changes)
  docker-compose exec backend python migrate_users_to_db.py --dry-run

  # 2. Run actual migration
  docker-compose exec backend python migrate_users_to_db.py

  # 3. Verify migration
  docker-compose exec backend sqlite3 /app/backend/data/einkpdf.sqlite "SELECT username FROM users"

  # 4. Test login via API
  curl -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"USERNAME","password":"PASSWORD"}'

  What Gets Backed Up

  Backup created at: /app/backend/data/users/backup/users_TIMESTAMP.json

  This is inside the Docker volume, so it persists across container restarts.

