# Multi-User System Implementation Plan

## Executive Summary
This roadmap upgrades the e-ink PDF platform from "single-tenant friendly" to a hardened multi-user service. We focus on isolating heavy PDF work, normalising asset storage, throttling abuse, and protecting shared projects. Each workstream lists concrete deliverables and acceptance criteria so implementation can proceed incrementally while keeping quality and security front of mind.

## Current State Snapshot
- **Already in place:** JWT auth (`backend/app/auth.py`), per-user project directories (`users/{user_id}/projects/{project_id}`), ownership metadata on projects, and token-protected APIs.
- **Critical gaps:** blocking PDF compilation, asset bloat from base64 images, no rate limiting, no edit contention controls, absent resource quotas, and manual cleanup of orphaned files.

## Guiding Principles
- Treat PDF generation as an asynchronous, resource-limited job; API calls should return quickly.
- Prefer configuration-driven paths via `settings` over hard-coded directories; defaults should live in repo paths that work in local and containerised environments.
- Eliminate legacy image storage—new schema takes effect immediately; no backward compatibility is required.
- Bake in observability (metrics, logs, alerts) alongside each feature, not afterward.
- Resolve TODO placeholders (admin checks, shared asset access) during implementation—no lingering partial features.

## Roadmap Overview
| Phase | Focus | Deliverables | Status |
| --- | --- | --- | --- |
| Phase 0 | Foundations | Add configuration surface, shared settings, instrumentation hooks, and shared SQLite libraries. | ✅ **COMPLETE** |
| Phase 1 | Critical launch blockers | User database migration ✅, PDF job isolation ✅, asset storage overhaul ❌, API rate limiting ❌. | 🚧 In Progress (2/4) |
| Phase 2 | Collaboration readiness | Concurrent edit protection, admin tooling, storage cleanup automation. | ⏳ Pending |
| Phase 3 | Sustainability | Usage quotas, monitoring dashboards, long-term data platform decisions. | ⏳ Pending |

### Phase 0 Completion Summary ✅
**Completed:** October 2, 2025

**Implementation:**
- ✅ Configuration system (`backend/app/config.py`) with pydantic-settings
- ✅ Storage directory structure (`storage/`, `storage/assets/`, `storage/jobs/`)
- ✅ SQLAlchemy base and models with 7 tables (users, projects, assets, pdf_jobs, public_projects, password_reset_tokens, user_quotas)
- ✅ Alembic migrations setup with initial schema migration
- ✅ Health check endpoint with database connectivity verification
- ✅ Docker configuration updated with unified storage volume
- ✅ SQLite database with WAL mode for concurrency

**Documentation:** See `PHASE0_SUMMARY.md` for detailed implementation notes.

**Next Priority:** Finish remaining Phase 1 blockers (asset storage overhaul, rate limiting)

### Phase 1 - User Management Migration ✅
**Completed:** October 2, 2025

**Implementation:**
- ✅ Created `DBAuthService` for database-backed authentication
- ✅ Created `DBPasswordResetService` for password reset workflow
- ✅ Built migration script (`migrate_users_to_db.py`) with dry-run mode
- ✅ Migrated 6 users from JSON to SQLite successfully
- ✅ Created FastAPI dependencies (`get_auth_service`, `get_current_user`)
- ✅ Implemented JWT service integrated with database
- ✅ Updated auth API endpoints to use database (`auth_db.py`)
- ✅ Tested all authentication flows (register, login, token validation)
- ✅ Case-insensitive username lookup
- ✅ Password reset token management in database

**Documentation:** See `PHASE1_USER_MIGRATION_SUMMARY.md` for detailed implementation notes.

### Phase 1 - PDF Job Isolation ✅
**Completed:** October 2, 2025

