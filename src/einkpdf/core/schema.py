"""
Pydantic schema models for template validation and device profiles.

This module defines the core data structures used throughout the e-ink PDF
system, following the locked YAML v1.0 specification from the implementation plan.
All models enforce the production standards defined in CLAUDE.md.
"""

from enum import Enum
from typing import List, Dict, Any, Optional, Union
from datetime import date
from pydantic import BaseModel, Field, validator


class ExportMode(str, Enum):
    """PDF export modes with different compatibility profiles."""
    INTERACTIVE = "interactive"      # Full AcroForms (opt-in)
    FLATTENED = "flattened"         # Forms as graphics (default)
    NAVIGATION_ONLY = "navigation_only"  # No forms, maximum compatibility


class CoordinateSystem(str, Enum):
    """Coordinate system specification for layout."""
    TOP_LEFT = "top_left"           # UI-style coordinates (Y increases downward)


class PDFVersion(str, Enum):
    """Supported PDF versions."""
    PDF_1_6 = "1.6"                # Locked standard per implementation plan


class FitMode(str, Enum):
    """PDF navigation fit modes."""
    FIT = "Fit"                     # Fit entire page
    FIT_H = "FitH"                  # Fit horizontally (default)  
    FIT_V = "FitV"                  # Fit vertically
    XYZ = "XYZ"                     # Exact coordinates


class Position(BaseModel):
    """Widget position with top-left coordinate system."""
    x: float = Field(..., ge=0, description="Distance from left edge in points")
    y: float = Field(..., ge=0, description="Distance from top edge in points")
    width: float = Field(..., gt=0, description="Width in points")
    height: float = Field(..., gt=0, description="Height in points")


class DeviceConstraints(BaseModel):
    """Device-specific constraint limits."""
    min_font_pt: float = Field(10.0, ge=8.0, le=14.0)
    min_stroke_pt: float = Field(0.75, ge=0.25, le=2.0)
    min_touch_target_pt: float = Field(44.0, ge=32.0, le=64.0)
    grayscale_levels: int = Field(16, ge=2, le=256)
    max_gray_fill_area: float = Field(0.2, ge=0.0, le=1.0)


class DeviceProfile(BaseModel):
    """Device profile with display characteristics and constraints."""
    name: str = Field(..., min_length=1)
    
    display: Dict[str, Any] = Field(..., description="Display characteristics")
    pdf_settings: Dict[str, Any] = Field(..., description="PDF generation settings")
    constraints: DeviceConstraints
    
    @validator("display")
    def validate_display(cls, v):
        """Validate display characteristics structure."""
        required_fields = {"screen_size", "ppi", "physical_size"}
        if not all(field in v for field in required_fields):
            raise ValueError(f"Display must contain: {required_fields}")
        
        # Validate screen_size format
        screen_size = v.get("screen_size")
        if not (isinstance(screen_size, list) and len(screen_size) == 2 
                and all(isinstance(x, int) and x > 0 for x in screen_size)):
            raise ValueError("screen_size must be [width, height] in pixels")
        
        # Validate PPI
        ppi = v.get("ppi")
        if not (isinstance(ppi, (int, float)) and 150 <= ppi <= 400):
            raise ValueError("PPI must be between 150 and 400")
        
        return v
    
    @validator("pdf_settings")  
    def validate_pdf_settings(cls, v):
        """Validate PDF settings structure."""
        required_fields = {"page_size", "orientation"}
        if not all(field in v for field in required_fields):
            raise ValueError(f"PDF settings must contain: {required_fields}")
        
        # Validate page size
        page_size = v.get("page_size")
        valid_sizes = {"A4", "A5", "Letter", "Legal", "Custom"}
        if page_size not in valid_sizes:
            raise ValueError(f"page_size must be one of: {valid_sizes}")
        
        # Validate orientation
        orientation = v.get("orientation")
        if orientation not in {"portrait", "landscape"}:
            raise ValueError("orientation must be 'portrait' or 'landscape'")
        
        return v


class TemplateMetadata(BaseModel):
    """Template metadata and identification."""
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field("", max_length=500)
    category: str = Field(..., min_length=1, max_length=50)
    version: str = Field("1.0", pattern=r"^\d+\.\d+(\.\d+)?$")
    author: str = Field("", max_length=100)
    created: str = Field(..., description="ISO 8601 timestamp")
    profile: str = Field(..., min_length=1, description="Required device profile name")


