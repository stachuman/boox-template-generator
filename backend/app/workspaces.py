"""Multi-tenant workspace and public project management services."""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, ValidationError

# Ensure core library is importable when running from backend package
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from einkpdf.core.project_schema import Project
from einkpdf.services.project_service import ProjectService, ProjectServiceError

from .auth import UserRecord
from .models import PublicProjectListResponse, PublicProjectResponse


def _resolve_data_root() -> Path:
    """Resolve the base data directory for user and public storage."""
    env_root = os.getenv("EINK_DATA_DIR")
    if env_root:
        root = Path(env_root)
    else:
        # Use data directory relative to backend directory (parent.parent / data)
        root = Path(__file__).resolve().parent.parent / "data"
    root.mkdir(parents=True, exist_ok=True)
    return root


class WorkspaceError(Exception):
    """Raised when workspace operations fail."""


class PublicProjectNotFoundError(WorkspaceError):
    """Raised when a public project cannot be located."""


class UserWorkspaceManager:
    """Manage per-user project storage and related helpers."""

    def __init__(self, data_root: Optional[Path] = None) -> None:
        self._data_root = data_root or _resolve_data_root()
        self._users_dir = self._data_root / "users"
        self._users_dir.mkdir(parents=True, exist_ok=True)

    def get_user_root(self, user_id: str) -> Path:
        root = self._users_dir / user_id
        root.mkdir(parents=True, exist_ok=True)
        return root

    def get_project_root(self, user_id: str) -> Path:
        return self.get_user_root(user_id) / "projects"

    def get_project_service(self, user_id: str) -> ProjectService:
        return ProjectService(storage_dir=str(self.get_project_root(user_id)))

    def get_project_directory(self, user_id: str, project_id: str) -> Path:
        return self.get_project_root(user_id) / project_id


class PublicProjectIndexEntry(BaseModel):
    """Persistent metadata for a public project listing."""

    id: str
    owner_id: str
    owner_username: str
    metadata: Dict[str, Any]
    url_slug: Optional[str] = None
    clone_count: int = 0
    created_at: str
    updated_at: str