**Implementation:**
- ✅ Created `PDFJobService` for database-backed job management
- ✅ Created `PDFWorker` with multiprocessing isolation and resource limits
- ✅ Implemented 5 API endpoints (`/api/pdf/jobs/*`)
- ✅ Added timeout enforcement (600s), page limit (1000), size limit (50MB)
- ✅ Process isolation using multiprocessing with subprocess termination
- ✅ Job status tracking (pending → processing → completed/failed/cancelled)
- ✅ Automatic cleanup of jobs older than 24 hours
- ✅ Frontend TypeScript types and API client methods
- ✅ React component with auto-polling and download
- ✅ User isolation - jobs tied to authenticated users

**Documentation:** See `PDF_JOB_ISOLATION_SUMMARY.md` for detailed implementation notes.

**Remaining Phase 1 Tasks:**
- [ ] Asset Storage Overhaul (file-based storage, SHA256 deduplication)
  - Current implementation still stores images as `image_data` / base64 blobs and exposes only font metadata via `/api/assets/*`.
- [ ] Rate Limiting (slowapi integration)
  - No middleware is registered; `RATE_LIMIT_*` settings are unused.
- [ ] Project Migration to Database (optional)

## Workstream 1 · PDF Job Isolation (Critical) ✅ COMPLETE

**Completed:** October 2, 2025

- **Goals:** ✅ Prevent request-thread blocking, constrain CPU/memory, persist job state across restarts, and deliver status polling plus download endpoints.
- **Implementation:**
  - ✅ Async worker using FastAPI BackgroundTasks with multiprocessing isolation
  - ✅ SQLite-backed job registry in `pdf_jobs` table (already in main database)
  - ✅ Job persistence with status tracking (pending/processing/completed/failed/cancelled)
  - ✅ Exposed endpoints: `POST /pdf/jobs`, `GET /pdf/jobs`, `GET /pdf/jobs/{id}`, `GET /pdf/jobs/{id}/download`, `DELETE /pdf/jobs/{id}`
  - ✅ User isolation - jobs tied to authenticated users with access control
  - ✅ Resource limits: `PDF_TIMEOUT_SECONDS=600`, `MAX_PDF_PAGES=1000`, `MAX_PDF_SIZE_MB=50`
  - ✅ Process isolation with subprocess termination on timeout
  - ✅ Automatic cleanup of jobs older than 24 hours
  - ✅ Frontend React component with auto-polling and status display
  - ✅ TypeScript types and API client methods
- **Acceptance criteria:** ✅ API returns job ID within <100ms; ✅ jobs respect all resource limits; ✅ jobs persist in database; ✅ only job owners can access their jobs; ✅ comprehensive error handling and logging.

## Workstream 2 · User Management Migration to SQLite (Critical) ✅ COMPLETE

**Completed:** October 2, 2025

- **Goals:** ✅ Move authentication and user profile storage from file-based implementation into SQLite while preserving existing accounts and credentials.
- **Implementation:**
  - ✅ Created SQLAlchemy models for users, password reset tokens in main database
  - ✅ Built `migrate_users_to_db.py` with dry-run mode and validation
  - ✅ Migrated 6 users from JSON files to SQLite successfully
  - ✅ Created `DBAuthService` for database-backed authentication
  - ✅ Created `DBPasswordResetService` for password reset workflow
  - ✅ Implemented JWT token service integrated with database
  - ✅ Updated all auth endpoints to use database (`auth_db.py`)
  - ✅ FastAPI dependencies for user authentication (`get_current_user`)
  - ✅ Case-insensitive username lookups
  - ✅ Consolidated storage to `backend/data/` for single Docker volume
- **Acceptance criteria:** ✅ All authentication flows (signup, login, refresh, password reset) operate against SQLite; ✅ 6 users migrated and tested; ✅ projects accessible for all users; ✅ migration script works in production Docker environment; ✅ comprehensive backup created.

## Workstream 3 · Asset Storage Overhaul (Critical)
- **Status:** Pending — assets remain embedded as base64 (`image_data`) and the assets API only lists fonts; no `AssetService` exists yet.
- **Goals:** Replace inline base64 payloads with deduplicated asset files and enforce strict size/type validation.
- **Scope:**
  - Introduce `AssetService` backed by per-user directories under a configurable `settings.ASSETS_DIR` defaulting to `storage/assets/` in the repo (ensure Docker volumes map this path).
  - API endpoints for upload, fetch, delete, and usage reporting with ownership checks and audit trails.
  - Frontend updates: upload via FormData, store `image_asset_id`/`image_url`, drop support for `image_data` fields immediately, and handle validation feedback.
  - Backend renderers: resolve asset ids synchronously, raising strict-mode errors when missing.
  - Add scheduled cleanup for orphaned files when projects are deleted.