class Canvas(BaseModel):
    """Canvas configuration with coordinate system."""
    dimensions: Dict[str, Any] = Field(..., description="Canvas dimensions")
    coordinate_system: CoordinateSystem = Field(CoordinateSystem.TOP_LEFT)
    background: str = Field("#FFFFFF", pattern=r"^#[0-9A-Fa-f]{6}$")
    grid_size: float = Field(10.0, gt=0, le=50)
    snap_enabled: bool = Field(True)
    
    @validator("dimensions")
    def validate_dimensions(cls, v):
        """Validate canvas dimensions."""
        required_fields = {"width", "height", "margins"}
        if not all(field in v for field in required_fields):
            raise ValueError(f"Dimensions must contain: {required_fields}")
        
        width, height = v["width"], v["height"]
        if not (isinstance(width, (int, float)) and width > 0):
            raise ValueError("width must be positive number")
        if not (isinstance(height, (int, float)) and height > 0):
            raise ValueError("height must be positive number")
        
        # Validate margins [top, right, bottom, left]
        margins = v["margins"]
        if not (isinstance(margins, list) and len(margins) == 4 
                and all(isinstance(x, (int, float)) and x >= 0 for x in margins)):
            raise ValueError("margins must be [top, right, bottom, left] with non-negative values")
        
        return v


class Widget(BaseModel):
    """Base widget with position and common properties."""
    id: str = Field(..., min_length=1, pattern=r"^[a-zA-Z0-9_-]+$")
    type: str = Field(..., min_length=1)
    page: Optional[int] = Field(None, ge=1, le=10000, description="Page number (assigned during compilation for multi-page documents)")
    position: Position
    background_color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$", description="Background color as hex value")

    # Optional properties that may be set by subclasses
    content: Optional[str] = Field(None)
    styling: Optional[Dict[str, Any]] = Field(None)
    properties: Optional[Dict[str, Any]] = Field(None)


class Master(BaseModel):
    """Master page definition with reusable widgets (e.g., headers/footers)."""
    id: str = Field(..., min_length=1, pattern=r"^[a-zA-Z0-9_-]+$")
    name: Optional[str] = Field(None, max_length=100)
    widgets: List[Widget] = Field(default_factory=list)


class PageAssignment(BaseModel):
    """Assign a master to a specific page."""
    page: int = Field(..., ge=1, le=10000)
    master_id: str = Field(..., min_length=1, pattern=r"^[a-zA-Z0-9_-]+$")


class NamedDestination(BaseModel):
    """PDF named destination for navigation."""
    id: str = Field(..., min_length=1, pattern=r"^[a-zA-Z0-9_:.{}-]+$")
    page: int = Field(1, ge=1, le=10000)
    x: float = Field(..., ge=0)
    y: float = Field(..., ge=0) 
    fit: FitMode = Field(FitMode.FIT_H)


class OutlineItem(BaseModel):
    """PDF outline/bookmark entry.""" 
    title: str = Field(..., min_length=1, max_length=100)
    dest: str = Field(..., min_length=1, description="Named destination ID")
    level: int = Field(1, ge=1, le=4, description="Outline level (1-4)")


class InternalLink(BaseModel):
    """Internal link configuration."""
    from_widget: str = Field(..., min_length=1, description="Source widget ID")
    to_dest: str = Field(..., min_length=1, description="Target destination ID")
    padding: float = Field(6.0, ge=0, le=20, description="Touch target padding in points")


class Navigation(BaseModel):
    """Navigation system configuration."""
    named_destinations: List[NamedDestination] = Field(default_factory=list)
    outlines: List[OutlineItem] = Field(default_factory=list)
    links: List[InternalLink] = Field(default_factory=list)
    

class ExportSettings(BaseModel):
    """Export configuration following locked standards.""" 
    modes: List[ExportMode] = Field(default_factory=lambda: [ExportMode.FLATTENED])
    default_mode: ExportMode = Field(ExportMode.FLATTENED)
    
    # PDF standards
    pdf_version: PDFVersion = Field(PDFVersion.PDF_1_6)
    page_box: str = Field("MediaBox", pattern=r"^(MediaBox|TrimBox|BleedBox)$")
    linearized: bool = Field(False)


