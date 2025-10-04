#!/usr/bin/env python3
"""
Version update script.

Reads version from VERSION file and updates all references across the codebase.
Follows CLAUDE.md: No dummy implementations, explicit validation.
"""

import re
import sys
from pathlib import Path


def read_version() -> str:
    """Read version from VERSION file."""
    version_file = Path(__file__).parent / "VERSION"

    if not version_file.exists():
        raise FileNotFoundError("VERSION file not found")

    version = version_file.read_text().strip()

    # Validate version format (semantic versioning)
    if not re.match(r'^\d+\.\d+\.\d+$', version):
        raise ValueError(f"Invalid version format: {version}. Expected format: X.Y.Z")

    return version


def update_file(file_path: Path, pattern: str, replacement: str, flags: int = 0) -> bool:
    """
    Update version in a file using regex pattern.

    Args:
        file_path: Path to file to update
        pattern: Regex pattern to match (should have one capture group)
        replacement: Replacement string (use \\1 for version)
        flags: Optional regex flags (e.g., re.MULTILINE, re.DOTALL)

    Returns:
        True if file was modified, False otherwise
    """
    if not file_path.exists():
        print(f"Warning: {file_path} not found, skipping")
        return False

    content = file_path.read_text()
    new_content = re.sub(pattern, replacement, content, flags=flags)

    if content != new_content:
        file_path.write_text(new_content)
        print(f"✓ Updated {file_path}")
        return True
    else:
        print(f"  No change needed in {file_path}")
        return False


def main():
    """Update version across all files."""
    try:
        version = read_version()
        print(f"Updating to version: {version}\n")

        root = Path(__file__).parent

        # Define all files to update with their patterns
        # Format: (file_path, pattern, replacement, flags)
        updates = [
            # Backend config
            (
                root / "backend/app/config.py",
                r'APP_VERSION: str = "[^"]*"',
                f'APP_VERSION: str = "{version}"',
                0
            ),
            # Python package - ONLY [project] section, using DOTALL to match across lines
            (
                root / "pyproject.toml",
                r'(\[project\].*?\n)version = "[^"]*"',
                rf'\1version = "{version}"',
                re.DOTALL
            ),
            # Frontend package - ONLY top-level version field with MULTILINE
            (
                root / "frontend/package.json",
                r'^(\s*"name":.*?\n\s*"private":.*?\n\s*)"version": "[^"]*"',
                rf'\1"version": "{version}"',
                re.MULTILINE | re.DOTALL
            ),
            # Docker compose
            (
                root / "docker-compose.yml",
                r'APP_VERSION=[^\s]*',
                f'APP_VERSION={version}',
                0
            ),
            # Deterministic PDF metadata
            (
                root / "src/einkpdf/core/deterministic.py",
                r'E-ink PDF Templates v[0-9.]+',
                f'E-ink PDF Templates v{version}',
                0
            ),
            # Renderer PDF metadata
            (
                root / "src/einkpdf/core/renderer.py",
                r'E-ink PDF Templates v[0-9.]+',
                f'E-ink PDF Templates v{version}',
                0
            ),
        ]

        modified_count = 0
        for file_path, pattern, replacement, flags in updates:
            if update_file(file_path, pattern, replacement, flags):
                modified_count += 1

        print(f"\n✓ Updated {modified_count} file(s) to version {version}")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
