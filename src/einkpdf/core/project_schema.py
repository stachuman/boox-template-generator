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
from pydantic import BaseModel, Field, validator

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

    # Navigation anchors (for this section)
    anchors: List[Dict[str, str]] = Field(default_factory=list, description="Named destinations")

    @validator("start_date", "end_date")
    def validate_date_format(cls, v):
        """Validate date format."""
        if v is not None:
            try:
                date.fromisoformat(v)
            except ValueError:
                raise ValueError("Date must be in YYYY-MM-DD format")
        return v


class CalendarConfig(BaseModel):
    """Calendar configuration for the plan."""
    start_date: str = Field(..., description="Plan start date")
    end_date: str = Field(..., description="Plan end date")
    pages_per_day: int = Field(1, gt=0, description="Pages per day for day_pages sections")

    @validator("start_date", "end_date")
    def validate_date_format(cls, v):
        """Validate date format."""
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
        """Ensure order list matches section kinds."""
        if "sections" in values:
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
    """Context for binding resolution during compilation."""
    # Date context
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
    # Locale (language code, e.g., 'en', 'pl')
    locale: Optional[str] = None

    # Sequence context
    index: Optional[int] = None
    index_padded: Optional[str] = None
    total: Optional[int] = None
    subpage: Optional[int] = None

    # Calendar context
    iso_week: Optional[str] = None

    # Custom context
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


# Legacy support for existing API (will be removed)
NamedPage = Master  # Temporary alias
CompilationRule = PlanSection  # Temporary alias
RepeatMode = GenerateMode  # Temporary alias
