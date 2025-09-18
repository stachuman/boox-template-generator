# Docker Quickstart

This repo ships a simple two‑service Docker setup with persistent data.

## Prerequisites
- Docker and Docker Compose v2 (docker compose ...)

## Build and Run
- Build images:
  - `docker compose build`
- Start in the background:
  - `docker compose up -d`
- Open the app:
  - Frontend: http://localhost:3000
  - API: http://localhost:8000

## Data Persistence
- Templates and generated files are stored in a named volume:
  - Volume: `eink_data` mounted at `/app/backend/data`
- Stop containers (keeps data):
  - `docker compose down`
- Remove containers + data (DANGEROUS):
  - `docker compose down -v`

## Cleanup Settings (optional)
- Backend prunes old templates on startup. Configure via env in `docker-compose.yml`:
  - `EINK_CLEANUP_TTL_DAYS=14` (delete items older than N days; set ≤0 to disable)
  - `EINK_CLEANUP_MAX_TEMPLATES=500` (keep newest N templates)

## Common Commands
- View logs: `docker compose logs -f backend`
- Rebuild after code changes: `docker compose build backend && docker compose up -d`
- Inspect volume path (Linux/Mac): `docker volume inspect eink_data`

Notes
- The frontend (port 3000) talks to the API (port 8000). CORS is preconfigured for localhost.
- For a clean production image later, you can combine FE+BE behind a reverse proxy, but this setup prioritizes simplicity.
