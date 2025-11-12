"""
Master/Plan-based compilation schema for template generation.

This module defines the master/plan compiler approach where:
1. Masters are parametric templates that can be instantiated multiple times
2. Plans define how to enumerate and link masters to create final documents
3. Compilation resolves bindings and generates complete templates

Follows CLAUDE.md standards - no dummy implementations.
"""

from datetime import date
from enum import Enum
from typing import Dict, List, Optional, Union, Any
from pydantic import BaseModel, Field, validator, computed_field

from .schema import Template, Widget


class GenerateMode(str, Enum):
    """How to generate pages from a master."""
    ONCE = "once"              # Single instance
    EACH_DAY = "each_day"      # One per day in date range
    EACH_WEEK = "each_week"    # One per ISO week in range
    EACH_MONTH = "each_month"  # One per month in range
    COUNT = "count"            # Repeat N times


class LinkResolutionMode(str, Enum):
    """How to resolve links between pages."""
    NAMED_DESTINATIONS = "named_destinations"  # Use canonical destination IDs (recommended)
    PAGE_NUMBERS = "page_numbers"             # Use calculated page numbers (fragile)


class Master(BaseModel):
    """A parametric template that can be instantiated with different contexts."""
    name: str = Field(..., min_length=1, max_length=100, description="Master template name")
    description: str = Field("", max_length=500, description="Master description")
    widgets: List[Widget] = Field(default_factory=list, description="Parametric widgets")
    created_at: str = Field(..., description="Creation timestamp")
    updated_at: str = Field(..., description="Last update timestamp")

    @validator("name")
    def validate_name_format(cls, v):
        """Ensure name is suitable for referencing."""
        if not v.replace(" ", "").replace("-", "").replace("_", "").isalnum():
            raise ValueError("Master name must contain only letters, numbers, spaces, hyphens, and underscores")
        return v

    @computed_field  # type: ignore[misc]
    @property
    def used_variables(self) -> List[str]:
        """
        List of all variable names referenced in this master's widgets.

        Extracts both brace-style ({var}) and at-style (@var) variable references
        from widget content, properties, and styling.

        Returns:
            Sorted list of unique variable names

        Examples:
            >>> master = Master(...)  # Contains widgets with {date}, {index:02d}, @title
            >>> master.used_variables
            ['date', 'index', 'title']

            >>> master = Master(...)  # Static content, no variables
            >>> master.used_variables
            []

        Notes:
            - This is a computed field (automatically serialized by Pydantic v2)
            - Performance: Fast for typical masters (5-20 widgets)
            - Format specifiers are stripped from variable names
        """
        from .utils import extract_variables_from_master
        return extract_variables_from_master(self)


