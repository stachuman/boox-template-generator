"""
Core utility functions for the einkpdf package.

Provides common functionality shared across multiple modules,
following CLAUDE.md coding standards.
"""

import re
import json
from typing import Any, List, Set, TYPE_CHECKING

if TYPE_CHECKING:
    from .project_schema import Master


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


def extract_variables_from_master(master: "Master") -> List[str]:
    """
    Extract all variable references from a master template.

    Searches widget content, properties, and styling for both brace-style
    ({var}) and at-style (@var) variable references, matching the patterns
    used by the compilation service.

    Args:
        master: Master template to analyze

    Returns:
        Sorted list of unique variable names (without braces/@ or format specifiers)

    Examples:
        >>> # Master with variables in content and properties
        >>> master = Master(...)  # Contains "{date}", "{page_num:02d}", "@title"
        >>> extract_variables_from_master(master)
        ['date', 'page_num', 'title']

        >>> # Master with no variables
        >>> master = Master(...)  # Static content only
        >>> extract_variables_from_master(master)
        []

    Notes:
        - Format specifiers (e.g., :02d, :.2f) are stripped from variable names
        - Both {var} and @var patterns are detected
        - Variables must match [A-Za-z0-9_]+ (Python identifier rules)
        - Searches recursively through all widget properties and nested structures
        - Uses the same regex patterns as compilation_service._substitute_tokens()
    """
    variables: Set[str] = set()

    # Regex patterns matching compilation_service.py:480,519
    # Brace-style: {var} or {var:format} where format can contain digits, letters, dots
    brace_pattern = re.compile(r'\{([A-Za-z0-9_]+)(?::([A-Za-z0-9._]+))?\}')
    # At-style: @var or @var:format where format can contain digits, letters, dots
    at_pattern = re.compile(r'@([A-Za-z0-9_]+)(?::([A-Za-z0-9._]+))?')

    def extract_from_text(text: str) -> None:
        """Extract variables from a text string."""
        if not isinstance(text, str):
            return

        # Find all brace-style variables
        for match in brace_pattern.finditer(text):
            var_name = match.group(1)
            variables.add(var_name)

        # Find all at-style variables
        for match in at_pattern.finditer(text):
            var_name = match.group(1)
            variables.add(var_name)

    def extract_from_dict(data: dict) -> None:
        """Recursively extract variables from dictionary values."""
        for value in data.values():
            if isinstance(value, str):
                extract_from_text(value)
            elif isinstance(value, dict):
                extract_from_dict(value)
            elif isinstance(value, list):
                extract_from_list(value)

    def extract_from_list(data: list) -> None:
        """Recursively extract variables from list items."""
        for item in data:
            if isinstance(item, str):
                extract_from_text(item)
            elif isinstance(item, dict):
                extract_from_dict(item)
            elif isinstance(item, list):
                extract_from_list(item)

    # Extract from all widgets in the master
    for widget in master.widgets:
        # Check widget content
        if widget.content:
            extract_from_text(widget.content)

        # Check widget properties (recursively)
        if widget.properties:
            extract_from_dict(widget.properties)

        # Check widget styling (recursively)
        if widget.styling:
            extract_from_dict(widget.styling)

    # Return sorted list for consistent output
    return sorted(variables)