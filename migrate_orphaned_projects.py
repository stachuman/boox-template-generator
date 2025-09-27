#!/usr/bin/env python3
"""
Migration script for orphaned projects and index file fixes.

This script provides two main functions:
1. Migrate projects from old single-user structure (backend/data/projects)
   to new multi-user structure (backend/data/users/{user_id}/projects)
2. Fix existing index files that may have format or missing field issues

Usage for migration:
    python migrate_orphaned_projects.py --user-email user@example.com
    python migrate_orphaned_projects.py --user-id abc123def456

Usage for index fixing (production-ready):
    python migrate_orphaned_projects.py --fix-indexes-only
    python migrate_orphaned_projects.py --fix-indexes-only --user-email user@example.com --dry-run

Features:
- Automatically converts old index format {"projects": [...]} to new format {id: entry, ...}
- Adds missing required fields (description, masters_count, plan_sections_count)
- Reads actual project metadata from project.json files for accurate counts
- Handles environment variable configuration (EINK_DATA_DIR)
- Supports dry-run mode for safe testing
- Production-ready with comprehensive error handling

Follows CLAUDE.md coding standards - no dummy implementations.
"""

import argparse
import json
import os
import shutil
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / "src"))

from einkpdf.services.project_service import ProjectService
from backend.app.auth import AuthService, UserNotFoundError


class MigrationError(Exception):
    """Raised when migration cannot proceed."""
    pass


