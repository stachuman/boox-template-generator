  # Repository Guidelines

  ## Project Structure & Module Organization

  - Python library: src/einkpdf/ (core, validation, optimization, CLI in cli.py)
  - Backend API: backend/app/ (FastAPI app in backend/app/main.py, routers in backend/app/api/)
  - Frontend: frontend/ (Vite + React + TypeScript)
  - Tests: tests/ (unit, integration, device, golden)
  - Tools: tools/ (e.g., tools/golden_file_cli.py)
  - Templates & assets: templates/, src/einkpdf/assets/; outputs in output/

  ## Build, Test, and Development Commands

  - Python setup (dev): python -m venv einkpdf-env && source einkpdf-env/bin/activate && pip install -e .[dev]
  - Backend (dev): python start_backend.py (root) or uvicorn app.main:app --reload (from backend/)
  - Frontend (dev): cd frontend && npm ci && npm run dev
  - Library CLI: einkpdf --help (after editable install)
  - Run tests + coverage: pytest (HTML report in htmlcov/)

  ## Coding Style & Naming Conventions

  - Formatting: Black (line length 88), isort (profile=black)
  - Lint/Type: flake8, mypy (strict settings in pyproject.toml)
  - Python: 4-space indent; modules/functions snake_case, classes PascalCase, constants UPPER_SNAKE_CASE
  - TypeScript/React: follow ESLint + TS defaults; components PascalCase

  ## Testing Guidelines

  - Framework: pytest with pytest-cov; coverage gate 80% (see pyproject.toml)
  - Discovery: files test_*.py, classes Test*, functions test_*; test roots in tests/
  - Markers: unit, integration, golden, device, spike, slow
  - Golden files: python tools/golden_file_cli.py run-tests (see --help for capture/update)

  ## Commit & Pull Request Guidelines

  - Commits: Prefer Conventional Commits (e.g., feat: …, fix: …, chore: …)
  - PRs: include clear description, linked issues, and artifacts when relevant (PDF/PNG for rendering, UI screenshots)
  - Pre-flight: ensure pytest passes and run black . && isort .; address mypy/flake8 warnings

  ## Security & Configuration Tips

  - Do not commit secrets; use .env (loaded via python-dotenv).
  - CORS: dev origins preconfigured in FastAPI; review before deploy.
  - Large generated files belong in output/ and should not be versioned.
  - Services: deployment helpers in manage-services.sh and systemd units eink-backend.service, eink-frontend.service.

  If you enable write access, I’ll create AGENTS.md at the root automatically.
