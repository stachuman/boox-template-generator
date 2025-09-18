# Repository Guidelines

## Project Structure & Module Organization
- Python library: `src/einkpdf/` (core, validation, optimization; CLI `cli.py`; assets `src/einkpdf/assets/`).
- Backend API: `backend/app/` (FastAPI entry `backend/app/main.py`; routers `backend/app/api/`).
- Frontend: `frontend/` (Vite + React + TypeScript + Zustand).
- Tools: `tools/` (e.g., `tools/golden_file_cli.py`).
- Tests: `tests/` (unit, integration, golden, device). Templates in `templates/`; outputs in `output/`.

## Architecture Overview
- Purpose: design static, link‑only PDFs optimized for Onyx Boox.
- Render stack: ReportLab-only deterministic generation (no pikepdf post-process).
- Profiles: YAML in `/config/profiles` (host) → `/app/config/profiles` (container); override via `EINK_PROFILE_DIR`.
- Features: widgets (text_block, checkbox, lines, calendar), master pages with `{page}`/`{total_pages}`, navigation via page links and tap zones only. Deterministic rendering with device constraints.

## Build, Test, and Development Commands
- Python dev: `python -m venv einkpdf-env && source einkpdf-env/bin/activate && pip install -e .[dev]`.
- Backend (dev): repo root `python start_backend.py` or `uvicorn backend.app.main:app --reload`.
- Frontend (dev): `cd frontend && npm ci && npm run dev`.
- CLI: `einkpdf --help`. Tests + coverage: `pytest` (HTML in `htmlcov/`).

## Docker Setup
- Compose exposes only frontend (Nginx) and proxies `/api` and `/ws` to backend.
- Build/run: `docker compose build && docker compose up -d`; override port: `FRONTEND_PORT=8080 docker compose up -d`.
- Volumes: `eink_data:/app/backend/data`, `/config/profiles:/app/config/profiles:ro`.

## Coding Style & Naming Conventions
- Format: Black (88) and isort (`profile=black`).
- Lint/Type: flake8 and mypy (strict; see `pyproject.toml`).
- Python: 4‑space indent; functions/modules `snake_case`, classes `PascalCase`, constants `UPPER_SNAKE_CASE`.
- TypeScript/React: ESLint + TS defaults; components `PascalCase`.

## Testing Guidelines
- Framework: `pytest` with `pytest-cov`; coverage gate ≥ 80%.
- Discovery: files `test_*.py`, classes `Test*`, functions `test_*` under `tests/`.
- Markers: `unit`, `integration`, `golden`, `device`, `spike`, `slow`.
- Golden files: `python tools/golden_file_cli.py run-tests` (see `--help`).

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat: …`, `fix: …`, `chore: …`).
- PRs: clear description, linked issues, artifacts when relevant (PDF/PNG renders, UI screenshots).
- Pre-flight: run `pytest`; `black . && isort .`; fix mypy/flake8 warnings.

## Security & Configuration
- Never commit secrets; use `.env` (loaded via `python-dotenv`). Review CORS before deploy.
- Large generated files belong in `output/` and are not versioned.
- Services: helpers in `manage-services.sh`; systemd units `eink-backend.service`, `eink-frontend.service`.
