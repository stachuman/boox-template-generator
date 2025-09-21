"""
YAML template validation with comprehensive error reporting.

This module provides template parsing, schema validation, and error handling
following the coding standards in CLAUDE.md. No dummy implementations allowed.
"""

import yaml
from typing import Dict, Any
from pydantic import ValidationError as PydanticValidationError

from ..core.schema import Template


class ValidationError(Exception):
    """Base exception for template validation failures."""
    pass


class TemplateParseError(ValidationError):
    """Raised when YAML template cannot be parsed."""
    pass


class SchemaValidationError(ValidationError):
    """Raised when template fails Pydantic schema validation."""
    pass


def _default_profile() -> str:
    """Resolve a default device profile without importing core.profiles to avoid cycles."""
    import os
    from pathlib import Path

    # 1) Environment override
    env_dir = os.getenv("EINK_PROFILE_DIR")
    if env_dir:
        base = Path(env_dir)
    else:
        # 2) Repo-level config/profiles
        # src/einkpdf/validation/yaml_validator.py -> project root is parents[3]
        try:
            base = Path(__file__).resolve().parents[3] / "config" / "profiles"
        except Exception:
            base = None
        # 3) Package-relative fallback
        if not base or not base.exists():
            base = Path(__file__).resolve().parents[1] / "core" / "config" / "profiles"

    choices = []
    try:
        if base and base.exists():
            for pattern in ("*.yaml", "*.yml"):
                for p in base.glob(pattern):
                    if p.is_file():
                        choices.append(p.stem)
    except Exception:
        pass

    preferred = "boox-note-air-4c"
    if preferred in choices:
        return preferred
    return choices[0] if choices else "default"


def parse_yaml_template(yaml_content: str) -> Template:
    """
    Parse and validate YAML template content.
    
    Args:
        yaml_content: Raw YAML string content
        
    Returns:
        Validated Template instance
        
    Raises:
        TemplateParseError: If YAML is malformed or missing required fields
        SchemaValidationError: If template fails schema validation
    """
    if not isinstance(yaml_content, str):
        raise TemplateParseError("YAML content must be a string")
    
    if not yaml_content.strip():
        raise TemplateParseError("YAML content cannot be empty")
    
    # Parse YAML with strict error handling
    try:
        raw_data = yaml.safe_load(yaml_content)
    except yaml.YAMLError as e:
        raise TemplateParseError(f"Invalid YAML syntax: {e}")
    
    # Validate parsed data structure
    if raw_data is None:
        raise TemplateParseError("YAML content resulted in None - check for empty document")
    
    if not isinstance(raw_data, dict):
        raise TemplateParseError("Template must be a YAML object/dictionary, not a list or scalar")
    
    # Check for required schema version
    if "schema_version" not in raw_data:
        raise TemplateParseError(
            "Missing required 'schema_version' field. Template must specify schema_version: '1.0'"
        )
    
    schema_version = raw_data.get("schema_version")
    if schema_version != "1.0":
        raise TemplateParseError(
            f"Unsupported schema version '{schema_version}'. Only version '1.0' is supported."
        )
    
    # Auto-fill default device profile if missing/empty to keep UX smooth
    try:
        md = raw_data.get("metadata") if isinstance(raw_data, dict) else None
        if isinstance(md, dict):
            prof = md.get("profile")
            if not prof or (isinstance(prof, str) and not prof.strip()):
                md["profile"] = _default_profile()
    except Exception:
        # Non-fatal; let schema validation surface remaining issues
        pass

    # Validate against Pydantic schema
    try:
        return Template.model_validate(raw_data)
    except PydanticValidationError as e:
        # Convert Pydantic errors to our domain-specific error with details
        error_details = []
        for error in e.errors():
            field_path = " -> ".join(str(x) for x in error["loc"])
            error_msg = error["msg"]
            error_details.append(f"{field_path}: {error_msg}")
        
        raise SchemaValidationError(
            f"Template failed schema validation:\n" + "\n".join(f"  • {detail}" for detail in error_details)
        )


def validate_template_file(file_path: str) -> Template:
    """
    Load and validate template from file path.
    
    Args:
        file_path: Path to YAML template file
        
    Returns:
        Validated Template instance
        
    Raises:
        TemplateParseError: If file cannot be read or YAML is invalid
        SchemaValidationError: If template fails schema validation
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            yaml_content = f.read()
    except FileNotFoundError:
        raise TemplateParseError(f"Template file not found: {file_path}")
    except PermissionError:
        raise TemplateParseError(f"Permission denied reading template file: {file_path}")
    except UnicodeDecodeError as e:
        raise TemplateParseError(f"Invalid UTF-8 encoding in template file {file_path}: {e}")
    except OSError as e:
        raise TemplateParseError(f"Error reading template file {file_path}: {e}")
    
    return parse_yaml_template(yaml_content)