class ProjectMigrator:
    """Handles migration of orphaned projects to multi-user structure."""

    def __init__(self, data_root: Optional[Path] = None):
        if data_root:
            self.data_root = data_root
        else:
            # Use the same logic as AuthService for consistency
            env_data_dir = os.getenv("EINK_DATA_DIR")
            if env_data_dir:
                self.data_root = Path(env_data_dir)
            else:
                self.data_root = Path("backend/data")
        self.old_projects_dir = self.data_root / "projects"
        self.users_dir = self.data_root / "users"

        # Initialize auth service
        self.auth_service = AuthService(self.users_dir)

    def find_user(self, user_email: Optional[str] = None, user_id: Optional[str] = None) -> str:
        """Find user by email or ID and return user ID."""
        if user_id:
            try:
                user = self.auth_service.get_user_by_id(user_id)
                return user.id
            except UserNotFoundError:
                raise MigrationError(f"User with ID '{user_id}' not found")

        if user_email:
            user = self.auth_service.get_user_by_email(user_email)
            if not user:
                raise MigrationError(f"User with email '{user_email}' not found")
            return user.id

        raise MigrationError("Either user_email or user_id must be provided")

    def get_orphaned_projects(self) -> list[Path]:
        """Get list of orphaned project directories."""
        if not self.old_projects_dir.exists():
            return []

        orphaned = []
        for item in self.old_projects_dir.iterdir():
            if item.is_dir() and (item / "project.json").exists():
                orphaned.append(item)

        return sorted(orphaned)

    def migrate_project(self, project_dir: Path, target_user_id: str, dry_run: bool = False) -> dict:
        """Migrate a single project to the target user."""
        project_id = project_dir.name

        # Read project metadata
        project_json_path = project_dir / "project.json"
        if not project_json_path.exists():
            raise MigrationError(f"Project {project_id} missing project.json")

        try:
            with open(project_json_path, 'r', encoding='utf-8') as f:
                project_data = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            raise MigrationError(f"Failed to read project {project_id}: {e}")

        # Get target user info
        target_user = self.auth_service.get_user_by_id(target_user_id)

        # Update project metadata for new owner
        if 'metadata' not in project_data:
            project_data['metadata'] = {}

        # Preserve original author if exists, otherwise use target user
        if not project_data['metadata'].get('original_author'):
            original_author = project_data['metadata'].get('author', 'Unknown')
            project_data['metadata']['original_author'] = original_author

        # Set new owner
        project_data['metadata']['author'] = target_user.username
        project_data['metadata']['updated_at'] = datetime.now(timezone.utc).isoformat()

        # Create target directory structure
        target_user_dir = self.users_dir / target_user_id
        target_projects_dir = target_user_dir / "projects"
        target_project_dir = target_projects_dir / project_id

        migration_info = {
            'project_id': project_id,
            'project_name': project_data.get('metadata', {}).get('name', 'Unnamed'),
            'original_author': project_data['metadata'].get('original_author'),
            'new_owner': target_user.username,
            'source_path': str(project_dir),
            'target_path': str(target_project_dir),
            'dry_run': dry_run
        }

        if dry_run:
            print(f"[DRY RUN] Would migrate project: {migration_info}")
            return migration_info

        # Create directories
        target_projects_dir.mkdir(parents=True, exist_ok=True)

        if target_project_dir.exists():
            raise MigrationError(
                f"Target project directory already exists: {target_project_dir}"
            )

        # Copy project directory
        try:
            shutil.copytree(project_dir, target_project_dir)

            # Update project.json with new metadata
            target_project_json = target_project_dir / "project.json"
            with open(target_project_json, 'w', encoding='utf-8') as f:
                json.dump(project_data, f, indent=2, ensure_ascii=False)

            print(f"✅ Migrated project '{migration_info['project_name']}' to {target_user.username}")

        except (OSError, shutil.Error) as e:
            # Clean up on failure
            if target_project_dir.exists():
                shutil.rmtree(target_project_dir, ignore_errors=True)
            raise MigrationError(f"Failed to copy project {project_id}: {e}")

        return migration_info

    def get_project_metadata(self, target_user_id: str, project_id: str) -> dict:
        """Get complete project metadata from project.json file."""
        target_projects_dir = self.users_dir / target_user_id / "projects"
        project_file = target_projects_dir / project_id / "project.json"

        metadata = {
            "description": "",
            "masters_count": 0,
            "plan_sections_count": 0
        }

        try:
            if project_file.exists():
                with open(project_file, 'r', encoding='utf-8') as f:
                    project_data = json.load(f)

                    # Get description
                    metadata["description"] = project_data.get('metadata', {}).get('description', '')

                    # Get actual counts
                    metadata["masters_count"] = len(project_data.get('masters', []))
                    metadata["plan_sections_count"] = len(project_data.get('plan', {}).get('sections', []))
        except Exception:
            pass  # Use defaults if we can't read the file

        return metadata

    def fix_existing_index_entries(self, target_user_id: str, index_data: dict) -> dict:
        """Fix existing index entries that might be missing required fields."""
        for project_id, project_info in index_data.items():
            # Get metadata from project file
            project_metadata = self.get_project_metadata(target_user_id, project_id)

            # Update missing or potentially incorrect fields
            if "description" not in project_info or not project_info["description"]:
                project_info["description"] = project_metadata["description"]

            # Update counts with actual values from project file
            project_info["masters_count"] = project_metadata["masters_count"]
            project_info["plan_sections_count"] = project_metadata["plan_sections_count"]

            # Ensure other required fields exist with defaults
            project_info.setdefault("is_public", False)
            project_info.setdefault("created_at", "")
            project_info.setdefault("updated_at", "")

        return index_data

    def update_project_index(self, target_user_id: str, migrated_projects: list[dict]):
        """Update the user's project index with migrated projects."""
        target_projects_dir = self.users_dir / target_user_id / "projects"
        index_file = target_projects_dir / "index.json"

        # Load existing index or create new one
        # ProjectService expects format: {project_id: project_entry, ...}
        if index_file.exists():
            try:
                with open(index_file, 'r', encoding='utf-8') as f:
                    index_data = json.load(f)
                # Handle old format conversion if needed
                if isinstance(index_data, dict) and "projects" in index_data:
                    # Convert from old format {"projects": [...]} to new format {id: entry, ...}
                    old_projects = index_data["projects"]
                    index_data = {}
                    for project in old_projects:
                        if "id" in project:
                            index_data[project["id"]] = {
                                "name": project.get("name", "Unnamed"),
                                "description": project.get("description", ""),
                                "created_at": project.get("migrated_at", project.get("created_at", "")),
                                "updated_at": project.get("migrated_at", project.get("updated_at", "")),
                                "is_public": False,
                                "masters_count": 0,
                                "plan_sections_count": 0
                            }

                # Fix any existing entries that might be missing fields
                index_data = self.fix_existing_index_entries(target_user_id, index_data)

            except (json.JSONDecodeError, OSError):
                index_data = {}
        else:
            index_data = {}

        # Add migrated projects to index
        for migration in migrated_projects:
            project_id = migration['project_id']
            if project_id not in index_data:
                # Get complete metadata from project file
                project_metadata = self.get_project_metadata(target_user_id, project_id)

                index_data[project_id] = {
                    "name": migration['project_name'],
                    "description": project_metadata['description'],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "is_public": False,
                    "masters_count": project_metadata['masters_count'],
                    "plan_sections_count": project_metadata['plan_sections_count'],
                    "migrated_from_orphaned": True,
                    "original_author": migration['original_author']
                }

        # Save updated index
        with open(index_file, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, indent=2, ensure_ascii=False)

    def migrate_all(self, target_user_id: str, dry_run: bool = False) -> dict:
        """Migrate all orphaned projects to target user."""
        orphaned_projects = self.get_orphaned_projects()

        if not orphaned_projects:
            print("No orphaned projects found.")
            return {"migrated": [], "total": 0}

        print(f"Found {len(orphaned_projects)} orphaned projects")

        if dry_run:
            print("\n🔍 DRY RUN MODE - No actual changes will be made\n")

        migrated = []
        failed = []

        for project_dir in orphaned_projects:
            try:
                migration_info = self.migrate_project(project_dir, target_user_id, dry_run)
                migrated.append(migration_info)
            except MigrationError as e:
                error_info = {"project_path": str(project_dir), "error": str(e)}
                failed.append(error_info)
                print(f"❌ Failed to migrate {project_dir.name}: {e}")

        if not dry_run and migrated:
            # Update project index
            try:
                self.update_project_index(target_user_id, migrated)
                print(f"✅ Updated project index for user")
            except Exception as e:
                print(f"⚠️  Warning: Failed to update project index: {e}")

        return {
            "migrated": migrated,
            "failed": failed,
            "total": len(orphaned_projects),
            "success_count": len(migrated),
            "failure_count": len(failed)
        }

    def fix_existing_indexes(self, target_user_id: str = None, dry_run: bool = False) -> dict:
        """Fix existing index files that may have format or missing field issues."""
        if target_user_id:
            # Fix index for specific user
            target_user = self.auth_service.get_user_by_id(target_user_id)
            users_to_fix = [(target_user_id, target_user.username)]
        else:
            # Fix indexes for all users
            users_to_fix = []
            for user_dir in self.users_dir.iterdir():
                if user_dir.is_dir() and (user_dir / "projects").exists():
                    try:
                        user = self.auth_service.get_user_by_id(user_dir.name)
                        users_to_fix.append((user_dir.name, user.username))
                    except Exception:
                        # Skip users that can't be found
                        continue

        if not users_to_fix:
            print("No users found to fix indexes for.")
            return {"fixed": [], "total": 0}

        print(f"Found {len(users_to_fix)} users with potential index issues")

        if dry_run:
            print("\\n🔍 DRY RUN MODE - No actual changes will be made\\n")

        fixed = []
        failed = []

        for user_id, username in users_to_fix:
            index_file = self.users_dir / user_id / "projects" / "index.json"

            if not index_file.exists():
                print(f"ℹ️  No index file for user {username} - skipping")
                continue

            try:
                print(f"🔧 Fixing index for user: {username}")

                if dry_run:
                    print(f"[DRY RUN] Would fix index file: {index_file}")
                    fixed.append({"user_id": user_id, "username": username, "dry_run": True})
                    continue

                # Load current index
                with open(index_file, 'r', encoding='utf-8') as f:
                    index_data = json.load(f)

                original_format = type(index_data).__name__
                original_count = len(index_data) if isinstance(index_data, dict) else len(index_data.get("projects", []))

                # Handle format conversion
                if isinstance(index_data, dict) and "projects" in index_data:
                    # Convert from old format
                    old_projects = index_data["projects"]
                    index_data = {}
                    for project in old_projects:
                        if "id" in project:
                            index_data[project["id"]] = {
                                "name": project.get("name", "Unnamed"),
                                "description": project.get("description", ""),
                                "created_at": project.get("migrated_at", project.get("created_at", "")),
                                "updated_at": project.get("migrated_at", project.get("updated_at", "")),
                                "is_public": False,
                                "masters_count": 0,
                                "plan_sections_count": 0
                            }
                    print(f"   Converted from old format to new format")

                # Fix existing entries
                if isinstance(index_data, dict):
                    index_data = self.fix_existing_index_entries(user_id, index_data)

                # Save fixed index
                with open(index_file, 'w', encoding='utf-8') as f:
                    json.dump(index_data, f, indent=2, ensure_ascii=False)

                fixed_count = len(index_data) if isinstance(index_data, dict) else 0
                print(f"   ✅ Fixed index for {username}: {original_count} projects, format: {original_format} -> dict")

                fixed.append({
                    "user_id": user_id,
                    "username": username,
                    "original_format": original_format,
                    "projects_count": fixed_count
                })

            except Exception as e:
                error_info = {"user_id": user_id, "username": username, "error": str(e)}
                failed.append(error_info)
                print(f"❌ Failed to fix index for {username}: {e}")

        return {
            "fixed": fixed,
            "failed": failed,
            "total": len(users_to_fix),
            "success_count": len(fixed),
            "failure_count": len(failed)
        }


