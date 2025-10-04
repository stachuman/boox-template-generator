# Phase 0 Implementation Summary

## Overview
Successfully implemented the foundation for multi-user system with SQLite database backend.

## Completed Tasks

### 1. Configuration System
**File:** `backend/app/config.py`

- Created centralized configuration using `pydantic-settings`
- Environment variable support with `.env` file
- Key configurations:
  - Database: `sqlite:///storage/einkpdf.sqlite`
  - Storage paths: `storage/`, `storage/assets/`, `storage/jobs/`
  - PDF limits: 1000 pages, 50MB, 10min timeout
  - Image limits: 0.5MB, PNG/JPEG/SVG support
  - Rate limits: 10 PDFs/min, 20 uploads/min, 30 previews/min
  - User quotas: 100 projects, 100MB storage, 50 images

### 2. Storage Directory Structure
**Directories created:**
- `storage/` - Root storage directory
- `storage/assets/` - User-uploaded images
- `storage/jobs/` - Generated PDF outputs

**Files:**
- `.gitkeep` files to preserve directory structure in git
- Updated `.gitignore` to exclude database files and user uploads

### 3. SQLAlchemy Database Layer
**Files:**
- `backend/app/db/__init__.py` - Database initialization and session management
- `backend/app/db/models.py` - SQLAlchemy ORM models

**Database Features:**
- SQLite with WAL mode for better concurrency
- Connection pooling (10 base, 20 overflow)
- 30-second busy timeout
- Foreign key constraints enabled

**Database Models:**
- `User` - User accounts with authentication
- `Project` - User projects with version tracking (optimistic locking)
- `Asset` - User-uploaded images (content-addressable storage via SHA256)
- `PDFJob` - Async PDF generation job tracking
- `PublicProject` - Public project sharing index
- `PasswordResetToken` - Password reset token management
- `UserQuota` - Resource usage tracking per user

### 4. Alembic Migrations
**Files:**
- `backend/alembic.ini` - Alembic configuration
- `backend/alembic/env.py` - Migration environment (reads from app.config)
- `backend/alembic/versions/29e8204f390a_*.py` - Initial schema migration

**Commands:**
```bash
# Generate migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

### 5. Health Check Endpoint
**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "einkpdf_available": true
}
```

Verifies:
- einkpdf library availability
- Database connectivity

### 6. Docker Configuration
**Files updated:**
- `docker-compose.yml` - Updated environment variables and volume mounts
- `Dockerfile.backend` - Added SQLAlchemy/Alembic, runs migrations on startup

**Key Changes:**
- Unified storage volume: `eink_storage:/app/storage`
- Database configuration via environment variables
- Health check endpoint integration
- Automatic migration on container startup

**Run Command:**
```bash
docker-compose up --build
```

## Database Schema

### Users Table
- `id` (PK): 32-char hex token
- `username`: Unique, indexed
- `email`: Unique, indexed
- `password_hash`: bcrypt hash
- `is_active`: Boolean
- `terms_accepted_at`: Timestamp
- `created_at`, `updated_at`: Timestamps

### Projects Table
- `id` (PK): 32-char identifier
- `owner_id` (FK): References users.id
- `name`: Project name
- `description`: Text
- `device_profile`: Device profile name
- `metadata_json`: JSON serialized metadata
- `plan_yaml`: YAML plan content
- `version`: Integer for optimistic locking
- `created_at`, `updated_at`: Timestamps
- Index: `(owner_id, updated_at)`

### Assets Table
- `id` (PK): SHA256 hash of content (content-addressable)
- `owner_id` (FK): References users.id
- `filename`: Original filename
- `mime_type`: MIME type
- `size_bytes`: File size
- `file_path`: Relative path in storage/assets
- `created_at`: Timestamp
- Index: `(owner_id, created_at)`

### PDFJobs Table
- `id` (PK): 32-char identifier
- `owner_id` (FK): References users.id
- `project_id`: Optional project link
- `status`: pending/running/completed/failed
- `error_message`: Text (nullable)
- `output_path`: Relative path in storage/jobs
- `size_bytes`, `page_count`: Integers (nullable)
- `started_at`, `completed_at`: Timestamps (nullable)
- `created_at`: Timestamp
- Indexes: `(owner_id, status)`, `(created_at)`