class Template(BaseModel):
    """Complete template definition following YAML v1.0 specification."""
    schema_version: str = Field("1.0", pattern=r"^1\.0$", description="Schema version for migration")
    
    metadata: TemplateMetadata
    canvas: Canvas
    widgets: List[Widget] = Field(default_factory=list)
    masters: List[Master] = Field(default_factory=list)
    page_assignments: List[PageAssignment] = Field(default_factory=list)
    navigation: Navigation = Field(default_factory=Navigation)
    export: ExportSettings = Field(default_factory=ExportSettings)
    
    @validator("widgets")
    def validate_unique_widget_ids(cls, v):
        """Ensure all widget IDs are unique."""
        ids = [widget.id for widget in v]
        if len(ids) != len(set(ids)):
            duplicate_ids = [id for id in ids if ids.count(id) > 1]
            raise ValueError(f"Duplicate widget IDs found: {duplicate_ids}")
        return v
    
    @validator("navigation")
    def validate_navigation_references(cls, v, values):
        """Validate navigation references point to valid destinations/widgets."""
        if "widgets" not in values:
            return v
        
        widget_ids = {widget.id for widget in values["widgets"]}
        dest_ids = {dest.id for dest in v.named_destinations}
        
        # Validate outline destinations
        for outline in v.outlines:
            if outline.dest not in dest_ids:
                raise ValueError(f"Outline '{outline.title}' references unknown destination '{outline.dest}'")
        
        # Validate internal links
        for link in v.links:
            if link.from_widget not in widget_ids:
                raise ValueError(f"Link references unknown widget '{link.from_widget}'")
            if link.to_dest not in dest_ids:
                raise ValueError(f"Link references unknown destination '{link.to_dest}'")
        
        return v

    @validator("page_assignments")
    def validate_page_assignments(cls, v, values):
        """Ensure page assignments reference existing masters and are unique per page."""
        if v is None:
            return []
        master_ids = {m.id for m in values.get("masters", [])} if "masters" in values else set()
        pages_seen = set()
        for pa in v:
            if master_ids and pa.master_id not in master_ids:
                raise ValueError(f"Page assignment references unknown master_id '{pa.master_id}'")
            if pa.page in pages_seen:
                raise ValueError(f"Multiple master assignments for page {pa.page}")
            pages_seen.add(pa.page)
        return v


# ---- Plan Compiler Schema Models ----

class CalendarPlan(BaseModel):
    """Calendar configuration for plan compiler."""
    start_date: Union[date, str] = Field(..., description="Calendar start date (ISO format)")
    end_date: Optional[Union[date, str]] = Field(None, description="Calendar end date (ISO format)")
    weeks: str = Field("iso", pattern=r"^(iso|us|mon|sun)$", description="Week start convention")
    pages_per_day: int = Field(1, ge=1, le=5, description="Number of pages per day")

    @validator("start_date", "end_date", pre=True)
    def validate_dates(cls, v):
        """Convert string dates to date objects."""
        if isinstance(v, str):
            try:
                return date.fromisoformat(v)
            except ValueError:
                raise ValueError(f"Invalid date format: {v}. Use YYYY-MM-DD format.")
        return v

    @validator("end_date")
    def validate_end_after_start(cls, v, values):
        """Ensure end_date is after start_date."""
        if v is not None and "start_date" in values:
            start = values["start_date"]
            if isinstance(start, date) and isinstance(v, date) and v < start:
                raise ValueError("end_date must be after start_date")
        return v


class SectionSpec(BaseModel):
    """Section specification for plan compiler."""
    kind: str = Field(..., pattern=r"^(month_index|week_index|day_page|notes_index|notes_pages)$")
    master: str = Field(..., min_length=1, description="Master template name")
    generate: str = Field(..., pattern=r"^(each_month|each_week|each_day|once|count)$")
    pages_per_item: Optional[int] = Field(None, ge=1, le=5, description="Pages per generated item")
    count: Optional[int] = Field(None, ge=1, le=1000, description="Count for generate=count")

    @validator("count")
    def validate_count_for_generate(cls, v, values):
        """Ensure count is provided when generate=count."""
        if values.get("generate") == "count" and v is None:
            raise ValueError("count must be specified when generate=count")
        return v

    @validator("pages_per_item")
    def validate_pages_per_item_for_day(cls, v, values):
        """pages_per_item only applies to day_page sections."""
        if v is not None and values.get("kind") != "day_page":
            raise ValueError("pages_per_item only applies to day_page sections")
        return v


