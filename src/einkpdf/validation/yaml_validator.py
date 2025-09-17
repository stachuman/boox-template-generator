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