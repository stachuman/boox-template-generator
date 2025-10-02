# Docker Setup Guide

## Overview
This guide explains the Docker setup for the e-ink PDF multi-user system with SQLite database backend.

## File Structure

```
/root/eink/
├── Dockerfile.backend          # Backend container definition
├── Dockerfile.frontend         # Frontend container definition
├── docker-compose.yml          # Multi-service orchestration
├── backend/
│   ├── alembic.ini            # Alembic migration config
│   └── alembic/               # Migration scripts
├── storage/                    # Data volume (mounted)
│   ├── einkpdf.sqlite         # SQLite database
│   ├── assets/                # User-uploaded images
│   └── jobs/                  # Generated PDFs
└── config/
    └── profiles/              # Device profiles (read-only)
```

## Docker Compose Configuration

### Services

#### Backend Service
- **Image:** Python 3.11 slim
- **Port:** 8000 (configurable via `BACKEND_PORT`)
- **Volume:** `eink_storage:/app/storage` (persistent data)
- **Health Check:** `GET /health` every 30s

#### Frontend Service
- **Port:** 3000 (configurable via `FRONTEND_PORT`)
- **Depends On:** backend
- **Environment:** `VITE_API_BASE_URL` points to backend

### Key Environment Variables

```bash
# Database
DATABASE_URL=sqlite:///storage/einkpdf.sqlite
DB_ECHO=false

# Application
APP_NAME=einkpdf
APP_VERSION=0.2.0
DEBUG=false

# JWT Authentication
JWT_SECRET_KEY=${JWT_SECRET_KEY:-dev-secret-key-change-in-production}
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Storage
STORAGE_DIR=/app/storage
ASSETS_DIR=/app/storage/assets
JOBS_DIR=/app/storage/jobs

# PDF Limits
MAX_PDF_PAGES=1000
MAX_PDF_SIZE_MB=50
PDF_TIMEOUT_SECONDS=600

# Image Limits
MAX_IMAGE_SIZE_BYTES=524288  # 0.5MB

# Rate Limiting
RATE_LIMIT_ENABLED=true
PDF_GENERATE_RATE_LIMIT=10/minute
PDF_PREVIEW_RATE_LIMIT=30/minute
IMAGE_UPLOAD_RATE_LIMIT=20/minute

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## Dockerfile.backend Details

### Build Stages

1. **System Dependencies**
   - curl (health checks)
   - sqlite3 (debugging)
   - ca-certificates

2. **Python Dependencies**
   - Install from pyproject.toml (includes FastAPI, SQLAlchemy, etc.)
   - Additional: pydantic-settings, sqlalchemy, alembic

3. **Storage Setup**
   - Create `/app/storage/assets` directory
   - Create `/app/storage/jobs` directory

4. **Startup Command**
   ```bash
   alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   - Runs database migrations first
   - Then starts FastAPI server

## Running the Application

### Initial Setup

1. **Set Environment Variables (Optional)**
   ```bash
   export JWT_SECRET_KEY="your-production-secret-key"
   export BACKEND_PORT=8000
   export FRONTEND_PORT=3000
   ```

2. **Build and Start Services**
   ```bash
   docker-compose up --build
   ```

3. **View Logs**
   ```bash
   # All services
   docker-compose logs -f

   # Backend only
   docker-compose logs -f backend

   # Frontend only
   docker-compose logs -f frontend
   ```

### Database Migrations

Migrations run automatically on container startup. To run manually:

```bash
# Enter backend container
docker-compose exec backend bash

# Run migrations
alembic upgrade head

# Check current version
alembic current

# Generate new migration
alembic revision --autogenerate -m "Description"
```

### Production Deployment

1. **Update docker-compose.yml**
   ```yaml
   environment:
     - DEBUG=false
     - JWT_SECRET_KEY=${JWT_SECRET_KEY}  # Load from .env file
     - CORS_ORIGINS=https://yourdomain.com
   ```

2. **Create .env file**
   ```bash
   JWT_SECRET_KEY=<generate-strong-secret>
   BACKEND_PORT=8000
   FRONTEND_PORT=80
   ```

3. **Build and run**
   ```bash
   docker-compose --env-file .env up -d
   ```

## Volume Management

### Persistent Storage

The `eink_storage` volume persists:
- SQLite database with user accounts
- User-uploaded images
- Generated PDF files

### Backup Database

