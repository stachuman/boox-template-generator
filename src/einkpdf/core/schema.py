"""
Pydantic schema models for template validation and device profiles.

This module defines the core data structures used throughout the e-ink PDF
system, following the locked YAML v1.0 specification from the implementation plan.
All models enforce the production standards defined in CLAUDE.md.
"""

from enum import Enum
from typing import List, Dict, Any, Optional, Union
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
    page: int = Field(1, ge=1, le=100)
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
    page: int = Field(..., ge=1, le=100)
    master_id: str = Field(..., min_length=1, pattern=r"^[a-zA-Z0-9_-]+$")


class NamedDestination(BaseModel):
    """PDF named destination for navigation."""
    id: str = Field(..., min_length=1, pattern=r"^[a-zA-Z0-9_-]+$")
    page: int = Field(1, ge=1, le=100)
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
