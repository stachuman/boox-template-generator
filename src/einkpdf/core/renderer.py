"""
Core PDF rendering with ReportLab and deterministic output.

This module provides the main PDF generation functionality with coordinate
conversion, device profile enforcement, and deterministic builds.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import os
import math
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional, Tuple
from io import BytesIO
import calendar

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, LETTER, A5, LEGAL
from reportlab.lib.units import inch
from reportlab.lib.colors import black, white, HexColor

from .schema import Template, Widget, Canvas as CanvasConfig, Position
from .coordinates import CoordinateConverter, create_converter_for_canvas
from .profiles import ConstraintEnforcer, create_constraint_enforcer
from .postprocess import add_navigation_to_pdf
from .deterministic import make_pdf_deterministic
from ..validation.yaml_validator import ValidationError


class RenderingError(Exception):
    """Raised when PDF rendering fails."""
    pass


class UnsupportedWidgetError(RenderingError):
    """Raised when encountering unsupported widget types.""" 
    pass


class DeterministicPDFRenderer:
    """
    PDF renderer with deterministic output and device profile enforcement.
    
    This renderer converts template definitions to PDF following the
    multi-pass architecture defined in the implementation plan.
    """
    
    def __init__(self, template: Template, profile_name: str, strict_mode: bool = False):
        """
        Initialize renderer.
        
        Args:
            template: Validated template definition
            profile_name: Device profile to use for constraints
            strict_mode: If True, fail on constraint violations
            
        Raises:
            ValidationError: If template or profile invalid
        """
        self.template = template
        self.profile_name = profile_name
        self.strict_mode = strict_mode
        
        # Initialize coordinate converter
        self.converter = create_converter_for_canvas(template.canvas.dimensions)
        
        # Initialize constraint enforcer
        self.enforcer = create_constraint_enforcer(profile_name, strict_mode)
        
        # Track collected data for multi-pass rendering
        self.anchor_positions: Dict[str, Tuple[int, float, float]] = {}  # id -> (page, x, y)
        self.violations = []  # Track constraint violations
        # Master page mapping and total pages for token substitution
        self._page_master_map: Dict[int, str] = {}
        self._total_pages: int = 1
    
    def get_page_size(self) -> Tuple[float, float]:
        """
        Get page size from canvas dimensions.
        
        Returns:
            Tuple of (width, height) in points
        """
        dims = self.template.canvas.dimensions
        return dims["width"], dims["height"]
    
    def render_to_bytes(self, 
                       deterministic: bool = True, 
                       creation_date: Optional[datetime] = None) -> bytes:
        """
        Render template to PDF bytes.
        
        Args:
            deterministic: If True, use fixed creation date and settings
            creation_date: Fixed creation date for deterministic builds
            
        Returns:
            PDF content as bytes
            
        Raises:
            RenderingError: If rendering fails
        """
        buffer = BytesIO()
        
        try:
            # Pass 1: Initialize ReportLab canvas
            page_width, page_height = self.get_page_size()
            pdf_canvas = canvas.Canvas(buffer, pagesize=(page_width, page_height))
            
            # Set deterministic properties if requested
            if deterministic:
                pdf_canvas.setTitle(self.template.metadata.name)
                pdf_canvas.setSubject(self.template.metadata.description)
                pdf_canvas.setCreator("E-ink PDF Templates v0.1.0")
                pdf_canvas.setAuthor(self.template.metadata.author or "Unknown")
                # Note: ReportLab Canvas doesn't support setCreationDate directly
                # Creation date will be handled by pikepdf post-processor for deterministic builds
            
            # Pass 2: Layout pass - render content and collect anchor positions
            self._layout_pass(pdf_canvas)
            
            # Finalize base PDF
            pdf_canvas.save()
            
            # Store violations for later reporting
            self.violations = self.enforcer.violations.copy()
            
            # Pass 3: Post-process with navigation (pikepdf)
            base_pdf = buffer.getvalue()
            if self.template.navigation.named_destinations or self.template.navigation.outlines or self.template.navigation.links:
                final_pdf = add_navigation_to_pdf(base_pdf, self.template, self.anchor_positions)
            else:
                final_pdf = base_pdf
            
            # Pass 4: Make deterministic if requested
            if deterministic:
                final_pdf = make_pdf_deterministic(final_pdf, self.template, creation_date)
            
            return final_pdf
            
        except Exception as e:
            raise RenderingError(f"PDF rendering failed: {e}") from e
    
    def _layout_pass(self, pdf_canvas: canvas.Canvas) -> None:
        """
        Layout pass: render all widgets and collect anchor positions.
        
        Args:
            pdf_canvas: ReportLab canvas instance
        """
        # Set up default styles
        pdf_canvas.setFillColor(black)
        pdf_canvas.setStrokeColor(black)
        
        # Group widgets by page
        widgets_by_page = self._group_widgets_by_page()
        
        # Determine total pages needed
        max_page = self._get_total_pages(widgets_by_page)
        self._total_pages = max_page

        # Build page->master map from optional page assignments
        try:
            assignments = getattr(self.template, 'page_assignments', []) or []
            for pa in assignments:
                page_no = getattr(pa, 'page', None)
                master_id = getattr(pa, 'master_id', None)
                if isinstance(page_no, int) and master_id:
                    self._page_master_map[page_no] = master_id
        except Exception:
            self._page_master_map = {}
        
        # Render each page (ensuring all pages are created, even if empty)
        for page_num in range(1, max_page + 1):
            if page_num > 1:
                pdf_canvas.showPage()  # Start new page
            
            # Create automatic page bookmark for navigation
            page_bookmark_name = f"Page_{page_num}"
            pdf_canvas.bookmarkPage(page_bookmark_name)
            
            # Get widgets for this page (may be empty)
            widgets = widgets_by_page.get(page_num, [])
            self._render_page_widgets(pdf_canvas, widgets, page_num)
    
    def _group_widgets_by_page(self) -> Dict[int, List[Widget]]:
        """Group widgets by page number."""
        widgets_by_page = {}
        
        for widget in self.template.widgets:
            if not hasattr(widget, 'page') or widget.page is None:
                raise RenderingError(
                    f"Widget '{widget.id}' missing required 'page' attribute"
                )
            page = widget.page
            if page not in widgets_by_page:
                widgets_by_page[page] = []
            widgets_by_page[page].append(widget)
        
        return widgets_by_page
    
    def _get_total_pages(self, widgets_by_page: Dict[int, List[Widget]]) -> int:
        """
        Determine total number of pages needed.
        
        Returns:
            Maximum page number, ensuring at least 1 page
        """
        max_page = 1
        if widgets_by_page:
            try:
                max_page = max(max_page, max(widgets_by_page.keys()))
            except ValueError:
                pass

        # Include pages that have master assignments even if they have no widgets
        try:
            assignments = getattr(self.template, 'page_assignments', []) or []
            if assignments:
                assign_max = max(getattr(pa, 'page', 1) for pa in assignments if hasattr(pa, 'page'))
                max_page = max(max_page, assign_max)
        except Exception:
            pass

        # Include pages referenced by named destinations
        try:
            nav = getattr(self.template, 'navigation', None)
            if nav and getattr(nav, 'named_destinations', None):
                dest_max = max(getattr(dest, 'page', 1) for dest in nav.named_destinations if hasattr(dest, 'page'))
                max_page = max(max_page, dest_max)
        except Exception:
            pass

        return max_page
    
    def _render_page_widgets(self, pdf_canvas: canvas.Canvas, widgets: List[Widget], page_num: int) -> None:
        """
        Render all widgets on a page.
        
        Args:
            pdf_canvas: ReportLab canvas
            widgets: Widgets to render on this page
            page_num: Current page number
        """
        # Render master widgets first (if any assigned to this page)
        master_id = self._page_master_map.get(page_num)
        if master_id:
            master = None
            for m in getattr(self.template, 'masters', []) or []:
                if getattr(m, 'id', None) == master_id:
                    master = m
                    break
            if master:
                for m_widget in getattr(master, 'widgets', []) or []:
                    try:
                        # Render a copy so we can set page number without mutating original
                        mw = m_widget.model_copy(update={"page": page_num}) if hasattr(m_widget, 'model_copy') else m_widget
                        self._render_widget(pdf_canvas, mw, page_num)
                    except RenderingError as e:
                        raise e
                    except Exception as e:
                        if self.strict_mode:
                            raise RenderingError(f"Failed to render master widget {getattr(m_widget, 'id', '?')}: {e}") from e
                        else:
                            print(f"Warning: Skipping master widget {getattr(m_widget, 'id', '?')} due to rendering error: {e}")

        # Render page widgets
        for widget in widgets:
            try:
                self._render_widget(pdf_canvas, widget, page_num)
            except RenderingError as e:
                # RenderingError indicates configuration/validation issues - always fail fast
                # Following CLAUDE.md Rule #4: Fail Fast with Meaningful Exceptions
                raise e
            except Exception as e:
                if self.strict_mode:
                    raise RenderingError(f"Failed to render widget {widget.id}: {e}") from e
                else:
                    # In non-strict mode, skip only rendering failures, not configuration errors
                    print(f"Warning: Skipping widget {widget.id} due to rendering error: {e}")
                    continue
    
    def _render_widget(self, pdf_canvas: canvas.Canvas, widget: Widget, page_num: int) -> None:
        """
        Render a single widget.

        Args:
            pdf_canvas: ReportLab canvas
            widget: Widget to render
            page_num: Current page number
        """
        # Draw background color if specified
        if hasattr(widget, 'background_color') and widget.background_color:
            self._draw_widget_background(pdf_canvas, widget)

        # Store anchor position for navigation (if widget has bookmark property)
        widget_props = getattr(widget, 'properties', {}) or {}
        if isinstance(widget_props, dict) and 'bookmark' in widget_props:
            bookmark_id = widget_props['bookmark']
            # Store top-left corner position for bookmark
            self.anchor_positions[bookmark_id] = (page_num, widget.position.x, widget.position.y)
        
        # Render based on widget type
        if widget.type == "text_block":
            self._render_text_block(pdf_canvas, widget, page_num)
        elif widget.type == "checkbox":
            self._render_checkbox(pdf_canvas, widget)
        elif widget.type == "divider":
            self._render_divider(pdf_canvas, widget)
        elif widget.type == "lines":
            self._render_lines(pdf_canvas, widget)
        elif widget.type == "anchor":
            self._render_anchor(pdf_canvas, widget)
        elif widget.type == "calendar":
            self._render_calendar(pdf_canvas, widget)
        else:
            # Following CLAUDE.md rule #4: explicit NotImplementedError
            raise UnsupportedWidgetError(
                f"Widget type '{widget.type}' not implemented in Phase 1. "
                f"Supported types: text_block, checkbox, divider, lines, anchor, calendar"
            )

    def _draw_widget_background(self, pdf_canvas: canvas.Canvas, widget: Widget) -> None:
        """
        Draw background color for a widget.

        Args:
            pdf_canvas: ReportLab canvas
            widget: Widget with background_color specified
        """
        if not widget.background_color:
            return

        # Validate and convert color
        background_color = self.enforcer.validate_color(widget.background_color)
        color_obj = HexColor(background_color)

        # Convert position for drawing
        bg_pos = self.converter.convert_position_for_drawing(widget.position)

        # Save current fill color
        current_fill = pdf_canvas._fillColorObj

        # Set background color and draw rectangle
        pdf_canvas.setFillColor(color_obj)
        pdf_canvas.rect(
            bg_pos['x'],
            bg_pos['y'],
            bg_pos['width'],
            bg_pos['height'],
            stroke=0,
            fill=1
        )

        # Restore previous fill color
        pdf_canvas.setFillColor(current_fill)

    def _render_text_block(self, pdf_canvas: canvas.Canvas, widget: Widget, page_num: int) -> None:
        """Render text block widget."""
        if not widget.content:
            return  # Skip empty text blocks
        
        # Get styling with explicit validation
        styling = getattr(widget, 'styling', {}) or {}
        
        # Explicit validation with meaningful defaults
        font_name = styling.get('font')
        if font_name is None:
            font_name = 'Helvetica'  # Default font for e-ink devices
            
        font_size = styling.get('size')
        if font_size is None:
            font_size = 12.0  # Minimum readable size for e-ink
            
        color = styling.get('color')
        if color is None:
            color = '#000000'  # Pure black for maximum contrast
        
        # Enforce constraints
        font_size = self.enforcer.check_font_size(font_size)
        color = self.enforcer.validate_color(color)
        
        # Convert position for text drawing
        text_pos = self.converter.convert_text_position(widget.position, font_size)
        
        # Set text properties
        pdf_canvas.setFont(font_name, font_size)
        
        # Token substitution for dynamic fields
        content_text = widget.content
        try:
            content_text = (content_text
                            .replace('{page}', str(page_num))
                            .replace('{total_pages}', str(self._total_pages)))
        except Exception:
            pass

        # Draw text
        pdf_canvas.drawString(text_pos['x'], text_pos['y'], content_text)
    
    def _render_checkbox(self, pdf_canvas: canvas.Canvas, widget: Widget) -> None:
        """Render checkbox widget."""
        # Get properties
        props = getattr(widget, 'properties', {}) or {}
        checkbox_size = float(props.get('checkbox_size', 12.0))

        # Use exact checkbox size as specified by user
        fixed_width, fixed_height = checkbox_size, checkbox_size

        # Convert position for drawing
        box_pos = self.converter.convert_position_for_drawing(widget.position)

        # Enforce stroke width and set stroke color
        stroke_width = self.enforcer.check_stroke_width(1.0)
        pdf_canvas.setLineWidth(stroke_width)
        pdf_canvas.setStrokeColor(black)  # Ensure checkbox border is visible

        # Draw checkbox rectangle
        pdf_canvas.rect(
            box_pos['x'],
            box_pos['y'],
            fixed_width,
            fixed_height,
            stroke=1,
            fill=0
        )
        
        # Draw label if present
        if widget.content:
            label_x = box_pos['x'] + fixed_width + 5  # 5pt spacing
            label_y = box_pos['y'] + (fixed_height / 2)  # Center vertically
            
            font_size = 10.0
            font_size = self.enforcer.check_font_size(font_size)
            pdf_canvas.setFont('Helvetica', font_size)
            pdf_canvas.drawString(label_x, label_y, widget.content)
    
    def _render_divider(self, pdf_canvas: canvas.Canvas, widget: Widget) -> None:
        """Render horizontal divider line.""" 
        # Convert position for drawing
        line_pos = self.converter.convert_position_for_drawing(widget.position)
        
        # Enforce stroke width
        stroke_width = self.enforcer.check_stroke_width(0.75)
        pdf_canvas.setLineWidth(stroke_width)
        
        # Draw horizontal line across the width
        start_x = line_pos['x']
        end_x = line_pos['x'] + line_pos['width']
        y = line_pos['y'] + (line_pos['height'] / 2)  # Center of height
        
        pdf_canvas.line(start_x, y, end_x, y)
    
    def _render_lines(self, pdf_canvas: canvas.Canvas, widget: Widget) -> None:
        """Render multiple ruled lines for handwriting."""
        # Get properties with explicit defaults
        props = getattr(widget, 'properties', {}) or {}
        line_spacing = props.get('line_spacing', 20.0)  # pts between lines
        line_count = props.get('line_count', 10)
        line_thickness = props.get('line_thickness', 0.75)  # e-ink optimized
        margin_left = props.get('margin_left', 0.0)
        margin_right = props.get('margin_right', 0.0)
        line_style = props.get('line_style', 'solid')
        
        # Convert position for drawing
        lines_pos = self.converter.convert_position_for_drawing(widget.position)
        
        # Enforce stroke width constraint
        stroke_width = self.enforcer.check_stroke_width(line_thickness)
        pdf_canvas.setLineWidth(stroke_width)
        
        # Calculate usable width for lines
        available_width = lines_pos['width'] - margin_left - margin_right
        if available_width <= 0:
            return  # Skip if no space for lines
        
        # Set up line style
        if line_style == 'dotted':
            # Dotted pattern: 2pt dots, 3pt gaps (e-ink optimized)
            pdf_canvas.setDash([2, 3])
        elif line_style == 'dashed':
            # Dashed pattern: 6pt dashes, 3pt gaps (e-ink optimized)
            pdf_canvas.setDash([6, 3])
        else:
            # Solid lines (default)
            pdf_canvas.setDash([])
        
        # Draw each line
        for i in range(line_count):
            # Calculate Y position for this line (from top of widget area)
            line_y = lines_pos['y'] + lines_pos['height'] - (i * line_spacing)
            
            # Skip lines that would be outside the widget bounds
            if line_y < lines_pos['y']:
                break
                
            # Draw horizontal line with margins
            start_x = lines_pos['x'] + margin_left
            end_x = start_x + available_width
            
            if line_style == 'grid':
                # Draw horizontal line
                pdf_canvas.line(start_x, line_y, end_x, line_y)
                # Draw vertical grid lines every 20pt
                grid_spacing = 20.0
                x = start_x
                while x <= end_x:
                    pdf_canvas.line(x, lines_pos['y'], x, lines_pos['y'] + lines_pos['height'])
                    x += grid_spacing
            else:
                # Regular horizontal line
                pdf_canvas.line(start_x, line_y, end_x, line_y)
        
        # Reset dash pattern
        pdf_canvas.setDash([])
    
    def _render_anchor(self, pdf_canvas: canvas.Canvas, widget: Widget) -> None:
        """Render anchor link widget."""
        if not widget.content:
            return  # Skip empty anchor links
        
        # Get styling with explicit validation
        styling = getattr(widget, 'styling', {}) or {}
        font_name = styling.get('font', 'Helvetica')
        font_size = self.enforcer.check_font_size(styling.get('size', 12.0))
        color = self.enforcer.validate_color(styling.get('color', '#0066CC'))
        
        # Get anchor properties with explicit validation
        props = getattr(widget, 'properties', {}) or {}
        
        # Anchor type is required for anchor widgets
        if 'anchor_type' not in props:
            raise RenderingError(
                f"Anchor widget '{widget.id}': missing required property 'anchor_type'"
            )
        anchor_type = props['anchor_type']
        
        # Get type-specific properties
        target_page = props.get('target_page')
        destination = props.get('destination')
        
        # Convert position for text drawing
        text_pos = self.converter.convert_text_position(widget.position, font_size)
        
        # Set text properties
        pdf_canvas.setFont(font_name, font_size)
        
        # Calculate link rectangle coordinates for proper text measurement
        text_width = pdf_canvas.stringWidth(widget.content, font_name, font_size)
        link_rect = [
            text_pos['x'],
            text_pos['y'] - font_size * 0.2,  # Slightly below baseline
            text_pos['x'] + text_width,       # Actual text width
            text_pos['y'] + font_size * 0.8   # Above baseline
        ]
        
        # Create PDF link annotation based on anchor type with explicit validation
        if anchor_type == 'page_link':
            # Internal page link using automatic page bookmarks
            if target_page is None:
                raise RenderingError(
                    f"Anchor widget '{widget.id}': page_link anchor_type requires 'target_page' property"
                )
            
            if not isinstance(target_page, int) or target_page < 1:
                raise RenderingError(
                    f"Anchor widget '{widget.id}': target_page must be a positive integer, got {target_page}"
                )
            
            # Validate target page exists (will be created during multi-page rendering)
            total_pages = self._get_total_pages(self._group_widgets_by_page())
            if target_page > total_pages:
                raise RenderingError(
                    f"Anchor widget '{widget.id}': target_page {target_page} exceeds total pages {total_pages}"
                )
            
            page_bookmark_name = f"Page_{target_page}"
            pdf_canvas.linkAbsolute(
                "",  # Empty contents 
                page_bookmark_name,  # Destination bookmark name
                Rect=(link_rect[0], link_rect[1], link_rect[2], link_rect[3]),
                Border='[0 0 0]'  # No visible border around link
            )
            
        elif anchor_type == 'named_destination':
            # Named destination link
            if not destination or not isinstance(destination, str) or not destination.strip():
                raise RenderingError(
                    f"Anchor widget '{widget.id}': named_destination requires non-empty destination string"
                )
            
            pdf_canvas.linkAbsolute(
                "",  # Empty contents
                destination.strip(),  # Destination bookmark name
                Rect=(link_rect[0], link_rect[1], link_rect[2], link_rect[3]),
                Border='[0 0 0]'  # No visible border around link
            )
            
        elif anchor_type == 'outline_bookmark':
            # Create bookmark destination for this location
            if not destination or not isinstance(destination, str) or not destination.strip():
                raise RenderingError(
                    f"Anchor widget '{widget.id}': outline_bookmark requires non-empty destination string"
                )
            
            bookmark_name = destination.strip()
            pdf_canvas.bookmarkPage(bookmark_name)
            # Also make it a clickable link to the bookmark
            pdf_canvas.linkAbsolute(
                "",  # Empty contents
                bookmark_name,  # Destination bookmark name
                Rect=(link_rect[0], link_rect[1], link_rect[2], link_rect[3]),
                Border='[0 0 0]'  # No visible border around link
            )
            
        else:
            # Following CLAUDE.md Rule #4: Explicit error for unsupported anchor types
            raise RenderingError(
                f"Anchor widget '{widget.id}': unsupported anchor_type '{anchor_type}'. "
                f"Supported types: page_link, named_destination, outline_bookmark"
            )
        
        # Draw the underlined text
        pdf_canvas.drawString(text_pos['x'], text_pos['y'], widget.content)
        
        # Draw underline using actual text width
        underline_y = text_pos['y'] - font_size * 0.1
        pdf_canvas.line(
            text_pos['x'], 
            underline_y, 
            text_pos['x'] + text_width, 
            underline_y
        )
    
    def _render_calendar(self, pdf_canvas: canvas.Canvas, widget: Widget) -> None:
        """Render calendar widget with proper layout and optional clickable dates."""
        # Get calendar properties with explicit validation
        props = getattr(widget, 'properties', {}) or {}
        styling = getattr(widget, 'styling', {}) or {}
        
        # Calendar type validation with explicit default (documented in widget palette)
        calendar_type = props.get('calendar_type')
        if calendar_type is None:
            # Use explicit documented default from WidgetPalette configuration
            calendar_type = 'monthly'
        if calendar_type not in ['monthly', 'weekly', 'custom_range']:
            raise RenderingError(
                f"Calendar widget '{widget.id}': invalid calendar_type '{calendar_type}'. "
                f"Supported types: monthly, weekly, custom_range"
            )
        
        # Date validation
        start_date_str = props.get('start_date')
        if not start_date_str:
            raise RenderingError(
                f"Calendar widget '{widget.id}': missing required property 'start_date'"
            )
        
        try:
            # Parse ISO 8601 date format (YYYY-MM-DD)
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        except ValueError as e:
            raise RenderingError(
                f"Calendar widget '{widget.id}': invalid start_date format '{start_date_str}'. "
                f"Expected YYYY-MM-DD format."
            ) from e
        
        # Get styling properties with explicit documented defaults
        font_name = styling.get('font')
        if font_name is None:
            font_name = 'Helvetica'  # Default e-ink font
        
        font_size = styling.get('size')
        if font_size is None:
            font_size = 10.0  # Default calendar font size from WidgetPalette
        font_size = self.enforcer.check_font_size(font_size)
        
        color = styling.get('color')
        if color is None:
            color = '#000000'  # Black for maximum e-ink contrast
        color = self.enforcer.validate_color(color)
        
        # Get layout properties with explicit documented defaults
        show_weekdays = props.get('show_weekdays')
        if show_weekdays is None:
            show_weekdays = True  # Default from WidgetPalette
        
        show_month_year = props.get('show_month_year')
        if show_month_year is None:
            show_month_year = True  # Default from WidgetPalette
        
        show_grid_lines = props.get('show_grid_lines')
        if show_grid_lines is None:
            show_grid_lines = True  # Default from WidgetPalette
        
        cell_min_size = props.get('cell_min_size')
        if cell_min_size is None:
            cell_min_size = 44.0  # E-ink touch target minimum from WidgetPalette
        
        first_day_of_week = props.get('first_day_of_week')
        if first_day_of_week is None:
            first_day_of_week = 'monday'  # European default from WidgetPalette
        if first_day_of_week not in ['monday', 'sunday']:
            raise RenderingError(
                f"Calendar widget '{widget.id}': invalid first_day_of_week '{first_day_of_week}'. "
                f"Supported values: monday, sunday"
            )
        
        # Get link strategy with explicit documented default
        link_strategy = props.get('link_strategy')
        if link_strategy is None:
            link_strategy = 'no_links'  # Safe default - no links unless explicitly requested
        if link_strategy not in ['sequential_pages', 'named_destinations', 'no_links']:
            raise RenderingError(
                f"Calendar widget '{widget.id}': invalid link_strategy '{link_strategy}'. "
                f"Supported strategies: sequential_pages, named_destinations, no_links"
            )
        
        # Validate link strategy parameters
        if link_strategy == 'sequential_pages':
            first_page_number = props.get('first_page_number')
            pages_per_date = props.get('pages_per_date')
            
            if first_page_number is None:
                raise RenderingError(
                    f"Calendar widget '{widget.id}': sequential_pages strategy requires 'first_page_number'"
                )
            if pages_per_date is None:
                raise RenderingError(
                    f"Calendar widget '{widget.id}': sequential_pages strategy requires 'pages_per_date'"
                )
            if not isinstance(first_page_number, int) or first_page_number < 1:
                raise RenderingError(
                    f"Calendar widget '{widget.id}': first_page_number must be positive integer"
                )
            if not isinstance(pages_per_date, int) or pages_per_date < 1:
                raise RenderingError(
                    f"Calendar widget '{widget.id}': pages_per_date must be positive integer"
                )
        
        elif link_strategy == 'named_destinations':
            destination_pattern = props.get('destination_pattern')
            if not destination_pattern or not isinstance(destination_pattern, str):
                raise RenderingError(
                    f"Calendar widget '{widget.id}': named_destinations strategy requires 'destination_pattern'"
                )
        
        # Convert widget position for drawing
        cal_pos = self.converter.convert_position_for_drawing(widget.position)
        
        # Set text properties
        pdf_canvas.setFont(font_name, font_size)
        
        # Render based on calendar type
        if calendar_type == 'monthly':
            self._render_monthly_calendar(
                pdf_canvas, widget, start_date, cal_pos, font_name, font_size,
                show_weekdays, show_month_year, show_grid_lines, cell_min_size,
                first_day_of_week, link_strategy, props
            )
        elif calendar_type == 'weekly':
            self._render_weekly_calendar(
                pdf_canvas, widget, start_date, cal_pos, font_name, font_size,
                show_weekdays, show_month_year, show_grid_lines, cell_min_size,
                first_day_of_week, link_strategy, props
            )
        else:
            # Simplified preview for custom_range (not fully implemented)
            self._render_calendar_preview(
                pdf_canvas, widget, calendar_type, start_date, cal_pos, 
                font_name, font_size, link_strategy, props
            )
    
    def _render_monthly_calendar(self, pdf_canvas: canvas.Canvas, widget: Widget, 
                               start_date: date, cal_pos: Dict[str, float],
                               font_name: str, font_size: float,
                               show_weekdays: bool, show_month_year: bool, 
                               show_grid_lines: bool, cell_min_size: float,
                               first_day_of_week: str, link_strategy: str, 
                               props: Dict[str, Any]) -> None:
        """Render a monthly calendar layout."""
        
        # Get month information
        year = start_date.year
        month = start_date.month
        
        # Calculate calendar layout dimensions
        calendar_width = cal_pos['width']
        calendar_height = cal_pos['height']
        
        # Reserve space for headers
        header_height = font_size * 2 if show_month_year else 0
        weekday_height = font_size * 1.5 if show_weekdays else 0
        available_height = calendar_height - header_height - weekday_height
        
        # Calculate how many weeks are needed for this month
        first_of_month = date(year, month, 1)
        first_weekday = first_of_month.weekday()  # 0=Monday, 6=Sunday
        
        # Adjust first weekday based on locale
        if first_day_of_week == 'monday':
            # Keep Python's Monday=0 indexing for European locale
            pass  # first_weekday is already correct (0=Monday)
        else:
            # Convert to Sunday=0 indexing for US locale
            first_weekday = (first_weekday + 1) % 7
        
        days_in_month = calendar.monthrange(year, month)[1]
        weeks_needed = math.ceil((days_in_month + first_weekday) / 7)
        actual_weeks = max(4, min(6, weeks_needed))  # 4-6 weeks
        
        # Calculate cell dimensions (7 columns for days of week) to FIT bounds
        # Respect the widget's width/height exactly; log violations if below min touch size
        available_height = max(0.0, available_height)
        cell_width = calendar_width / 7
        cell_height = available_height / actual_weeks if actual_weeks > 0 else 0.0
        
        # Log touch target violations without expanding beyond bounds
        try:
            _ = self.enforcer.check_touch_target_size(cell_width, cell_height)
        except Exception:
            # In strict mode this may raise; bubble up for consistent behavior
            raise
        
        # Month and year header
        if show_month_year:
            month_names = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December']
            header_text = f"{month_names[month - 1]} {year}"
            
            # Center the header text
            text_width = pdf_canvas.stringWidth(header_text, font_name, font_size)
            header_x = cal_pos['x'] + (calendar_width - text_width) / 2
            header_y = cal_pos['y'] + calendar_height - font_size
            
            pdf_canvas.drawString(header_x, header_y, header_text)
            
            # Draw header separator line if grid lines enabled
            if show_grid_lines:
                line_y = cal_pos['y'] + calendar_height - header_height
                stroke_width = self.enforcer.check_stroke_width(0.5)
                pdf_canvas.setLineWidth(stroke_width)
                pdf_canvas.line(cal_pos['x'], line_y, cal_pos['x'] + calendar_width, line_y)
        
        # Weekday headers
        if show_weekdays:
            # Configure weekdays based on locale
            weekdays = (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] 
                       if first_day_of_week == 'monday' 
                       else ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
            weekday_y = cal_pos['y'] + calendar_height - header_height - font_size
            
            for i, day_name in enumerate(weekdays):
                weekday_x = cal_pos['x'] + (i * cell_width) + (cell_width / 2)
                # Center the text in the cell
                text_width = pdf_canvas.stringWidth(day_name, font_name, font_size * 0.8)
                weekday_x -= text_width / 2
                
                pdf_canvas.setFont(font_name, font_size * 0.8)
                pdf_canvas.drawString(weekday_x, weekday_y, day_name)
                pdf_canvas.setFont(font_name, font_size)  # Reset to normal size
        
        # Use already calculated values from above
        
        # Grid layout starting position
        grid_start_y = cal_pos['y'] + calendar_height - header_height - weekday_height
        
        # Draw calendar grid using optimal number of weeks
        for week in range(actual_weeks):
            for day_col in range(7):
                # Calculate cell position
                cell_x = cal_pos['x'] + (day_col * cell_width)
                cell_y = grid_start_y - ((week + 1) * cell_height)
                
                # Calculate day number
                day_number = (week * 7 + day_col) - first_weekday + 1
                is_current_month = 1 <= day_number <= days_in_month
                
                # Draw cell border if grid lines enabled
                if show_grid_lines:
                    stroke_width = self.enforcer.check_stroke_width(0.5)
                    pdf_canvas.setLineWidth(stroke_width)
                    pdf_canvas.rect(cell_x, cell_y, cell_width, cell_height, stroke=1, fill=0)
                
                # Draw day number if in current month
                if is_current_month:
                    day_text = str(day_number)
                    
                    # Center the day number in the cell
                    text_width = pdf_canvas.stringWidth(day_text, font_name, font_size)
                    day_x = cell_x + (cell_width - text_width) / 2
                    day_y = cell_y + (cell_height / 2) - (font_size / 2)
                    
                    # Create clickable link if strategy enabled
                    if link_strategy != 'no_links':
                        self._create_calendar_date_link(
                            pdf_canvas, widget, date(year, month, day_number),
                            cell_x, cell_y, cell_width, cell_height,
                            link_strategy, props
                        )
                    
                    pdf_canvas.drawString(day_x, day_y, day_text)
    
    def _create_calendar_date_link(self, pdf_canvas: canvas.Canvas, widget: Widget,
                                 date_obj: date, cell_x: float, cell_y: float,
                                 cell_width: float, cell_height: float,
                                 link_strategy: str, props: Dict[str, Any]) -> None:
        """Create clickable link for a calendar date cell."""
        
        # Define link rectangle (entire cell is clickable)
        link_rect = [cell_x, cell_y, cell_x + cell_width, cell_y + cell_height]
        
        if link_strategy == 'sequential_pages':
            # Calculate target page based on date and configuration
            first_page_number = props['first_page_number']
            pages_per_date = props['pages_per_date']
            
            # Calculate days since start date
            start_date_str = props['start_date']
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            days_diff = (date_obj - start_date).days
            
            # Only create links for dates on or after the start date
            if days_diff >= 0:
                # Calculate target page number
                target_page = first_page_number + (days_diff * pages_per_date)
                
                # Validate target page exists
                total_pages = self._get_total_pages(self._group_widgets_by_page())
                if target_page <= total_pages:
                    page_bookmark_name = f"Page_{target_page}"
                    pdf_canvas.linkAbsolute(
                        "",  # Empty contents
                        page_bookmark_name,  # Destination bookmark
                        Rect=(link_rect[0], link_rect[1], link_rect[2], link_rect[3]),
                        Border='[0 0 0]'  # No visible border
                    )
        
        elif link_strategy == 'named_destinations':
            # Generate destination name from pattern
            destination_pattern = props['destination_pattern']
            
            # Replace date placeholders in pattern
            destination_name = destination_pattern.replace(
                '{YYYY}', f"{date_obj.year:04d}"
            ).replace(
                '{MM}', f"{date_obj.month:02d}"
            ).replace(
                '{DD}', f"{date_obj.day:02d}"
            ).replace(
                '{M}', str(date_obj.month)
            ).replace(
                '{D}', str(date_obj.day)
            )
            
            pdf_canvas.linkAbsolute(
                "",  # Empty contents
                destination_name,  # Generated destination name
                Rect=(link_rect[0], link_rect[1], link_rect[2], link_rect[3]),
                Border='[0 0 0]'  # No visible border
            )
    
    def _render_weekly_calendar(self, pdf_canvas: canvas.Canvas, widget: Widget,
                               start_date: date, cal_pos: Dict[str, float],
                               font_name: str, font_size: float,
                               show_weekdays: bool, show_month_year: bool, 
                               show_grid_lines: bool, cell_min_size: float,
                               first_day_of_week: str, link_strategy: str, 
                               props: Dict[str, Any]) -> None:
        """Render a weekly calendar layout."""
        
        # Calculate the start of the week containing the start date
        start_of_week = start_date
        day_of_week = start_date.weekday()  # 0=Monday, 6=Sunday
        
        # Adjust for locale
        if first_day_of_week == 'monday':
            # Monday-first: use Python's natural weekday indexing
            days_back = day_of_week
        else:
            # Sunday-first: convert to Sunday=0 indexing
            day_of_week = (day_of_week + 1) % 7  # Convert to Sunday=0
            days_back = day_of_week
        
        # Calculate actual start of week
        start_of_week = date(start_date.year, start_date.month, start_date.day)
        start_of_week = start_of_week - timedelta(days=days_back)
        
        # Generate 7 days of the week
        week_days = []
        for i in range(7):
            current_day = start_of_week + timedelta(days=i)
            week_days.append(current_day)
        
        # Calculate layout dimensions
        calendar_width = cal_pos['width']
        calendar_height = cal_pos['height']
        
        # Reserve space for headers
        header_height = font_size * 2 if show_month_year else 0
        weekday_height = font_size * 1.5 if show_weekdays else 0
        available_height = calendar_height - header_height - weekday_height
        
        # Calculate cell dimensions (7 columns for days of week) to FIT bounds
        # Weekly view has a single row; use full available height and exact width fraction
        available_height = max(0.0, available_height)
        cell_width = calendar_width / 7
        cell_height = available_height
        
        # Log touch target violations without expanding beyond bounds
        try:
            _ = self.enforcer.check_touch_target_size(cell_width, cell_height)
        except Exception:
            # In strict mode this may raise; bubble up for consistent behavior
            raise
        
        # Week header
        if show_month_year:
            week_text = f"{start_of_week.strftime('%b %Y')} - Week {start_of_week.isocalendar()[1]}"
            
            # Center the header text
            text_width = pdf_canvas.stringWidth(week_text, font_name, font_size)
            header_x = cal_pos['x'] + (calendar_width - text_width) / 2
            header_y = cal_pos['y'] + calendar_height - font_size
            
            pdf_canvas.drawString(header_x, header_y, week_text)
            
            # Draw header separator line if grid lines enabled
            if show_grid_lines:
                line_y = cal_pos['y'] + calendar_height - header_height
                stroke_width = self.enforcer.check_stroke_width(0.5)
                pdf_canvas.setLineWidth(stroke_width)
                pdf_canvas.line(cal_pos['x'], line_y, cal_pos['x'] + calendar_width, line_y)
        
        # Weekday headers
        if show_weekdays:
            weekdays = (['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] 
                       if first_day_of_week == 'monday' 
                       else ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
            weekday_y = cal_pos['y'] + calendar_height - header_height - font_size
            
            for i, day_name in enumerate(weekdays):
                weekday_x = cal_pos['x'] + (i * cell_width) + (cell_width / 2)
                # Center the text in the cell
                text_width = pdf_canvas.stringWidth(day_name, font_name, font_size * 0.8)
                weekday_x -= text_width / 2
                
                pdf_canvas.setFont(font_name, font_size * 0.8)
                pdf_canvas.drawString(weekday_x, weekday_y, day_name)
                pdf_canvas.setFont(font_name, font_size)  # Reset to normal size
        
        # Grid layout starting position
        grid_start_y = cal_pos['y'] + calendar_height - header_height - weekday_height
        
        # Draw weekly calendar grid
        for day_col in range(7):
            current_day = week_days[day_col]
            
            # Calculate cell position
            cell_x = cal_pos['x'] + (day_col * cell_width)
            cell_y = grid_start_y - cell_height
            
            # Draw cell border if grid lines enabled
            if show_grid_lines:
                stroke_width = self.enforcer.check_stroke_width(0.5)
                pdf_canvas.setLineWidth(stroke_width)
                pdf_canvas.rect(cell_x, cell_y, cell_width, cell_height, stroke=1, fill=0)
            
            # Draw day number at top of cell
            day_text = str(current_day.day)
            text_width = pdf_canvas.stringWidth(day_text, font_name, font_size)
            day_x = cell_x + (cell_width - text_width) / 2
            day_y = cell_y + cell_height - font_size - 5  # 5pt margin from top
            
            # Create clickable link if strategy enabled
            if link_strategy != 'no_links':
                self._create_calendar_date_link(
                    pdf_canvas, widget, current_day,
                    cell_x, cell_y, cell_width, cell_height,
                    link_strategy, props
                )
            
            pdf_canvas.drawString(day_x, day_y, day_text)

    def _render_calendar_preview(self, pdf_canvas: canvas.Canvas, widget: Widget,
                               calendar_type: str, start_date: date,
                               cal_pos: Dict[str, float], font_name: str, 
                               font_size: float, link_strategy: str,
                               props: Dict[str, Any]) -> None:
        """Render simplified preview for custom_range calendars."""
        
        # Draw a simple preview box with calendar type information
        preview_text = f"{calendar_type.upper()} CALENDAR"
        date_text = f"Start: {start_date.strftime('%Y-%m-%d')}"
        
        # Calculate centered text positions
        preview_width = pdf_canvas.stringWidth(preview_text, font_name, font_size)
        date_width = pdf_canvas.stringWidth(date_text, font_name, font_size * 0.8)
        
        preview_x = cal_pos['x'] + (cal_pos['width'] - preview_width) / 2
        date_x = cal_pos['x'] + (cal_pos['width'] - date_width) / 2
        
        preview_y = cal_pos['y'] + cal_pos['height'] / 2 + font_size
        date_y = cal_pos['y'] + cal_pos['height'] / 2 - font_size
        
        # Draw preview text
        pdf_canvas.drawString(preview_x, preview_y, preview_text)
        pdf_canvas.setFont(font_name, font_size * 0.8)
        pdf_canvas.drawString(date_x, date_y, date_text)
        
        # Add link strategy information
        if link_strategy != 'no_links':
            link_text = f"Links: {link_strategy}"
            link_width = pdf_canvas.stringWidth(link_text, font_name, font_size * 0.7)
            link_x = cal_pos['x'] + (cal_pos['width'] - link_width) / 2
            link_y = date_y - font_size
            
            pdf_canvas.setFont(font_name, font_size * 0.7)
            pdf_canvas.drawString(link_x, link_y, link_text)
        
        # Draw border around preview
        stroke_width = self.enforcer.check_stroke_width(1.0)
        pdf_canvas.setLineWidth(stroke_width)
        pdf_canvas.rect(cal_pos['x'], cal_pos['y'], cal_pos['width'], cal_pos['height'], 
                       stroke=1, fill=0)
        
        # Reset font
        pdf_canvas.setFont(font_name, font_size)


def render_template(template: Template, 
                   profile_name: str,
                   strict_mode: bool = False,
                   deterministic: bool = True) -> bytes:
    """
    Render template to PDF bytes.
    
    Args:
        template: Validated template
        profile_name: Device profile name
        strict_mode: Fail on constraint violations
        deterministic: Use fixed settings for reproducible output
        
    Returns:
        PDF content as bytes
        
    Raises:
        RenderingError: If rendering fails
        ValidationError: If constraints violated in strict mode
    """
    renderer = DeterministicPDFRenderer(template, profile_name, strict_mode)
    return renderer.render_to_bytes(deterministic=deterministic)