```bash
# Backup database from running container
docker-compose exec backend sqlite3 /app/storage/einkpdf.sqlite ".backup /app/storage/backup.sqlite"

# Copy backup to host
docker cp $(docker-compose ps -q backend):/app/storage/backup.sqlite ./backup.sqlite
```

### Restore Database

```bash
# Copy backup to container
docker cp ./backup.sqlite $(docker-compose ps -q backend):/app/storage/restore.sqlite

# Restore in container
docker-compose exec backend sqlite3 /app/storage/einkpdf.sqlite ".restore /app/storage/restore.sqlite"
```

### Volume Inspection

```bash
# List volumes
docker volume ls | grep eink

# Inspect volume
docker volume inspect eink_eink_storage

# Access volume data (create temporary container)
docker run --rm -v eink_eink_storage:/data alpine ls -la /data
```

## Health Checks

### Backend Health Endpoint

```bash
# Check health
curl http://localhost:8000/health

# Expected response
{
  "status": "healthy",
  "version": "1.0.0",
  "einkpdf_available": true
}
```

### Container Health Status

```bash
# Check container health
docker-compose ps

# View health check logs
docker inspect $(docker-compose ps -q backend) | jq '.[0].State.Health'
```

## Troubleshooting

### Container Won't Start

1. **Check logs**
   ```bash
   docker-compose logs backend
   ```

2. **Common issues:**
   - Port already in use: Change `BACKEND_PORT` in .env
   - Migration failure: Check database permissions
   - Missing dependencies: Rebuild with `--no-cache`

### Database Migration Errors

```bash
# Reset migrations (DESTRUCTIVE - only for development)
docker-compose exec backend rm /app/storage/einkpdf.sqlite
docker-compose restart backend
```

### Permission Issues

```bash
# Fix storage permissions
docker-compose exec backend chown -R root:root /app/storage
docker-compose exec backend chmod -R 755 /app/storage
```

### Reset Everything (Development Only)

```bash
# Stop and remove containers, volumes
docker-compose down -v

# Remove images
docker-compose rm -f
docker rmi $(docker images -q eink_backend eink_frontend)

# Rebuild from scratch
docker-compose up --build
```

## Development Workflow

### Live Code Reload

For development, mount source code as volume:

```yaml
# docker-compose.override.yml
version: "3.9"
services:
  backend:
    volumes:
      - ./backend:/app/backend
      - ./src:/app/src
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Then:
```bash
docker-compose up
```

### Run Tests in Container

```bash
# Enter container
docker-compose exec backend bash

# Run tests
cd /app
pytest

# Run specific test
pytest backend/tests/test_auth.py -v
```

## Security Considerations

### Production Checklist

- [ ] Change `JWT_SECRET_KEY` to a strong random value
- [ ] Set `DEBUG=false`
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS (reverse proxy like nginx/traefik)
- [ ] Regular database backups
- [ ] Monitor disk usage for storage volume
- [ ] Implement log rotation
- [ ] Use secrets management (Docker secrets, AWS Secrets Manager, etc.)

### Generate Secure JWT Secret

```bash
# Generate strong secret
openssl rand -base64 64

# Set in .env
echo "JWT_SECRET_KEY=$(openssl rand -base64 64)" >> .env
```

## Monitoring

### Resource Usage

```bash
# Container stats
docker stats

# Specific container
docker stats $(docker-compose ps -q backend)
```

### Disk Usage

```bash
# Volume size
docker system df -v | grep eink_storage

# Database size
docker-compose exec backend du -h /app/storage/einkpdf.sqlite
```

### Logs

```bash
# Follow logs with timestamps
docker-compose logs -f -t backend

# Last 100 lines
docker-compose logs --tail 100 backend
```

## Multi-Stage Deployment

### Development
```bash
docker-compose up
```

### Staging
```bash
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
```

### Production
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Quick Commands Reference

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose stop

# Restart backend
docker-compose restart backend

# View logs
docker-compose logs -f

# Run command in backend
docker-compose exec backend <command>

# Database backup
docker-compose exec backend sqlite3 /app/storage/einkpdf.sqlite ".backup /app/storage/backup.sqlite"

# Rebuild specific service
docker-compose build --no-cache backend
docker-compose up -d backend

# Clean everything
docker-compose down -v
```

## Next Steps

After Docker setup:
1. Run user migration script (if not done)
2. Create admin user
3. Test authentication endpoints
4. Configure email service for password resets
5. Set up monitoring and alerting
6. Configure automated backups
