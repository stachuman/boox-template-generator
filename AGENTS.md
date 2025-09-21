# Repository Guidelines

## Project Structure & Module Organization
- Python library: `src/einkpdf/` (core, validation, optimization; CLI `cli.py`; assets `src/einkpdf/assets/`).
- Backend API: `backend/app/` (FastAPI entry `backend/app/main.py`; routers in `backend/app/api/`).
- Frontend: `frontend/` (Vite + React + TypeScript + Zustand).
- Tools: `tools/` (e.g., `tools/golden_file_cli.py`).
- Tests: `tests/` (unit, integration, golden, device). Templates in `templates/`; outputs in `output/`.

## Architecture Overview
- Purpose: generate static, link‑only PDFs optimized for Onyx Boox.
- Render stack: ReportLab → pikepdf (named destinations) → PyMuPDF (preview).
- Profiles: YAML in `/config/profiles` (host) → `/app/config/profiles` (container); override via `EINK_PROFILE_DIR`.

## Build, Test, and Development Commands
- Python dev: `python -m venv einkpdf-env && source einkpdf-env/bin/activate && pip install -e .[dev]`.
- Backend (dev): from repo root `python start_backend.py` or `uvicorn backend.app.main:app --reload`.
- Frontend (dev): `cd frontend && npm ci && npm run dev`.
- CLI usage: `einkpdf --help`.
- Tests + coverage: `pytest` (HTML report in `htmlcov/`).
- Docker: `docker compose build && docker compose up -d` (override port with `FRONTEND_PORT=8080`).

## Coding Style & Naming Conventions
- Formatters: Black (line length 88) and isort (`profile=black`).
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
- PRs: include clear description, linked issues, and artifacts when relevant (PDF/PNG renders, UI screenshots).
- Pre‑flight: run `pytest`; `black . && isort .`; fix mypy/flake8 warnings.

## Security & Configuration
- Do not commit secrets; use `.env` (loaded with `python-dotenv`).
- Review CORS before deploy. Large generated files belong in `output/` (not versioned).
- Services: helpers in `manage-services.sh`; systemd units `eink-backend.service`, `eink-frontend.service`.
