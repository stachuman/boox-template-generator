"""
Project management service for master/plan architecture.

Handles CRUD operations for projects, masters, and plans with on-disk storage.
Projects are stored under a dedicated root (env EINK_PROJECTS_DIR or
"backend/data/projects"), with one subdirectory per project containing:
  - project.json            (metadata, plan, inline masters summary)
  - masters/<name>.yaml     (each master’s original template YAML)
  - plan.yaml               (plan document for inspection)
  - compiled/               (latest compiled template snapshots)

Follows CLAUDE.md standards - no dummy implementations.
"""

import json
import os
import shutil
import yaml
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any

from ..core.project_schema import (
    Project, ProjectMetadata, Master, Plan, PlanSection, CalendarConfig,
    ProjectListItem, LinkResolution
)
from ..core.schema import Template, Widget
from ..core.utils import convert_enums_for_serialization
from ..core.profiles import (
    load_device_profile, get_default_canvas_config, DeviceProfileError
)
from ..validation.yaml_validator import parse_yaml_template, TemplateParseError, SchemaValidationError


class ProjectServiceError(Exception):
    """Base exception for project service errors."""
    pass


def _get_canvas_config_for_profile(device_profile_name: str) -> Dict[str, Any]:
    """
    Get complete canvas configuration for a device profile.

    This is a thin wrapper around core.profiles.get_default_canvas_config()
    that converts DeviceProfileError to ProjectServiceError.

    Args:
        device_profile_name: Name of the device profile to use

    Returns:
        Complete canvas configuration dict

    Raises:
        ProjectServiceError: If profile cannot be loaded or has invalid data
    """
    try:
        profile = load_device_profile(device_profile_name)
        return get_default_canvas_config(profile)
    except DeviceProfileError as e:
        raise ProjectServiceError(f"Cannot load device profile '{device_profile_name}': {e}")