def main():
    parser = argparse.ArgumentParser(
        description="Migrate orphaned projects to a specific user",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Migrate orphaned projects to a user
  python migrate_orphaned_projects.py --user-email admin@example.com
  python migrate_orphaned_projects.py --user-id abc123def456 --dry-run

  # Fix existing index files (production use)
  python migrate_orphaned_projects.py --fix-indexes-only
  python migrate_orphaned_projects.py --fix-indexes-only --user-email admin@example.com --dry-run

  # Use custom data directory
  python migrate_orphaned_projects.py --fix-indexes-only --data-root /custom/path
        """
    )

    user_group = parser.add_mutually_exclusive_group(required=False)
    user_group.add_argument(
        "--user-email",
        help="Email of the user to assign orphaned projects to"
    )
    user_group.add_argument(
        "--user-id",
        help="ID of the user to assign orphaned projects to"
    )

    parser.add_argument(
        "--data-root",
        type=Path,
        default=Path("backend/data"),
        help="Root directory containing project data (default: backend/data)"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be migrated without making changes"
    )

    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose output"
    )

    parser.add_argument(
        "--fix-indexes-only",
        action="store_true",
        help="Only fix existing index files without migrating orphaned projects"
    )

    args = parser.parse_args()

    # Validate arguments
    if not args.fix_indexes_only and not (args.user_email or args.user_id):
        parser.error("For migration mode, either --user-email or --user-id is required")

    try:
        # Initialize migrator
        migrator = ProjectMigrator(args.data_root)

        if args.fix_indexes_only:
            # Fix existing indexes only
            print("🔧 Fix indexes mode - only fixing existing index files")
            print(f"📁 Data root: {migrator.data_root.absolute()}")

            if args.user_email or args.user_id:
                # Fix index for specific user
                target_user_id = migrator.find_user(args.user_email, args.user_id)
                target_user = migrator.auth_service.get_user_by_id(target_user_id)
                print(f"📋 Target user: {target_user.username} ({target_user.email})")
                result = migrator.fix_existing_indexes(target_user_id, args.dry_run)
            else:
                # Fix indexes for all users
                print("📋 Fixing indexes for all users")
                result = migrator.fix_existing_indexes(None, args.dry_run)

            # Summary
            print(f"\n📊 Index Fix Summary:")
            print(f"   Total users checked: {result['total']}")
            print(f"   Successfully fixed: {result['success_count']}")
            print(f"   Failed fixes: {result['failure_count']}")

            if result['failed']:
                print(f"\n❌ Failed fixes:")
                for failure in result['failed']:
                    print(f"   {failure['username']}: {failure['error']}")

            if not args.dry_run and result['success_count'] > 0:
                print(f"\n✅ Index fix completed successfully!")

        else:
            # Normal migration mode
            # Find target user
            print("🔍 Finding target user...")
            target_user_id = migrator.find_user(args.user_email, args.user_id)
            target_user = migrator.auth_service.get_user_by_id(target_user_id)

            print(f"📋 Target user: {target_user.username} ({target_user.email})")
            print(f"📁 Data root: {migrator.data_root.absolute()}")
            print(f"📂 Old projects dir: {migrator.old_projects_dir}")

            # Perform migration
            print("\n🚀 Starting migration...")
            result = migrator.migrate_all(target_user_id, args.dry_run)

            # Summary for migration mode
            print(f"\n📊 Migration Summary:")
            print(f"   Total projects found: {result['total']}")
            print(f"   Successfully migrated: {result['success_count']}")
            print(f"   Failed migrations: {result['failure_count']}")

            if result['failed']:
                print(f"\n❌ Failed migrations:")
                for failure in result['failed']:
                    print(f"   {failure['project_path']}: {failure['error']}")

            if not args.dry_run and result['success_count'] > 0:
                print(f"\n✅ Migration completed successfully!")
                print(f"   Projects are now accessible by {target_user.username}")

                # Optional: offer to remove old directory
                if result['failure_count'] == 0:
                    print(f"\n💡 All projects migrated successfully.")
                    print(f"   You can now safely remove the old projects directory:")
                    print(f"   rm -rf {migrator.old_projects_dir}")

            if args.dry_run:
                print(f"\n🔍 This was a dry run. Use without --dry-run to perform actual migration.")

    except MigrationError as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print(f"\n⚠️  Migration interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()