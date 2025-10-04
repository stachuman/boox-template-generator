# Version Management

This project uses a single source of truth for version numbers.

## How to Update Version

1. Edit the `VERSION` file with the new version number (e.g., `0.2.2`)

2. Run the version update script:
   ```bash
   python3 update-version.py
   ```

3. The script will automatically update version references in:
   - `backend/app/config.py` - Backend configuration
   - `pyproject.toml` - Python package version
   - `frontend/package.json` - Frontend package version
   - `docker-compose.yml` - Docker environment variable
   - `src/einkpdf/core/deterministic.py` - PDF metadata
   - `src/einkpdf/core/renderer.py` - PDF creator metadata

## Version Format

Versions follow semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes, backwards compatible

## Example

```bash
# Update VERSION file
echo "0.3.0" > VERSION

# Run update script
python3 update-version.py

# Verify changes
git diff
```

The script validates the version format and will fail if the format is invalid.