class ProjectService:
    """Service for managing projects with master/plan architecture."""

    def __init__(self, storage_dir: str = None):
        """
        Initialize project service.

        Args:
            storage_dir: Directory to store project files
        """
        env_base = os.getenv("EINK_PROJECTS_DIR")
        if storage_dir:
            self.storage_dir = Path(storage_dir)
        elif env_base:
            self.storage_dir = Path(env_base)
        else:
            # Resolve to repository-root/backend/data/projects
            repo_root = Path(__file__).resolve().parents[3]
            self.storage_dir = repo_root / "backend" / "data" / "projects"
        self.storage_dir.mkdir(parents=True, exist_ok=True)

        # Index file to track projects
        self.index_file = self.storage_dir / "index.json"
        self._load_index()

    def _load_index(self) -> None:
        """Load project index from disk."""
        if self.index_file.exists():
            try:
                with open(self.index_file, 'r') as f:
                    self._index = json.load(f)
                # Migrate old index entries that might be missing required fields
                self._migrate_index_entries()
            except (json.JSONDecodeError, IOError) as e:
                raise ProjectServiceError(f"Failed to load project index: {e}")
        else:
            self._index = {}

    def _migrate_index_entries(self) -> None:
        """Migrate old index entries to include required fields."""
        needs_save = False
        for project_id, entry in self._index.items():
            # Add missing fields with actual counts if they don't exist
            try:
                project_file = self._get_project_file(project_id)
                project_data = None
                if project_file.exists():
                    with open(project_file, 'r') as f:
                        project_data = json.load(f)
            except (IOError, json.JSONDecodeError):
                project_data = None

            if 'masters_count' not in entry or 'plan_sections_count' not in entry:
                if project_data:
                    entry['masters_count'] = len(project_data.get('masters', []))
                    entry['plan_sections_count'] = len(project_data.get('plan', {}).get('sections', []))
                else:
                    entry.setdefault('masters_count', 0)
                    entry.setdefault('plan_sections_count', 0)
                needs_save = True

            if 'is_public' not in entry:
                entry['is_public'] = False
                needs_save = True
            if 'public_url_slug' not in entry:
                entry['public_url_slug'] = None
                needs_save = True
            if 'clone_count' not in entry:
                entry['clone_count'] = 0
                needs_save = True
            if 'file_path' not in entry and project_data is not None:
                entry['file_path'] = str(self._get_project_file(project_id))
                needs_save = True

        if needs_save:
            self._save_index()

    def _save_index(self) -> None:
        """Save project index to disk."""
        try:
            with open(self.index_file, 'w') as f:
                json.dump(self._index, f, indent=2, default=str)
        except IOError as e:
            raise ProjectServiceError(f"Failed to save project index: {e}")

    def _build_index_entry(self, project: Project) -> Dict[str, Any]:
        """Construct the index payload for a project."""
        return {
            "id": project.id,
            "name": project.metadata.name,
            "description": project.metadata.description,
            "masters_count": len(project.masters),
            "plan_sections_count": len(project.plan.sections),
            "created_at": project.metadata.created_at,
            "updated_at": project.metadata.updated_at,
            "is_public": project.metadata.is_public,
            "public_url_slug": project.metadata.public_url_slug,
            "clone_count": project.metadata.clone_count,
            "file_path": str(self._get_project_file(project.id)),
        }

    def _refresh_index_entry(self, project: Project) -> None:
        """Persist the latest project metadata to the index."""
        self._index[project.id] = self._build_index_entry(project)
        self._save_index()

    def _get_project_dir(self, project_id: str) -> Path:
        """Get or create the directory for a project (and standard subdirs)."""
        pdir = self.storage_dir / project_id
        pdir.mkdir(parents=True, exist_ok=True)
        (pdir / "masters").mkdir(parents=True, exist_ok=True)
        (pdir / "compiled").mkdir(parents=True, exist_ok=True)
        return pdir

    def _replace_directory(self, target: Path, source: Path) -> None:
        """Replace directory contents atomically with the source directory."""
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(source, target)

    def _get_project_file(self, project_id: str) -> Path:
        """Get file path for project.json within its directory."""
        return self._get_project_dir(project_id) / "project.json"

    def _safe_name(self, name: str) -> str:
        """Return a filesystem-safe, lowercase slug for names."""
        import re
        base = (name or "").strip().lower()
        base = re.sub(r"\s+", "-", base)
        base = re.sub(r"[^a-z0-9._-]", "-", base)
        return base or "master"

    def create_project(self, name: str, description: str = "",
                      device_profile: str = "boox-note-air-4c",
                      author: str = "", category: str = "planner") -> Project:
        """
        Create a new project.

        Args:
            name: Project name
            description: Project description
            device_profile: Target device profile
            author: Project author
            category: Project category

        Returns:
            Created project

        Raises:
            ProjectServiceError: If creation fails
        """
        if not name.strip():
            raise ProjectServiceError("Project name cannot be empty")

        project_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        cleaned_author = author.strip()
        metadata = ProjectMetadata(
            name=name.strip(),
            description=description.strip(),
            device_profile=device_profile,
            author=cleaned_author,
            category=category.strip(),
            created_at=now,
            updated_at=now,
            is_public=False,
            public_url_slug=None,
            original_author=cleaned_author or None,
            cloned_from=None,
            clone_count=0,
        )

        # Create default plan without calendar dates (sections define their own dates)
        default_plan = Plan(
            calendar=CalendarConfig(
                start_date=None,
                end_date=None,
                pages_per_day=1
            ),
            sections=[],
            order=[]
        )

        # Get canvas configuration from device profile
        default_canvas = _get_canvas_config_for_profile(device_profile)

        project = Project(
            id=project_id,
            metadata=metadata,
            masters=[],
            plan=default_plan,
            link_resolution=LinkResolution(),
            default_canvas=default_canvas
        )

        # Save project file
        project_file = self._get_project_file(project_id)
        try:
            with open(project_file, 'w') as f:
                json.dump(project.model_dump(), f, indent=2, default=str)
        except IOError as e:
            raise ProjectServiceError(f"Failed to save project file: {e}")

        # Update index
        self._refresh_index_entry(project)

        return project

    def get_project(self, project_id: str) -> Optional[Project]:
        """
        Get project by ID.

        Args:
            project_id: Project unique identifier

        Returns:
            Project if found, None otherwise

        Raises:
            ProjectServiceError: If retrieval fails
        """
        if project_id not in self._index:
            return None

        project_file = self._get_project_file(project_id)
        if not project_file.exists():
            # Migrate legacy flat file to new per-project directory if present
            legacy = self.storage_dir / f"{project_id}.json"
            if legacy.exists():
                try:
                    pdir = self._get_project_dir(project_id)
                    legacy.replace(project_file)
                except OSError as e:
                    raise ProjectServiceError(f"Failed to migrate legacy project file: {e}")
            else:
                raise ProjectServiceError(f"Project file missing for ID {project_id}")

        try:
            with open(project_file, 'r') as f:
                project_data = json.load(f)
            return Project.model_validate(project_data)
        except (IOError, json.JSONDecodeError, ValueError) as e:
            raise ProjectServiceError(f"Failed to load project {project_id}: {e}")

    def list_projects(self) -> List[ProjectListItem]:
        """
        List all projects.

        Returns:
            List of project summaries

        Raises:
            ProjectServiceError: If listing fails
        """
        projects = []
        for project_id, project_info in self._index.items():
            # Ensure all required fields are present for ProjectListItem
            list_item_data = {
                "id": project_id,
                "name": project_info.get("name", "Unnamed Project"),
                "description": project_info.get("description", ""),
                "masters_count": project_info.get("masters_count", 0),
                "plan_sections_count": project_info.get("plan_sections_count", 0),
                "created_at": project_info.get("created_at", ""),
                "updated_at": project_info.get("updated_at", ""),
                "is_public": project_info.get("is_public", False),
                "public_url_slug": project_info.get("public_url_slug")
            }
            projects.append(ProjectListItem(**list_item_data))

        # Sort by creation date, newest first
        projects.sort(key=lambda p: p.created_at, reverse=True)
        return projects

    def update_project_metadata(self, project_id: str, **kwargs) -> Optional[Project]:
        """
        Update project metadata.

        Args:
            project_id: Project ID
            **kwargs: Fields to update (name, description, device_profile, author, category)

        Returns:
            Updated project if found, None otherwise

        Raises:
            ProjectServiceError: If update fails
        """
        project = self.get_project(project_id)
        if not project:
            return None

        # Update metadata fields
        updated_fields = {}
        for field in ['name', 'description', 'device_profile', 'author', 'category', 'is_public', 'public_url_slug', 'original_author', 'cloned_from', 'clone_count']:
            if field in kwargs:
                value = kwargs[field]
                if field == 'clone_count' and value is not None:
                    try:
                        value = int(value)
                    except (TypeError, ValueError) as exc:
                        raise ProjectServiceError('clone_count must be an integer') from exc
                setattr(project.metadata, field, value)
                updated_fields[field] = value

        if not updated_fields:
            return project  # No changes

        project.metadata.updated_at = datetime.now(timezone.utc).isoformat()

        # Save project
        self._save_project(project)
        self._refresh_index_entry(project)

        return project

    def validate_and_fix_canvas(self, project_id: str) -> Optional[Project]:
        """
        Validate that project canvas matches device profile, and fix if needed.

        This ensures canvas dimensions are always correct for the project's
        current device profile. Handles cases where:
        - Profile was changed after project creation
        - Project was created before orientation-aware fix
        - Canvas was manually edited

        Args:
            project_id: Project ID

        Returns:
            Updated project if canvas was fixed, None if already correct or project not found

        Raises:
            ProjectServiceError: If validation/fix fails
        """
        project = self.get_project(project_id)
        if not project:
            return None

        if not project.default_canvas:
            raise ProjectServiceError(
                f"Project {project_id} has no default_canvas configuration"
            )

        # Get expected canvas from current device profile
        expected_canvas = _get_canvas_config_for_profile(project.metadata.device_profile)
        expected_dims = expected_canvas["dimensions"]

        # Check if current canvas matches expected
        current_dims = project.default_canvas["dimensions"]

        # Compare with small tolerance for floating point
        width_match = abs(current_dims["width"] - expected_dims["width"]) < 0.1
        height_match = abs(current_dims["height"] - expected_dims["height"]) < 0.1

        if width_match and height_match:
            # Canvas is correct, no fix needed
            return None

        # Canvas doesn't match - needs fixing
        project.default_canvas = expected_canvas
        project.metadata.updated_at = datetime.now(timezone.utc).isoformat()

        # Save project
        self._save_project(project)
        self._refresh_index_entry(project)

        return project

    def recalculate_canvas_dimensions(self, project_id: str) -> Optional[Project]:
        """
        Recalculate and update project's default_canvas based on current device profile.

        This is a compatibility wrapper around validate_and_fix_canvas().
        Use validate_and_fix_canvas() for new code.

        Args:
            project_id: Project ID

        Returns:
            Updated project if found, original project if already correct

        Raises:
            ProjectServiceError: If update fails or profile invalid
        """
        result = self.validate_and_fix_canvas(project_id)
        # If canvas was already correct, validate_and_fix_canvas returns None
        # For compatibility, return the project in that case
        if result is None:
            return self.get_project(project_id)
        return result

    def delete_project(self, project_id: str) -> bool:
        """
        Delete project by ID.

        Args:
            project_id: Project unique identifier

        Returns:
            True if deleted, False if not found

        Raises:
            ProjectServiceError: If deletion fails
        """
        if project_id not in self._index:
            return False

        project_file = self._get_project_file(project_id)
        if project_file.exists():
            try:
                project_file.unlink()
            except OSError as e:
                raise ProjectServiceError(f"Failed to delete project file: {e}")

        # Remove from index
        del self._index[project_id]
        self._save_index()
        return True

    def add_master(self, project_id: str, name: str, template_yaml: str,
                  description: str = "") -> Optional[Project]:
        """
        Add a master to project.

        Args:
            project_id: Project ID
            name: Master name (must be unique within project)
            template_yaml: YAML template content
            description: Master description

        Returns:
            Updated project if successful, None if project not found

        Raises:
            ProjectServiceError: If addition fails
        """
        project = self.get_project(project_id)
        if not project:
            return None

        # Validate template YAML
        try:
            template = parse_yaml_template(template_yaml)
        except (TemplateParseError, SchemaValidationError) as e:
            raise ProjectServiceError(f"Invalid template YAML: {e}")

        # Check for duplicate master names
        if any(master.name == name for master in project.masters):
            raise ProjectServiceError(f"Master name '{name}' already exists in project")

        # Convert template widgets to Widget models
        widgets = []
        for widget_data in template.widgets:
            if isinstance(widget_data, dict):
                widgets.append(Widget.model_validate(widget_data))
            else:
                widgets.append(widget_data)

        # Create master
        now = datetime.now(timezone.utc).isoformat()
        master = Master(
            name=name,
            description=description,
            widgets=widgets,
            created_at=now,
            updated_at=now
        )

        project.masters.append(master)
        project.metadata.updated_at = now

        # Save project
        self._save_project(project)

        # Persist master YAML alongside project for inspection
        masters_dir = self._get_project_dir(project_id) / "masters"
        file_name = f"{self._safe_name(name)}.yaml"
        try:
            with open(masters_dir / file_name, "w", encoding="utf-8") as f:
                f.write(template_yaml)
        except OSError as e:
            raise ProjectServiceError(f"Failed to save master YAML: {e}")

        # Update index master count
        self._refresh_index_entry(project)

        return project

    def update_master(self, project_id: str, master_name: str,
                     template_yaml: Optional[str] = None,
                     new_name: Optional[str] = None,
                     description: Optional[str] = None) -> Optional[Project]:
        """
        Update a master in project.

        Args:
            project_id: Project ID
            master_name: Current master name
            template_yaml: New template YAML (optional)
            new_name: New master name (optional)
            description: New description (optional)

        Returns:
            Updated project if successful, None if project/master not found

        Raises:
            ProjectServiceError: If update fails
        """
        project = self.get_project(project_id)
        if not project:
            return None

        # Find master
        master_index = None
        for i, master in enumerate(project.masters):
            if master.name == master_name:
                master_index = i
                break

        if master_index is None:
            raise ProjectServiceError(f"Master '{master_name}' not found in project")

        master = project.masters[master_index]

        # Validate new template if provided
        if template_yaml is not None:
            try:
                template = parse_yaml_template(template_yaml)
                # Convert template widgets to Widget models
                widgets = []
                for widget_data in template.widgets:
                    if isinstance(widget_data, dict):
                        widgets.append(Widget.model_validate(widget_data))
                    else:
                        widgets.append(widget_data)
                master.widgets = widgets
            except (TemplateParseError, SchemaValidationError) as e:
                raise ProjectServiceError(f"Invalid template YAML: {e}")

        # Update name if provided
        if new_name is not None and new_name != master_name:
            # Check for duplicate names
            if any(m.name == new_name for m in project.masters if m != master):
                raise ProjectServiceError(f"Master name '{new_name}' already exists in project")
            master.name = new_name

        # Update description if provided
        if description is not None:
            master.description = description

        # Update timestamps
        now = datetime.now(timezone.utc).isoformat()
        master.updated_at = now
        project.metadata.updated_at = now

        # Save project
        self._save_project(project)
        self._refresh_index_entry(project)

        # Update master YAML file if provided; handle rename
        pdir = self._get_project_dir(project_id)
        masters_dir = pdir / "masters"
        try:
            if template_yaml is not None:
                fname = f"{self._safe_name(master.name)}.yaml"
                with open(masters_dir / fname, "w", encoding="utf-8") as f:
                    f.write(template_yaml)
            if new_name and new_name != master_name:
                old_fname = f"{self._safe_name(master_name)}.yaml"
                old_path = masters_dir / old_fname
                if old_path.exists():
                    try:
                        old_path.unlink()
                    except OSError:
                        pass
        except OSError as e:
            raise ProjectServiceError(f"Failed to persist master YAML: {e}")

        return project

    def remove_master(self, project_id: str, master_name: str) -> Optional[Project]:
        """
        Remove a master from project.

        Args:
            project_id: Project ID
            master_name: Master name to remove

        Returns:
            Updated project if successful, None if project not found

        Raises:
            ProjectServiceError: If removal fails
        """
        project = self.get_project(project_id)
        if not project:
            return None

        # Find and remove master
        original_count = len(project.masters)
        project.masters = [master for master in project.masters if master.name != master_name]

        if len(project.masters) == original_count:
            raise ProjectServiceError(f"Master '{master_name}' not found in project")

        # Remove any plan sections that reference this master
        project.plan.sections = [
            section for section in project.plan.sections
            if section.master != master_name
        ]

        # Update plan order to remove references to removed sections
        updated_order = []
        remaining_kinds = {section.kind for section in project.plan.sections}
        for kind in project.plan.order:
            if kind in remaining_kinds:
                updated_order.append(kind)
        project.plan.order = updated_order

        # Update timestamps
        now = datetime.now(timezone.utc).isoformat()
        project.metadata.updated_at = now

        # Save project
        self._save_project(project)

        # Remove master YAML file (best effort)
        masters_dir = self._get_project_dir(project_id) / "masters"
        fpath = masters_dir / f"{self._safe_name(master_name)}.yaml"
        if fpath.exists():
            try:
                fpath.unlink()
            except OSError:
                pass

        # Update index
        self._refresh_index_entry(project)

        return project

    def update_plan(self, project_id: str, plan_data: Dict[str, Any]) -> Optional[Project]:
        """
        Update plan for project.

        Args:
            project_id: Project ID
            plan_data: Plan configuration dictionary

        Returns:
            Updated project if successful, None if project not found

        Raises:
            ProjectServiceError: If update fails
        """
        project = self.get_project(project_id)
        if not project:
            return None

        # Validate plan data
        try:
            plan = Plan.model_validate(plan_data)
        except ValueError as e:
            raise ProjectServiceError(f"Invalid plan data: {e}")

        # Validate master references
        master_names = {master.name for master in project.masters}
        for section in plan.sections:
            if section.master not in master_names:
                raise ProjectServiceError(f"Plan section references unknown master '{section.master}'")

        project.plan = plan
        project.metadata.updated_at = datetime.now(timezone.utc).isoformat()

        # Save project
        self._save_project(project)
        self._refresh_index_entry(project)

        # Also persist plan.yaml for easier debugging
        pdir = self._get_project_dir(project_id)
        try:
            # Convert enums to raw values for YAML serialization
            serializable = {"plan": convert_enums_for_serialization(plan.model_dump())}
            with open(pdir / "plan.yaml", "w", encoding="utf-8") as f:
                yaml.safe_dump(serializable, f, sort_keys=False, allow_unicode=True)
        except OSError as e:
            raise ProjectServiceError(f"Failed to save plan.yaml: {e}")

        return project

    def import_project(
        self,
        project: Project,
        masters_source_dir: Optional[Path] = None,
        plan_source_path: Optional[Path] = None,
        compiled_source_dir: Optional[Path] = None,
    ) -> Project:
        """Import a fully-populated project into the workspace."""
        pdir = self._get_project_dir(project.id)
        self._save_project(project)
        masters_dir = pdir / "masters"
        compiled_dir = pdir / "compiled"
        masters_dir.mkdir(parents=True, exist_ok=True)
        compiled_dir.mkdir(parents=True, exist_ok=True)
        if masters_source_dir and masters_source_dir.exists():
            self._replace_directory(masters_dir, masters_source_dir)
        if compiled_source_dir and compiled_source_dir.exists():
            self._replace_directory(compiled_dir, compiled_source_dir)
        if plan_source_path and plan_source_path.exists():
            target_plan = pdir / "plan.yaml"
            try:
                shutil.copy2(plan_source_path, target_plan)
            except OSError as exc:
                raise ProjectServiceError(f"Failed to copy plan file: {exc}") from exc
        self._refresh_index_entry(project)
        return project

    def _save_project(self, project: Project) -> None:
        """Save project to disk."""
        project_file = self._get_project_file(project.id)
        try:
            with open(project_file, 'w') as f:
                json.dump(project.model_dump(), f, indent=2, default=str)
        except IOError as e:
            raise ProjectServiceError(f"Failed to save project: {e}")
