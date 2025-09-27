"""
Shared utility functions for the e-ink PDF template backend.

This module provides common functionality used across multiple API endpoints
and services, following CLAUDE.md coding standards.
"""

from typing import Any, Dict, List, Union


def convert_enums_for_serialization(obj: Any) -> Any:
    """
    Convert enum objects to their values for YAML/JSON serialization.

    Recursively traverses nested dictionaries and lists, converting any objects
    that have a 'value' attribute (typically Enum instances) to their underlying
    values for proper serialization to YAML or JSON.

    Args:
        obj: The object to convert. Can be a dict, list, enum, or any other type.

    Returns:
        The converted object with enum values extracted.

    Example:
        >>> from enum import Enum
        >>> class Color(Enum):
        ...     RED = "red"
        ...     BLUE = "blue"
        >>> data = {"color": Color.RED, "items": [Color.BLUE]}
        >>> convert_enums_for_serialization(data)
        {"color": "red", "items": ["blue"]}
    """
    if isinstance(obj, dict):
        return {key: convert_enums_for_serialization(value) for key, value in obj.items()}

    if isinstance(obj, list):
        return [convert_enums_for_serialization(item) for item in obj]

    # Extract enum value if object has a 'value' attribute (typically Enum instances)
    return getattr(obj, "value", obj)