class PlanDocument(BaseModel):
    """Complete plan document for template compilation."""
    plan: Dict[str, Any] = Field(..., description="Plan configuration")
    name: Optional[str] = Field(None, max_length=100, description="Template name")
    description: Optional[str] = Field("", max_length=500, description="Template description")
    category: Optional[str] = Field("planner", max_length=50, description="Template category")
    author: Optional[str] = Field("", max_length=100, description="Template author")
    created: Optional[str] = Field(None, description="Creation timestamp")
    profile: Optional[str] = Field("boox-note-air-4c", description="Device profile")
    canvas: Optional[Dict[str, Any]] = Field(None, description="Canvas configuration")

    @validator("plan")
    def validate_plan_structure(cls, v):
        """Validate plan structure."""
        if not isinstance(v, dict):
            raise ValueError("plan must be a dictionary")

        if "calendar" not in v:
            raise ValueError("plan must contain calendar section")

        if "sections" not in v:
            raise ValueError("plan must contain sections list")

        # Validate calendar
        try:
            CalendarPlan.model_validate(v["calendar"])
        except Exception as e:
            raise ValueError(f"Invalid calendar configuration: {e}")

        # Validate sections
        if not isinstance(v["sections"], list):
            raise ValueError("plan.sections must be a list")

        try:
            for section in v["sections"]:
                SectionSpec.model_validate(section)
        except Exception as e:
            raise ValueError(f"Invalid section specification: {e}")

        return v


class BindSpec(BaseModel):
    """Binding specification for parametric links."""
    type: str = Field(..., pattern=r"^(day|week|month|notes|section)$")
    day: Optional[str] = Field(None, description="Day reference (ISO date or @token)")
    week: Optional[str] = Field(None, description="Week reference (ISO week or @token)")
    month: Optional[str] = Field(None, description="Month reference (YYYY-MM or @token)")
    section: Optional[str] = Field(None, description="Section slug")
    notes_index: Optional[bool] = Field(None, description="Link to notes index")
    page_index: Optional[Union[int, str]] = Field(None, description="Page index (1-based or @token)")
    offset_days: Optional[int] = Field(0, description="Day offset for relative navigation")

    @validator("day")
    def validate_day_for_type(cls, v, values):
        """Ensure day is provided when type=day."""
        if values.get("type") == "day" and v is None:
            raise ValueError("day must be specified when type=day")
        return v

    @validator("week")
    def validate_week_for_type(cls, v, values):
        """Ensure week is provided when type=week."""
        if values.get("type") == "week" and v is None:
            raise ValueError("week must be specified when type=week")
        return v

    @validator("month")
    def validate_month_for_type(cls, v, values):
        """Ensure month is provided when type=month."""
        if values.get("type") == "month" and v is None:
            raise ValueError("month must be specified when type=month")
        return v


class MasterWidget(BaseModel):
    """Widget definition in master template."""
    id: str = Field(..., min_length=1, pattern=r"^[a-zA-Z0-9_-]+$")
    type: str = Field(..., min_length=1, description="Widget type")
    position: Position
    content: Optional[str] = Field(None, description="Widget content with tokens")
    styling: Optional[Dict[str, Any]] = Field(None, description="Widget styling")
    properties: Optional[Dict[str, Any]] = Field(None, description="Widget properties")
    when: Optional[str] = Field(None, description="Conditional inclusion expression")

    @validator("properties")
    def validate_properties(cls, v):
        """Validate properties structure."""
        if v is None:
            return v

        # Validate bind if present
        if "bind" in v:
            bind = v["bind"]
            if isinstance(bind, dict):
                try:
                    BindSpec.model_validate(bind)
                except Exception as e:
                    raise ValueError(f"Invalid bind specification: {e}")
            elif isinstance(bind, str):
                # String bind format validation
                import re
                if not re.match(r"(\w+)\(([^)]+)\)(?:#(\d+))?", bind):
                    raise ValueError(f"Invalid bind string format: {bind}")

        return v


class MasterTemplate(BaseModel):
    """Master template definition."""
    name: str = Field(..., min_length=1, max_length=100, description="Master template name")
    page_size: Optional[str] = Field("A4", description="Page size")
    tokens: Optional[List[str]] = Field(default_factory=list, description="Available tokens")
    widgets: List[MasterWidget] = Field(default_factory=list, description="Master widgets")

    @validator("widgets")
    def validate_unique_widget_ids(cls, v):
        """Ensure all widget IDs are unique within master."""
        ids = [widget.id for widget in v]
        if len(ids) != len(set(ids)):
            duplicate_ids = [id for id in ids if ids.count(id) > 1]
            raise ValueError(f"Duplicate widget IDs in master: {duplicate_ids}")
        return v


class MasterLibrary(BaseModel):
    """Master template library."""
    masters: List[MasterTemplate] = Field(default_factory=list, description="Master templates")

    @validator("masters")
    def validate_unique_master_names(cls, v):
        """Ensure all master names are unique."""
        names = [master.name for master in v]
        if len(names) != len(set(names)):
            duplicate_names = [name for name in names if names.count(name) > 1]
            raise ValueError(f"Duplicate master names: {duplicate_names}")
        return v