class PublicProjectManager:
    """Manage publication, indexing, and cloning statistics for public projects."""

    def __init__(self, data_root: Optional[Path] = None) -> None:
        self._data_root = data_root or _resolve_data_root()
        self._public_root = self._data_root / "public-projects"
        self._public_root.mkdir(parents=True, exist_ok=True)
        self._index_file = self._public_root / "index.json"
        self._lock = threading.RLock()
        self._index: Dict[str, PublicProjectIndexEntry] = {}
        self._load_index()
        self._project_service = ProjectService(storage_dir=str(self._public_root))

    # ---------------------
    # Index maintenance
    # ---------------------

    def _load_index(self) -> None:
        if not self._index_file.exists():
            self._index = {}
            return
        try:
            raw = json.loads(self._index_file.read_text())
        except json.JSONDecodeError as exc:
            raise WorkspaceError(f"Failed to parse public project index: {exc}") from exc
        entries: Dict[str, PublicProjectIndexEntry] = {}
        for project_id, payload in raw.items():
            try:
                entries[project_id] = PublicProjectIndexEntry.model_validate(payload)
            except ValidationError:
                continue
        self._index = entries

    def _save_index(self) -> None:
        snapshot = {pid: entry.model_dump(mode="json") for pid, entry in self._index.items()}
        self._index_file.write_text(json.dumps(snapshot, indent=2))

    def _slug_exists(self, slug: str, exclude_project_id: Optional[str] = None) -> bool:
        for project_id, entry in self._index.items():
            if project_id == exclude_project_id:
                continue
            if entry.url_slug and entry.url_slug.lower() == slug.lower():
                return True
        return False

    # ---------------------
    # Publication helpers
    # ---------------------

    @staticmethod
    def _normalize_slug(candidate: Optional[str], fallback_name: str) -> Optional[str]:
        if candidate is None:
            base = fallback_name
        else:
            base = candidate
        slug = re.sub(r"[^a-zA-Z0-9-]+", "-", base.strip().lower())
        slug = re.sub(r"-+", "-", slug).strip("-")
        return slug or None

    def publish_project(
        self,
        *,
        owner: UserRecord,
        project: Project,
        source_dir: Path,
        desired_slug: Optional[str] = None,
    ) -> PublicProjectResponse:
        slug = self._normalize_slug(desired_slug, project.metadata.name)
        with self._lock:
            if slug and self._slug_exists(slug, exclude_project_id=project.id):
                raise WorkspaceError(f"Slug '{slug}' is already in use")
            now = datetime.now(timezone.utc).isoformat()
            masters_dir = source_dir / "masters"
            compiled_dir = source_dir / "compiled"
            plan_path = source_dir / "plan.yaml"
            self._project_service.import_project(
                project,
                masters_source_dir=masters_dir if masters_dir.exists() else None,
                plan_source_path=plan_path if plan_path.exists() else None,
                compiled_source_dir=compiled_dir if compiled_dir.exists() else None,
            )
            existing = self._index.get(project.id)
            created_at = existing.created_at if existing else now
            entry = PublicProjectIndexEntry(
                id=project.id,
                owner_id=owner.id,
                owner_username=owner.username,
                metadata=project.metadata.model_dump(),
                url_slug=slug,
                clone_count=project.metadata.clone_count,
                created_at=created_at,
                updated_at=now,
            )
            self._index[project.id] = entry
            self._save_index()
        return self._build_response(entry)

    def revoke_publication(self, project_id: str) -> None:
        with self._lock:
            entry = self._index.pop(project_id, None)
            if entry is None:
                return
            self._save_index()
        project_dir = self._public_root / project_id
        shutil.rmtree(project_dir, ignore_errors=True)

    def list_public_projects(self) -> PublicProjectListResponse:
        entries = [self._build_response(entry) for entry in self._index.values()]
        entries.sort(key=lambda item: item.created_at, reverse=True)
        return PublicProjectListResponse(projects=entries, total=len(entries))

    def get_public_project(self, project_id: str) -> Tuple[Project, PublicProjectIndexEntry, Path]:
        try:
            project = self._project_service.get_project(project_id)
        except ProjectServiceError as exc:
            raise WorkspaceError(str(exc)) from exc
        if project is None:
            raise PublicProjectNotFoundError(f"Public project {project_id} not found")
        entry = self._index.get(project_id)
        if entry is None:
            raise PublicProjectNotFoundError(f"Public project {project_id} not indexed")
        return project, entry, self._public_root / project_id

    def get_public_project_by_slug(self, slug: str) -> Tuple[Project, PublicProjectIndexEntry, Path]:
        for project_id, entry in self._index.items():
            if entry.url_slug and entry.url_slug.lower() == slug.lower():
                return self.get_public_project(project_id)
        raise PublicProjectNotFoundError(f"Public project with slug '{slug}' not found")

    def increment_clone_count(self, project_id: str) -> int:
        with self._lock:
            entry = self._index.get(project_id)
            if entry is None:
                raise PublicProjectNotFoundError(f"Public project {project_id} not found")
            entry.clone_count += 1
            entry.metadata["clone_count"] = entry.clone_count
            entry.updated_at = datetime.now(timezone.utc).isoformat()
            self._index[project_id] = entry
            self._save_index()
        try:
            self._project_service.update_project_metadata(project_id, clone_count=entry.clone_count)
        except ProjectServiceError:
            pass
        return entry.clone_count

    # ---------------------
    # Cloning helpers
    # ---------------------

    def clone_into_workspace(
        self,
        *,
        target_user: UserRecord,
        public_project: Project,
        public_directory: Path,
        workspace: UserWorkspaceManager,
        new_name: str,
        new_description: Optional[str] = None,
    ) -> Project:
        target_service = workspace.get_project_service(target_user.id)
        created = target_service.create_project(
            name=new_name,
            description=new_description or public_project.metadata.description,
            device_profile=public_project.metadata.device_profile,
            author=target_user.username,
            category=public_project.metadata.category,
        )
        now = datetime.now(timezone.utc).isoformat()
        cloned_project = public_project.model_copy(deep=True)
        cloned_project.id = created.id
        cloned_project.metadata.name = new_name
        cloned_project.metadata.description = new_description or public_project.metadata.description
        cloned_project.metadata.author = target_user.username
        cloned_project.metadata.created_at = now
        cloned_project.metadata.updated_at = now
        cloned_project.metadata.is_public = False
        cloned_project.metadata.public_url_slug = None
        cloned_project.metadata.clone_count = 0
        cloned_project.metadata.original_author = (
            public_project.metadata.original_author or public_project.metadata.author
        )
        cloned_project.metadata.cloned_from = public_project.id
        masters_dir = public_directory / "masters"
        compiled_dir = public_directory / "compiled"
        plan_path = public_directory / "plan.yaml"
        target_service.import_project(
            cloned_project,
            masters_source_dir=masters_dir if masters_dir.exists() else None,
            plan_source_path=plan_path if plan_path.exists() else None,
            compiled_source_dir=compiled_dir if compiled_dir.exists() else None,
        )
        return cloned_project

    # ---------------------
    # Utilities
    # ---------------------

    def _build_response(self, entry: PublicProjectIndexEntry) -> PublicProjectResponse:
        metadata = entry.metadata
        author = metadata.get("author") or entry.owner_username
        original_author = metadata.get("original_author")
        created_at = datetime.fromisoformat(entry.created_at)
        updated_at = datetime.fromisoformat(entry.updated_at)
        return PublicProjectResponse(
            id=entry.id,
            metadata=metadata,
            url_slug=entry.url_slug,
            author=author,
            original_author=original_author,
            clone_count=entry.clone_count,
            created_at=created_at,
            updated_at=updated_at,
        )


_workspace_manager_singleton: Optional[UserWorkspaceManager] = None
_public_manager_singleton: Optional[PublicProjectManager] = None
_workspace_lock = threading.Lock()
_public_lock = threading.Lock()


def get_workspace_manager() -> UserWorkspaceManager:
    global _workspace_manager_singleton
    if _workspace_manager_singleton is not None:
        return _workspace_manager_singleton
    with _workspace_lock:
        if _workspace_manager_singleton is None:
            _workspace_manager_singleton = UserWorkspaceManager()
        return _workspace_manager_singleton


def get_public_project_manager() -> PublicProjectManager:
    global _public_manager_singleton
    if _public_manager_singleton is not None:
        return _public_manager_singleton
    with _public_lock:
        if _public_manager_singleton is None:
            _public_manager_singleton = PublicProjectManager()
        return _public_manager_singleton