### PublicProjects Table
- `id` (PK): Same as project ID
- `owner_id` (FK): References users.id
- `owner_username`: Username
- `metadata_json`: JSON serialized metadata
- `url_slug`: Unique slug (nullable)
- `clone_count`: Integer
- `created_at`, `updated_at`: Timestamps

### PasswordResetTokens Table
- `token_hash` (PK): SHA256 hash
- `user_id` (FK): References users.id
- `email`: Email address
- `created_at`, `expires_at`: Timestamps
- Index: `(expires_at)` for cleanup

### UserQuotas Table
- `user_id` (PK/FK): References users.id
- `project_count`, `asset_count`: Integers
- `storage_bytes`: Integer
- `pdf_jobs_today`: Integer
- `quota_reset_date`: Timestamp
- `updated_at`: Timestamp

## Next Steps - Phase 1

1. **User Migration to SQLAlchemy**
   - Migrate auth.py from JSON files to database
   - Create migration script for existing users
   - Update all authentication endpoints

2. **PDF Job Isolation**
   - Implement multiprocessing-based PDF generation
   - Add process timeout and memory limits
   - Create job queue system

3. **Asset Storage Migration**
   - Replace base64 image_data with file-based storage
   - Implement content-addressable storage (SHA256)
   - Add asset deduplication

4. **Rate Limiting**
   - Install slowapi
   - Add rate limit decorators to endpoints
   - Configure per-endpoint limits

5. **Project Migration**
   - Migrate workspaces.py to SQLAlchemy
   - Update project CRUD operations
   - Implement optimistic locking

## Testing

Verify database setup:
```bash
# Check database exists and has correct mode
sqlite3 storage/einkpdf.sqlite "PRAGMA journal_mode;"  # Should return "wal"

# List tables
sqlite3 storage/einkpdf.sqlite ".tables"

# Test health endpoint
curl http://localhost:8000/health
```

## Environment Variables

Key environment variables for Phase 0:
```bash
# Database
DATABASE_URL=sqlite:///storage/einkpdf.sqlite
DB_ECHO=false

# Application
APP_NAME=einkpdf
APP_VERSION=0.2.1
DEBUG=false

# JWT
JWT_SECRET_KEY=<your-secret-key>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Storage
STORAGE_DIR=storage
ASSETS_DIR=storage/assets
JOBS_DIR=storage/jobs

# Limits
MAX_PDF_PAGES=1000
MAX_PDF_SIZE_MB=50
PDF_TIMEOUT_SECONDS=600
MAX_IMAGE_SIZE_BYTES=524288
```

## Files Created/Modified

**Created:**
- `backend/app/config.py`
- `backend/app/db/__init__.py`
- `backend/app/db/models.py`
- `backend/alembic.ini`
- `backend/alembic/env.py`
- `backend/alembic/versions/29e8204f390a_*.py`
- `storage/.gitkeep`
- `storage/assets/.gitkeep`
- `storage/jobs/.gitkeep`
- `storage/einkpdf.sqlite` (database)

**Modified:**
- `.gitignore`
- `backend/app/main.py` (health check)
- `docker-compose.yml`
- `Dockerfile.backend`

## Architecture Notes

### SQLite in WAL Mode
- Allows concurrent reads and single writer
- Better performance than default journaling
- Suitable for moderate multi-user load
- Can migrate to PostgreSQL later without code changes (SQLAlchemy abstraction)

### Content-Addressable Asset Storage
- Assets identified by SHA256 hash
- Automatic deduplication (same image uploaded by different users = single file)
- File path: `storage/assets/{hash[:2]}/{hash[2:4]}/{hash}.ext`

### Optimistic Locking
- Projects have `version` column
- Concurrent edits detected via version mismatch
- Client must retry with latest version

### Job Queue Design (Phase 1)
- Status progression: pending → running → completed/failed
- Cleanup job removes old completed/failed jobs (24hr retention)
- Timeout enforcement via multiprocessing

## Success Criteria

✅ Database created with all tables
✅ WAL mode enabled
✅ Migrations work correctly
✅ Health check endpoint responds
✅ Docker containers can start
✅ Storage directories created
✅ Configuration loaded from environment
