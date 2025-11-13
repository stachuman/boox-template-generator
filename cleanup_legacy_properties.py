#!/usr/bin/env python3
"""
One-time cleanup script to remove unused legacy properties from project widgets.

Following CLAUDE.md Rule #1: No dummy implementations
This script removes properties that are no longer used by the compilation system.

Usage:
    python cleanup_legacy_properties.py /root/eink/backend/data/users

What it fixes:
- link_list widgets: Removes label_template, bind, count, start_index, index_pad
- calendar widgets: Replaces show_month_year with show_month_name and show_year
- divider widgets: Migrates line_thickness/stroke_color from properties to styling
- vertical_line widgets: Migrates line_thickness/stroke_color from properties to styling

Processes both project.json AND masters/*.yaml files.
Backs up original files with .backup extension before modifying.
"""

import json
import sys
import yaml
from pathlib import Path
from typing import Dict, Any, List


# Legacy properties to remove per widget type
LEGACY_PROPERTIES = {
    'link_list': {
        'label_template',  # Replaced by explicit labels array
        'bind',            # Replaced by explicit destinations array
        'count',           # Dynamic generation removed
        'start_index',     # Dynamic generation removed
        'index_pad'        # Dynamic generation removed
    },
    'calendar': {
        'show_month_year'  # Split into show_month_name and show_year
    },
    'divider': {
        'line_thickness',  # Should be in styling.line_width
        'stroke_color'     # Should be in styling.stroke_color
    },
    'vertical_line': {
        'line_thickness',  # Should be in styling.line_width
        'stroke_color'     # Should be in styling.stroke_color
    }
}


def clean_widget_properties(widget: Dict[str, Any], changes_log: List[str]) -> bool:
    """
    Clean legacy properties from a widget.

    Args:
        widget: Widget dictionary to clean
        changes_log: List to append change descriptions

    Returns:
        True if any changes were made
    """
    if not isinstance(widget, dict):
        return False

    widget_type = widget.get('type')
    if not widget_type or widget_type not in LEGACY_PROPERTIES:
        return False

    properties = widget.get('properties')
    if not isinstance(properties, dict):
        return False

    changed = False
    legacy_props = LEGACY_PROPERTIES[widget_type]

    # Collect values for migration before removing
    migration_values = {}
    for prop_name in legacy_props:
        if prop_name in properties:
            migration_values[prop_name] = properties[prop_name]

    # Remove legacy properties
    for prop_name in legacy_props:
        if prop_name in properties:
            old_value = properties[prop_name]
            del properties[prop_name]
            changes_log.append(
                f"  Removed {widget_type}.properties.{prop_name} = {old_value!r} "
                f"from widget {widget.get('id', '?')}"
            )
            changed = True

    # Special handling for calendar: add replacement properties if show_month_year existed
    if widget_type == 'calendar' and 'show_month_year' in LEGACY_PROPERTIES['calendar']:
        # If we removed show_month_year and the new properties don't exist, add them
        if 'show_month_name' not in properties:
            properties['show_month_name'] = True
            changes_log.append(
                f"  Added calendar.properties.show_month_name = True "
                f"to widget {widget.get('id', '?')}"
            )
            changed = True
        if 'show_year' not in properties:
            properties['show_year'] = True
            changes_log.append(
                f"  Added calendar.properties.show_year = True "
                f"to widget {widget.get('id', '?')}"
            )
            changed = True

    # Special handling for divider/vertical_line: migrate properties to styling
    if widget_type in ['divider', 'vertical_line'] and migration_values:
        # Ensure styling dict exists
        if 'styling' not in widget:
            widget['styling'] = {}
        styling = widget['styling']

        # Migrate line_thickness -> line_width
        if 'line_thickness' in migration_values and 'line_width' not in styling:
            styling['line_width'] = migration_values['line_thickness']
            changes_log.append(
                f"  Migrated {widget_type}.properties.line_thickness -> styling.line_width = {migration_values['line_thickness']!r} "
                f"for widget {widget.get('id', '?')}"
            )
            changed = True

        # Migrate stroke_color
        if 'stroke_color' in migration_values and 'stroke_color' not in styling:
            styling['stroke_color'] = migration_values['stroke_color']
            changes_log.append(
                f"  Migrated {widget_type}.properties.stroke_color -> styling.stroke_color = {migration_values['stroke_color']!r} "
                f"for widget {widget.get('id', '?')}"
            )
            changed = True

    return changed


