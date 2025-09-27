# Repository Guidelines

## Project Structure & Module Organization
- `src/einkpdf/`: Python library for core PDF generation, CLI entry at `cli.py`, reusable assets under `assets/`.
- `backend/app/`: FastAPI backend with routers in `api/` and entry point `main.py`.
- `frontend/`: Vite + React + TypeScript app; state handled with Zustand.
- `tools/`: Helper scripts such as `golden_file_cli.py` for snapshot validation.
- `tests/`: Unit, integration, golden, and device suites; templates in `templates/`; generated artifacts belong in `output/` (git-ignored).

## Build, Test, and Development Commands
- `python -m venv einkpdf-env && source einkpdf-env/bin/activate && pip install -e .[dev]`: create and activate the dev environment.
- `python start_backend.py` or `uvicorn backend.app.main:app --reload`: run the backend with autoreload.
- `cd frontend && npm ci && npm run dev`: install frontend deps and start Vite dev server.
- `pytest`: execute the Python test suite with coverage.
- `python tools/golden_file_cli.py run-tests`: refresh and verify golden outputs.

## Coding Style & Naming Conventions
- Python: 4-space indent, Black (line length 88) + isort (`profile=black`), flake8, strict mypy. Modules and functions use `snake_case`; classes use `PascalCase`; constants use `UPPER_SNAKE_CASE`.
- TypeScript/React: follow ESLint + TypeScript defaults; components in `PascalCase`.
- Keep code comments purposeful; avoid committing generated files from `output/`.

## Testing Guidelines
- Use `pytest` with `pytest-cov`; maintain ≥80% coverage (HTML report in `htmlcov/`).
- Name tests `test_*.py`, classes `Test*`, functions `test_*`; apply markers (`unit`, `integration`, `golden`, `device`, `slow`, `spike`) to scope runs.
- Run golden tests after modifying render logic or assets.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (e.g., `feat: add eink profile loader`, `fix: correct pdf destination names`).
- Before pushing: `black . && isort .`, resolve flake8/mypy warnings, and run `pytest`.
- PRs should include a clear summary, linked issues, validation notes (tests run), and artifacts such as PDFs or UI screenshots when relevant.

## Security & Configuration Tips
- Store secrets in `.env`; never commit sensitive values. Profiles load from `config/profiles/` and can be overridden with `EINK_PROFILE_DIR`.
- Review CORS settings before deploying; keep generated assets and large binaries out of version control.