class PlanSection(BaseModel):
    """Defines how to generate pages from a master."""
    kind: str = Field(..., description="Section identifier")
    master: str = Field(..., description="Master template name to use")
    generate: GenerateMode = Field(..., description="How to generate pages")

    # For date-based generation
    start_date: Optional[str] = Field(None, description="Start date (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="End date (YYYY-MM-DD)")

    # For count-based generation
    count: Optional[int] = Field(None, gt=0, description="Number of pages to generate")

    # For multi-page items
    pages_per_item: int = Field(1, gt=0, description="Pages per generated item")

    # Static context
    context: Dict[str, Any] = Field(default_factory=dict, description="Static context variables")

    # Counter variables (increment per generated page)
    counters: Dict[str, Dict[str, float]] = Field(
        default_factory=dict,
        description="Counter variables with start and step (e.g., {'page_num': {'start': 1, 'step': 1}})"
    )

    # Nested sections (for hierarchical iteration)
    nested: Optional[List['PlanSection']] = Field(
        None,
        description="Child sections that iterate within each parent iteration (max depth: 3)"
    )

    @validator("counters")
    def validate_counters(cls, v):
        """Validate counter format."""
        if not v:
            return v
        for counter_name, counter_config in v.items():
            if not isinstance(counter_config, dict):
                raise ValueError(f"Counter '{counter_name}' must be a dictionary with 'start' and 'step'")
            if "start" not in counter_config:
                raise ValueError(f"Counter '{counter_name}' missing required 'start' field")
            if "step" not in counter_config:
                raise ValueError(f"Counter '{counter_name}' missing required 'step' field")
            try:
                float(counter_config["start"])
                float(counter_config["step"])
            except (ValueError, TypeError):
                raise ValueError(f"Counter '{counter_name}' start and step must be numeric values")
        return v

    @validator("start_date", "end_date")
    def validate_date_format(cls, v):
        """Validate date format."""
        if v is not None:
            try:
                date.fromisoformat(v)
            except ValueError:
                raise ValueError("Date must be in YYYY-MM-DD format")
        return v

    @validator("nested")
    def validate_nesting_depth(cls, v, values):
        """Prevent excessive nesting (max depth: 3)."""
        if v is None:
            return v

        def get_depth(sections: List['PlanSection'], current_depth: int = 1) -> int:
            if current_depth > 3:
                parent_kind = values.get('kind', 'unknown')
                raise ValueError(
                    f"Maximum nesting depth is 3 levels. "
                    f"Section '{parent_kind}' exceeds this limit at depth {current_depth}"
                )
            max_child_depth = current_depth
            for section in sections:
                if section.nested:
                    child_depth = get_depth(section.nested, current_depth + 1)
                    max_child_depth = max(max_child_depth, child_depth)
            return max_child_depth

        get_depth(v, 1)
        return v

    @validator("nested")
    def validate_no_variable_collisions(cls, v, values):
        """Ensure child sections don't redefine parent variables (including transitive ancestors)."""
        if v is None:
            return v

        parent_context = values.get("context", {}) or {}
        parent_counters = values.get("counters", {}) or {}
        parent_vars = set(parent_context.keys()) | set(parent_counters.keys())
        parent_kind = values.get('kind', 'unknown')

        def validate_recursive(sections: List['PlanSection'], ancestor_vars: set, ancestor_chain: List[str]) -> None:
            """Recursively validate no variable collisions with any ancestor."""
            for section in sections:
                section_context = section.context or {}
                section_counters = section.counters or {}
                section_vars = set(section_context.keys()) | set(section_counters.keys())

                # Check collision with ALL ancestors (not just immediate parent)
                collisions = ancestor_vars & section_vars
                if collisions:
                    chain_str = " → ".join(ancestor_chain + [section.kind])
                    raise ValueError(
                        f"Section '{section.kind}' redefines ancestor variables: {sorted(collisions)}. "
                        f"Hierarchy: {chain_str}. "
                        f"Use unique variable names (e.g., 'project_id' vs 'meeting_id' vs 'task_id') to avoid shadowing."
                    )

                # If this section has nested children, validate them with accumulated ancestor vars
                if section.nested:
                    combined_ancestor_vars = ancestor_vars | section_vars
                    combined_ancestor_chain = ancestor_chain + [section.kind]
                    validate_recursive(section.nested, combined_ancestor_vars, combined_ancestor_chain)

        # Validate all nested sections with parent's variables as ancestors
        validate_recursive(v, parent_vars, [parent_kind])

        return v


class CalendarConfig(BaseModel):
    """Calendar configuration for the plan."""
    start_date: Optional[str] = Field(None, description="Plan start date (legacy, use section dates)")
    end_date: Optional[str] = Field(None, description="Plan end date (legacy, use section dates)")
    pages_per_day: int = Field(1, gt=0, description="Pages per day for day_pages sections")

    @validator("start_date", "end_date", pre=True)
    def validate_date_format(cls, v):
        """Validate date format."""
        # Convert empty strings to None
        if v is None or v == "" or (isinstance(v, str) and v.strip() == ""):
            return None
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError("Date must be in YYYY-MM-DD format")
        return v


class Plan(BaseModel):
    """Compilation plan that defines the document structure."""
    calendar: CalendarConfig = Field(..., description="Calendar configuration")
    sections: List[PlanSection] = Field(..., description="Plan sections")
    order: List[str] = Field(..., description="Section order in final document")
    locale: Optional[str] = Field('en', description="Locale for month/weekday names (e.g., 'en', 'pl')")

    @validator("order")
    def validate_order_matches_sections(cls, v, values):
        """Ensure order list matches top-level section kinds only (nested sections inherit parent order)."""
        if "sections" in values:
            # Only top-level sections should be in order list
            # Nested sections are ordered implicitly (always after their parent)
            section_kinds = {section.kind for section in values["sections"]}
            order_kinds = set(v)
            if section_kinds != order_kinds:
                missing_in_order = section_kinds - order_kinds
                missing_in_sections = order_kinds - section_kinds
                errors = []
                if missing_in_order:
                    errors.append(f"Missing in order: {missing_in_order}")
                if missing_in_sections:
                    errors.append(f"Missing in sections: {missing_in_sections}")
                raise ValueError("; ".join(errors))
        return v


class LinkResolution(BaseModel):
    """Link resolution configuration."""
    mode: LinkResolutionMode = Field(LinkResolutionMode.NAMED_DESTINATIONS, description="Resolution mode")
    destination_patterns: Dict[str, str] = Field(default_factory=dict, description="Destination ID patterns")
    generate_outlines: bool = Field(True, description="Generate PDF outlines")
    generate_month_links: bool = Field(True, description="Generate month navigation links")
    generate_day_links: bool = Field(True, description="Generate day navigation links")


class ProjectMetadata(BaseModel):
    """Project metadata."""
    name: str = Field(..., min_length=1, max_length=100, description="Project name")
    description: str = Field("", max_length=500, description="Project description")
    category: str = Field("planner", max_length=50, description="Project category")
    author: str = Field("", max_length=100, description="Project author")
    device_profile: str = Field(..., description="Target device profile")
    created_at: str = Field(..., description="Creation timestamp")
    updated_at: str = Field(..., description="Last update timestamp")
    is_public: bool = Field(False, description="Whether project is shared publicly")
    public_url_slug: Optional[str] = Field(None, description="Custom slug for public URL")
    original_author: Optional[str] = Field(None, description="Original author for cloned projects")
    cloned_from: Optional[str] = Field(None, description="Source project ID if cloned")
    clone_count: int = Field(0, ge=0, description="Number of times the project has been cloned")


class Project(BaseModel):
    """Project with masters and compilation plan."""
    id: str = Field(..., min_length=1, description="Unique project identifier")
    metadata: ProjectMetadata = Field(..., description="Project metadata")
    masters: List[Master] = Field(default_factory=list, description="Master templates")
    plan: Plan = Field(..., description="Compilation plan")
    link_resolution: LinkResolution = Field(default_factory=LinkResolution, description="Link resolution config")
    default_canvas: Dict[str, Any] = Field(default_factory=dict, description="Default canvas settings")


class ProjectListItem(BaseModel):
    """Lightweight project list item."""
    id: str = Field(..., description="Project ID")
    name: str = Field(..., description="Project name")
    description: str = Field(..., description="Project description")
    masters_count: int = Field(..., description="Number of masters")
    plan_sections_count: int = Field(..., description="Number of plan sections")
    created_at: str = Field(..., description="Creation timestamp")
    updated_at: str = Field(..., description="Update timestamp")
    is_public: bool = Field(False, description="Whether the project is shared publicly")
    public_url_slug: Optional[str] = Field(None, description="Custom slug for public gallery access")
    clone_count: int = Field(0, ge=0, description="Number of recorded clones")


class CompilationResult(BaseModel):
    """Result of project compilation."""
    project_id: str = Field(..., description="Source project ID")
    template: Template = Field(..., description="Compiled template")
    compilation_stats: Dict[str, Any] = Field(..., description="Compilation statistics")
    generated_at: str = Field(..., description="Generation timestamp")


class BindingContext(BaseModel):
    """
    Context for binding resolution during compilation.

    Auto-generated variables (EACH_DAY, EACH_WEEK, EACH_MONTH modes):
    - date, date_long, year, month, month_padded, month_padded3, month_name
    - day, day_padded, weekday
    - Navigation: date_prev, date_next, month_prev, month_next, week_prev, week_next, year_prev, year_next
    - week, iso_week (ISO week number and identifier)

    Always available:
    - locale (language code, e.g., 'en', 'pl')
    - subpage (for multi-page items)
    - page, total_pages (added during PDF rendering phase)

    User-defined (via Counters or Context):
    - index, index_padded, total, and any custom variables
    - Use Counters in plan sections to define sequential numbering
    - Use Context in plan sections to define static values
    """
    # Date context (EACH_DAY, EACH_WEEK, EACH_MONTH modes only)
    date: Optional[str] = None
    date_long: Optional[str] = None
    year: Optional[int] = None
    month: Optional[int] = None
    month_padded: Optional[str] = None
    month_padded3: Optional[str] = None
    month_name: Optional[str] = None
    day: Optional[int] = None
    day_padded: Optional[str] = None
    weekday: Optional[str] = None

    # Locale (always available)
    locale: Optional[str] = None

    # Multi-page support (always available when pages_per_item > 1)
    subpage: Optional[int] = None

    # Calendar context (EACH_DAY, EACH_WEEK, EACH_MONTH modes only)
    iso_week: Optional[str] = None

    # Custom context (user-defined via Context or Counters, plus navigation variables)
    custom: Dict[str, Any] = Field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for template substitution."""
        result = {}
        for field, value in self.__dict__.items():
            if value is not None:
                if field == "custom":
                    result.update(value)
                else:
                    result[field] = value
        return result


class DestinationRegistry(BaseModel):
    """Registry of all named destinations in the compiled document."""
    destinations: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="destination_id -> {page, x, y}")

    def add_destination(self, dest_id: str, page: int, x: float, y: float, source_widget_id: Optional[str] = None):
        """Add a destination to the registry."""
        entry: Dict[str, Any] = {"page": page, "x": x, "y": y}
        if source_widget_id:
            entry["source_widget_id"] = source_widget_id
        self.destinations[dest_id] = entry

    def has_destination(self, dest_id: str) -> bool:
        """Check if destination exists."""
        return dest_id in self.destinations

    def get_destination(self, dest_id: str) -> Optional[Dict[str, Any]]:
        """Get destination info."""
        return self.destinations.get(dest_id)


def estimate_page_count(section: PlanSection) -> int:
    """
    Estimate total pages that will be generated from a section (including nested).

    Returns:
        Estimated page count (multiply with nested sections)

    Raises:
        ValueError: If section configuration is invalid for estimation
    """
    if section.generate == GenerateMode.ONCE:
        base = 1
    elif section.generate == GenerateMode.COUNT:
        if section.count is None:
            raise ValueError(f"Section '{section.kind}' with COUNT mode missing count value")
        base = section.count
    elif section.generate in (GenerateMode.EACH_DAY, GenerateMode.EACH_WEEK, GenerateMode.EACH_MONTH):
        if section.start_date is None or section.end_date is None:
            raise ValueError(
                f"Section '{section.kind}' with {section.generate.value} mode requires start_date and end_date"
            )
        start = date.fromisoformat(section.start_date)
        end = date.fromisoformat(section.end_date)

        if section.generate == GenerateMode.EACH_DAY:
            base = (end - start).days + 1
        elif section.generate == GenerateMode.EACH_MONTH:
            # Calculate months between dates
            months = (end.year - start.year) * 12 + (end.month - start.month) + 1
            base = months
        elif section.generate == GenerateMode.EACH_WEEK:
            # Estimate weeks (approximate, actual may vary slightly with ISO weeks)
            days = (end - start).days + 1
            base = (days + 6) // 7  # Round up to nearest week
        else:
            base = 1
    else:
        base = 1

    # Multiply by pages per item
    base *= section.pages_per_item

    # If has nested sections, multiply by their estimated counts
    if section.nested:
        for child in section.nested:
            child_count = estimate_page_count(child)
            base *= child_count

    return base


# Update forward references for recursive model
PlanSection.update_forward_refs()


# Legacy support for existing API (will be removed)
NamedPage = Master  # Temporary alias
CompilationRule = PlanSection  # Temporary alias
RepeatMode = GenerateMode  # Temporary alias