- **Acceptance criteria:** New templates persist only asset references; uploading invalid files yields helpful 4xx errors; deleting projects removes unused assets; TODO for shared access is closed with a clear policy (e.g. allow collaborators read access).

## Workstream 4 · Rate Limiting & Abuse Mitigation (Important)
- **Status:** Pending — configuration flags exist but no middleware (`slowapi`) is wired into `FastAPI` yet.
- **Goals:** Throttle expensive endpoints and provide consistent error messaging.
- **Scope:**
  - Adopt `slowapi` or equivalent middleware; limits configurable via settings (`PDF_RATE_LIMIT`, etc.).
  - Apply endpoint-specific caps (PDF generation, previews, asset uploads, project creation) and configure a global default.
  - Centralise 429 response format and surface retry-after hints to the frontend.
  - Extend monitoring to track limit hits per user and emit alerts on spikes.
- **Acceptance criteria:** Load tests confirm limits trigger without degrading unaffected routes; frontend displays actionable rate-limit feedback; metrics dashboard shows per-endpoint rate-limit counters.

## Workstream 5 · Concurrent Edit Protection (Important)
- **Goals:** Prevent blind overwrites when multiple sessions edit the same project.
- **Scope:**
  - Add monotonically increasing `version` fields to project metadata and API contracts.
  - Implement optimistic locking in workspace manager or persistence layer; conflicting writes return HTTP 409 with guidance.
  - Frontend handles conflicts gracefully (refresh prompt, diff preview backlog item).
  - Capture audit logs for conflicting updates.
- **Acceptance criteria:** Integration tests simulate concurrent edits and receive 409; UI surfaces conflict resolution path; logging captures user, project, and version deltas.

## Workstream 6 · Resource Governance & Observability (Nice to Have)
- **Goals:** Deter abuse and surface actionable insights for operators.
- **Scope:**
  - Implement per-user quotas for projects, images, PDF jobs/day with configurable tiers.
  - Provide usage endpoints and admin dashboard cards showing consumption.
  - Add alerting for quota breaches and unusual activity patterns.
- **Acceptance criteria:** Quotas block creation beyond limits with clear guidance; admins can override via CLI or dashboard; monitoring includes quota utilisation metrics.

## Workstream 7 · Data Platform Evolution (Future Consideration)
- **Goals:** Move from filesystem storage to PostgreSQL when scale demands ACID semantics.
- **Scope:**
  - Define normalized schema for projects, assets, jobs, and sharing grants.
  - Prototype dual-write to validate ORM models and transaction boundaries.
  - Plan cutover, backup, and disaster-recovery procedures.
- **Acceptance criteria:** Architecture review signs off on schema; proof-of-concept handles concurrent edits without regressions; rollout checklist covers migration, rollback, and infra requirements.

## Cross-Cutting Tasks
- Harden admin-only endpoints (role checks, logging) and document operational runbooks.
- Expand automated testing: contract tests for new APIs, load tests for job queue, and golden PDF regeneration after renderer changes.
- Update developer docs (`AGENTS.md`, onboarding scripts) to reflect new workflows, configuration variables, Docker volume requirements, and discrepancies between planned `storage/` paths and the implemented `data/` directories.
- Provide deployment steps for introducing new services (queue/broker), including environment variable templates and health checks.

## Implementation Notes & Gaps
- Storage defaults currently point to `data/` (`backend/app/config.py`), while this plan still references `storage/`; update when asset overhaul lands.
- Legacy file-based auth endpoints remain in `backend/app/api/auth.py`; decide whether to remove or mark deprecated.
- Docker Compose mounts the unified `data/` directory; revisit volume guidance once asset and quota features ship.