def clean_master_widgets(master: Dict[str, Any], changes_log: List[str]) -> bool:
    """Clean widgets in a master template."""
    if not isinstance(master, dict):
        return False

    widgets = master.get('widgets', [])
    if not isinstance(widgets, list):
        return False

    changed = False
    for widget in widgets:
        if clean_widget_properties(widget, changes_log):
            changed = True

    return changed


def clean_yaml_master_file(yaml_path: Path, dry_run: bool = False) -> bool:
    """
    Clean legacy properties from a YAML master file.

    Args:
        yaml_path: Path to master YAML file
        dry_run: If True, only report changes without saving

    Returns:
        True if changes were made
    """
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Processing YAML: {yaml_path.name}")

    try:
        # Load YAML master
        with open(yaml_path, 'r', encoding='utf-8') as f:
            master_data = yaml.safe_load(f)

        if not isinstance(master_data, dict):
            print(f"  ✗ ERROR: Invalid YAML structure")
            return False

        changes_log = []
        changed = False

        # Clean widgets in the master
        if clean_master_widgets(master_data, changes_log):
            changed = True

        if not changed:
            print("  ✓ No legacy properties found - already clean")
            return False

        # Report changes
        print("  Changes made:")
        for log_entry in changes_log:
            print(log_entry)

        if dry_run:
            print("  [DRY RUN] Would save changes (use --apply to save)")
            return True

        # Backup original
        backup_path = yaml_path.with_suffix('.yaml.backup')
        with open(backup_path, 'w', encoding='utf-8') as f:
            yaml.dump(master_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        print(f"  ✓ Backed up to: {backup_path}")

        # Save cleaned version
        with open(yaml_path, 'w', encoding='utf-8') as f:
            yaml.dump(master_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        print(f"  ✓ Saved cleaned master")

        return True

    except yaml.YAMLError as e:
        print(f"  ✗ ERROR: Invalid YAML - {e}")
        return False
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        return False


def clean_project_file(project_path: Path, dry_run: bool = False) -> bool:
    """
    Clean legacy properties from a project file.

    Args:
        project_path: Path to project.json file
        dry_run: If True, only report changes without saving

    Returns:
        True if changes were made
    """
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Processing: {project_path}")

    try:
        # Load project
        with open(project_path, 'r', encoding='utf-8') as f:
            project = json.load(f)

        changes_log = []
        changed = False

        # Clean masters
        masters = project.get('masters', [])
        if isinstance(masters, list):
            for master in masters:
                master_name = master.get('name', '?')
                master_changes = []
                if clean_master_widgets(master, master_changes):
                    changes_log.append(f"\nMaster '{master_name}':")
                    changes_log.extend(master_changes)
                    changed = True

        if not changed:
            print("  ✓ No legacy properties found - already clean")
            return False

        # Report changes
        print("  Changes made:")
        for log_entry in changes_log:
            print(log_entry)

        if dry_run:
            print("  [DRY RUN] Would save changes (use --apply to save)")
            return True

        # Backup original
        backup_path = project_path.with_suffix('.json.backup')
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(project, f, indent=2, ensure_ascii=False)
        print(f"  ✓ Backed up to: {backup_path}")

        # Save cleaned version
        with open(project_path, 'w', encoding='utf-8') as f:
            json.dump(project, f, indent=2, ensure_ascii=False)
        print(f"  ✓ Saved cleaned project")

        return True

    except json.JSONDecodeError as e:
        print(f"  ✗ ERROR: Invalid JSON - {e}")
        return False
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        return False


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Clean legacy properties from project files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run (preview changes without saving) - processes all projects
  python cleanup_legacy_properties.py /root/eink/backend/data/projects

  # Apply changes to all projects
  python cleanup_legacy_properties.py /root/eink/backend/data/projects --apply

  # Clean specific project.json file
  python cleanup_legacy_properties.py /root/eink/backend/data/projects/PROJECT_ID/project.json --apply

  # Clean specific master YAML file
  python cleanup_legacy_properties.py /root/eink/backend/data/projects/PROJECT_ID/masters/month.yaml --apply
        """
    )
    parser.add_argument(
        'path',
        type=str,
        help='Path to projects directory or specific project.json file'
    )
    parser.add_argument(
        '--apply',
        action='store_true',
        help='Apply changes (default is dry-run mode)'
    )

    args = parser.parse_args()

    path = Path(args.path)
    dry_run = not args.apply

    if not path.exists():
        print(f"ERROR: Path does not exist: {path}")
        sys.exit(1)

    # Determine if single file or directory
    project_files = []
    yaml_master_files = []

    if path.is_file():
        if path.name == 'project.json':
            project_files = [path]
        elif path.suffix == '.yaml':
            yaml_master_files = [path]
        else:
            print(f"ERROR: File must be 'project.json' or '*.yaml', got: {path.name}")
            sys.exit(1)
    elif path.is_dir():
        # Find all project.json files in users directory structure
        # Pattern: /users/{user_hash}/projects/{project_id}/project.json
        project_files = list(path.glob('*/projects/*/project.json'))

        # Find all master YAML files in users directory structure
        # Pattern: /users/{user_hash}/projects/{project_id}/masters/*.yaml
        yaml_master_files = list(path.glob('*/projects/*/masters/*.yaml'))

        if not project_files and not yaml_master_files:
            print(f"ERROR: No project.json or master YAML files found in: {path}")
            print(f"Expected pattern: {{user_hash}}/projects/{{project_id}}/...")
            sys.exit(1)
    else:
        print(f"ERROR: Path is neither file nor directory: {path}")
        sys.exit(1)

    print(f"{'=' * 70}")
    print(f"Legacy Properties Cleanup Script")
    print(f"{'=' * 70}")
    print(f"Mode: {'DRY RUN (preview only)' if dry_run else 'APPLY CHANGES'}")
    print(f"Found {len(project_files)} project.json file(s)")
    print(f"Found {len(yaml_master_files)} master YAML file(s)")

    if dry_run:
        print("\n⚠️  DRY RUN MODE - No files will be modified")
        print("    Use --apply flag to actually save changes\n")

    # Process project.json files
    total_changed = 0
    total_clean = 0
    total_errors = 0

    if project_files:
        print(f"\n{'=' * 70}")
        print("Processing project.json files...")
        print(f"{'=' * 70}")

        for project_file in sorted(project_files):
            try:
                if clean_project_file(project_file, dry_run=dry_run):
                    total_changed += 1
                else:
                    total_clean += 1
            except Exception as e:
                print(f"\n✗ Unexpected error processing {project_file}: {e}")
                total_errors += 1

    # Process YAML master files
    if yaml_master_files:
        print(f"\n{'=' * 70}")
        print("Processing master YAML files...")
        print(f"{'=' * 70}")

        for yaml_file in sorted(yaml_master_files):
            try:
                if clean_yaml_master_file(yaml_file, dry_run=dry_run):
                    total_changed += 1
                else:
                    total_clean += 1
            except Exception as e:
                print(f"\n✗ Unexpected error processing {yaml_file}: {e}")
                total_errors += 1

    # Summary
    print(f"\n{'=' * 70}")
    print(f"Summary:")
    print(f"  Projects with changes: {total_changed}")
    print(f"  Projects already clean: {total_clean}")
    if total_errors:
        print(f"  Errors: {total_errors}")
    print(f"{'=' * 70}")

    if dry_run and total_changed > 0:
        print(f"\n💡 Run with --apply to save changes")
    elif total_changed > 0:
        print(f"\n✓ Changes applied successfully!")
        print(f"  Backups saved with .backup extension")

    sys.exit(0 if total_errors == 0 else 1)


if __name__ == '__main__':
    main()
