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
from reportlab.lib.utils import ImageReader

from .schema import Template, Widget, Canvas as CanvasConfig, Position
from .coordinates import CoordinateConverter, create_converter_for_canvas
from .fonts import ensure_font_registered
from .profiles import ConstraintEnforcer, create_constraint_enforcer
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
            
            # Pass 3: No post-processing (named destinations/outlines removed)
            final_pdf = buffer.getvalue()
            
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

        # Named destinations removed; no additional pages from navigation

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
        elif widget.type == "tap_zone":
            self._render_tap_zone(pdf_canvas, widget, page_num)
        elif widget.type == "calendar":
            self._render_calendar(pdf_canvas, widget)
        elif widget.type == "image":
            self._render_image(pdf_canvas, widget)
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
        
        # Set text properties (with font registration)
        font_name = ensure_font_registered(font_name)
        pdf_canvas.setFont(font_name, font_size)
        try:
            pdf_canvas.setFillColor(HexColor(color))
        except Exception:
            pass
        
        # Token substitution for dynamic fields
        content_text = widget.content
        try:
            content_text = (content_text
                            .replace('{page}', str(page_num))
                            .replace('{total_pages}', str(self._total_pages)))
        except Exception:
            pass

        # Draw text
        try:
            pdf_canvas.setFillColor(HexColor(color))
        except Exception:
            pass
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
            label_y = box_pos['y'] + (fixed_height / 2)  # Approximate vertical centering

            # Use widget styling if provided
            styling = getattr(widget, 'styling', {}) or {}
            label_font = styling.get('font', 'Helvetica')
            label_size = self.enforcer.check_font_size(float(styling.get('size', 10.0)))
            label_color = self.enforcer.validate_color(styling.get('color', '#000000'))

            label_font = ensure_font_registered(label_font)
            pdf_canvas.setFont(label_font, label_size)
            try:
                pdf_canvas.setFillColor(HexColor(label_color))
            except Exception:
                pass
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
        top_padding = max(0.0, float(props.get('top_padding', 0.0)))
        bottom_padding = max(0.0, float(props.get('bottom_padding', 0.0)))
        grid_spacing = float(props.get('grid_spacing', 20.0))
        columns = int(props.get('columns', 0))
        vertical_guides = props.get('vertical_guides') or []
        line_cap = props.get('line_cap', 'butt')  # 'butt' | 'round'
        
        # Convert position for drawing
        lines_pos = self.converter.convert_position_for_drawing(widget.position)
        
        # Enforce stroke width constraint
        stroke_width = self.enforcer.check_stroke_width(line_thickness)
        pdf_canvas.setLineWidth(stroke_width)
        # Line cap style
        try:
            pdf_canvas.setLineCap(1 if line_cap == 'round' else 0)
        except Exception:
            pass
        
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
        
        # Draw each horizontal line
        for i in range(line_count):
            # Calculate Y position for this line (from top of widget area)
            line_y = lines_pos['y'] + lines_pos['height'] - top_padding - (i * line_spacing)
            
            # Skip lines that would be outside the widget bounds
            if line_y < lines_pos['y'] + bottom_padding:
                break
                
            # Draw horizontal line with margins
            start_x = lines_pos['x'] + margin_left
            end_x = start_x + available_width
            
            # Draw horizontal line
            pdf_canvas.line(start_x, line_y, end_x, line_y)

        # Vertical structures
        if line_style == 'grid':
            # Draw vertical grid lines at specified spacing
            if grid_spacing > 0:
                x = lines_pos['x'] + margin_left
                end_x = x + available_width
                while x <= end_x + 0.1:  # include last line if aligned
                    pdf_canvas.line(x, lines_pos['y'], x, lines_pos['y'] + lines_pos['height'])
                    x += grid_spacing
        elif columns and columns > 1:
            # Draw column guides (no dash)
            pdf_canvas.setDash([])
            col_width = available_width / columns
            x = lines_pos['x'] + margin_left
            for c in range(1, columns):
                cx = x + c * col_width
                pdf_canvas.line(cx, lines_pos['y'], cx, lines_pos['y'] + lines_pos['height'])
        # Custom vertical guides by ratio
        if isinstance(vertical_guides, list) and vertical_guides:
            pdf_canvas.setDash([])
            for ratio in vertical_guides:
                try:
                    r = float(ratio)
                except Exception:
                    continue
                if r <= 0 or r >= 1:
                    continue
                gx = lines_pos['x'] + margin_left + available_width * r
                pdf_canvas.line(gx, lines_pos['y'], gx, lines_pos['y'] + lines_pos['height'])
        
        # Reset dash pattern
        pdf_canvas.setDash([])
        try:
            pdf_canvas.setLineCap(0)
        except Exception:
            pass
    
    def _render_anchor(self, pdf_canvas: canvas.Canvas, widget: Widget) -> None:
        """Render anchor link widget (pages-only)."""
        if not widget.content:
            return  # Skip empty anchor links
        
        # Get styling with explicit validation
        styling = getattr(widget, 'styling', {}) or {}
        font_name = styling.get('font', 'Helvetica')
        font_size = self.enforcer.check_font_size(styling.get('size', 12.0))
        color = self.enforcer.validate_color(styling.get('color', '#0066CC'))
        
        # Get anchor properties (pages-only)
        props = getattr(widget, 'properties', {}) or {}
        target_page = props.get('target_page')
        
        # Convert position for text drawing
        text_pos = self.converter.convert_text_position(widget.position, font_size)
        
        # Set text properties (with font registration)
        font_name = ensure_font_registered(font_name)
        pdf_canvas.setFont(font_name, font_size)
        try:
            pdf_canvas.setFillColor(HexColor(color))
        except Exception:
            pass
        
        # Calculate link rectangle coordinates for proper text measurement
        text_width = pdf_canvas.stringWidth(widget.content, font_name, font_size)
        link_rect = [
            text_pos['x'],
            text_pos['y'] - font_size * 0.2,  # Slightly below baseline
            text_pos['x'] + text_width,       # Actual text width
            text_pos['y'] + font_size * 0.8   # Above baseline
        ]
        
        # Validate target page
        if target_page is None or not isinstance(target_page, int) or target_page < 1:
            raise RenderingError(
                f"Anchor widget '{widget.id}': requires positive integer 'target_page'"
            )

        total_pages = self._get_total_pages(self._group_widgets_by_page())
        if target_page > total_pages:
            raise RenderingError(
                f"Anchor widget '{widget.id}': target_page {target_page} exceeds total pages {total_pages}"
            )

        page_bookmark_name = f"Page_{target_page}"
        pdf_canvas.linkAbsolute(
            "",
            page_bookmark_name,
            Rect=(link_rect[0], link_rect[1], link_rect[2], link_rect[3]),
            Border='[0 0 0]'
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

    def _render_tap_zone(self, pdf_canvas: canvas.Canvas, widget: Widget, page_num: int) -> None:
        """Render an invisible tap zone that creates a link rectangle."""
        props = getattr(widget, 'properties', {}) or {}
        action = props.get('tap_action', 'page_link')

        # Compute rectangle in PDF coords
        rect_pos = self.converter.convert_position_for_drawing(widget.position)
        link_rect = (
            rect_pos['x'],
            rect_pos['y'],
            rect_pos['x'] + rect_pos['width'],
            rect_pos['y'] + rect_pos['height']
        )

        if rect_pos['width'] <= 0 or rect_pos['height'] <= 0:
            return

        if action == 'page_link':
            target_page = props.get('target_page')
            if not isinstance(target_page, int) or target_page < 1:
                raise RenderingError(
                    f"Tap zone '{widget.id}': page_link requires positive integer target_page"
                )
            total_pages = self._get_total_pages(self._group_widgets_by_page())
            if target_page > total_pages:
                # Clamp to last page in non-strict mode
                if self.strict_mode:
                    raise RenderingError(
                        f"Tap zone '{widget.id}': target_page {target_page} exceeds total pages {total_pages}"
                    )
                target_page = total_pages
            page_bookmark_name = f"Page_{target_page}"
            pdf_canvas.linkAbsolute("", page_bookmark_name, Rect=link_rect, Border='[0 0 0]')

        elif action == 'prev_page':
            target_page = max(1, page_num - 1)
            page_bookmark_name = f"Page_{target_page}"
            pdf_canvas.linkAbsolute("", page_bookmark_name, Rect=link_rect, Border='[0 0 0]')

        elif action == 'next_page':
            total_pages = self._get_total_pages(self._group_widgets_by_page())
            target_page = min(total_pages, page_num + 1)
            page_bookmark_name = f"Page_{target_page}"
            pdf_canvas.linkAbsolute("", page_bookmark_name, Rect=link_rect, Border='[0 0 0]')

        else:
            raise RenderingError(
                f"Tap zone '{widget.id}': unsupported tap_action '{action}'. "
                f"Supported: page_link, prev_page, next_page"
            )

    def _resolve_image_reader(self, src: str) -> Optional[ImageReader]:
        """Resolve an ImageReader from a path or data URI."""
        if not src or not isinstance(src, str):
            return None
        try:
            if src.startswith('data:image/'):
                # data URI: data:image/png;base64,...
                import base64
                header, b64data = src.split(',', 1)
                raw = base64.b64decode(b64data)
                return ImageReader(BytesIO(raw))
            if src.startswith('http://') or src.startswith('https://'):
                # Fetch via urllib to support remote images
                try:
                    import urllib.request
                    req = urllib.request.Request(src, headers={
                        'User-Agent': 'einkpdf/0.1 (+https://github.com/einkpdf)'
                    })
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        data = resp.read()
                    return ImageReader(BytesIO(data))
                except Exception:
                    return None
            else:
                # Treat as path; support absolute, CWD-relative, and package assets.
                # 1) Absolute or CWD-relative
                if os.path.isabs(src) and os.path.exists(src):
                    return ImageReader(src)
                if os.path.exists(src):
                    return ImageReader(src)
                # 2) Trim leading slashes/dots and try package assets directory
                cleaned = src.lstrip('/').lstrip('./')
                base_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))  # src/einkpdf
                asset_path = os.path.normpath(os.path.join(base_dir, 'assets', cleaned))
                if os.path.exists(asset_path):
                    return ImageReader(asset_path)
                # 3) If the given path already contains 'assets/', try relative to package root
                if cleaned.startswith('assets/'):
                    asset_path2 = os.path.normpath(os.path.join(base_dir, cleaned))
                    if os.path.exists(asset_path2):
                        return ImageReader(asset_path2)
                # 4) Fallback: let ImageReader attempt to open it
                return ImageReader(src)
        except Exception:
            return None

    def _render_image(self, pdf_canvas: canvas.Canvas, widget: Widget) -> None:
        """Render an image widget (PNG/JPEG)."""
        props = getattr(widget, 'properties', {}) or {}
        src = props.get('image_src')
        fit = props.get('image_fit', 'fit')

        img_reader = self._resolve_image_reader(src) if src else None
        if not img_reader:
            if self.strict_mode:
                raise RenderingError(f"Image widget '{widget.id}': cannot load image from '{src}'")
            else:
                print(f"Warning: Skipping image widget {widget.id}, source not found: {src}")
                return

        # Get image intrinsic size
        try:
            iw, ih = img_reader.getSize()
        except Exception as e:
            if self.strict_mode:
                raise RenderingError(f"Image widget '{widget.id}': failed to read image size: {e}") from e
            print(f"Warning: Skipping image widget {widget.id}, failed to read size: {e}")
            return

        box = self.converter.convert_position_for_drawing(widget.position)
        x, y, w, h = box['x'], box['y'], box['width'], box['height']

        # Compute draw size and position
        draw_w, draw_h = w, h
        draw_x, draw_y = x, y

        if fit == 'fit':
            # Preserve aspect ratio, contain within box, centered
            scale = min(w / iw, h / ih) if iw > 0 and ih > 0 else 1.0
            draw_w = iw * scale
            draw_h = ih * scale
            draw_x = x + (w - draw_w) / 2
            draw_y = y + (h - draw_h) / 2
        elif fit == 'actual':
            draw_w = iw
            draw_h = ih
            # draw_x, draw_y already set to top-left of box for drawing (bottom-left coordinates)
        else:
            # 'stretch' or unknown: fill the entire box
            draw_w = w
            draw_h = h

        try:
            pdf_canvas.drawImage(img_reader, draw_x, draw_y, width=draw_w, height=draw_h, preserveAspectRatio=False, mask='auto')
        except Exception as e:
            if self.strict_mode:
                raise RenderingError(f"Image widget '{widget.id}': failed to draw image: {e}") from e
            print(f"Warning: Failed to draw image {widget.id}: {e}")
    
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
        if link_strategy not in ['sequential_pages', 'no_links']:
            raise RenderingError(
                f"Calendar widget '{widget.id}': invalid link_strategy '{link_strategy}'. "
                f"Supported strategies: sequential_pages, no_links"
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
        
        
        
        # Convert widget position for drawing
        cal_pos = self.converter.convert_position_for_drawing(widget.position)
        
        # Set text properties (with font registration)
        font_name = ensure_font_registered(font_name)
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
        # Extra options
        show_trailing_days = bool(props.get('show_trailing_days', False))
        highlight_today = bool(props.get('highlight_today', False))
        highlight_date_str = props.get('highlight_date')
        day_label_style = props.get('weekday_label_style', 'short')  # short|narrow|full
        month_name_format = props.get('month_name_format', 'long')   # long|short
        week_numbers = bool(props.get('week_numbers', False))
        cell_padding = float(props.get('cell_padding', 4.0))
        
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
        week_col_width = (font_size * 2.2) if week_numbers else 0.0
        cell_width = (calendar_width - week_col_width) / 7
        cell_height = available_height / actual_weeks if actual_weeks > 0 else 0.0
        
        # Log touch target violations without expanding beyond bounds
        try:
            _ = self.enforcer.check_touch_target_size(cell_width, cell_height)
        except Exception:
            # In strict mode this may raise; bubble up for consistent behavior
            raise
        
        # Month and year header
        if show_month_year:
            month_names_long = ['January', 'February', 'March', 'April', 'May', 'June',
                                'July', 'August', 'September', 'October', 'November', 'December']
            month_names_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            # Default to long unless overridden by props
            month_name_format = props.get('month_name_format', 'long')
            month_names = month_names_long if month_name_format == 'long' else month_names_short
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
            # Configure weekdays based on locale and style
            if first_day_of_week == 'monday':
                base = [('Mon','M','Monday'), ('Tue','T','Tuesday'), ('Wed','W','Wednesday'),
                        ('Thu','T','Thursday'), ('Fri','F','Friday'), ('Sat','S','Saturday'), ('Sun','S','Sunday')]
            else:
                base = [('Sun','S','Sunday'), ('Mon','M','Monday'), ('Tue','T','Tuesday'),
                        ('Wed','W','Wednesday'), ('Thu','T','Thursday'), ('Fri','F','Friday'), ('Sat','S','Saturday')]
            idx = 0 if day_label_style == 'short' else (1 if day_label_style == 'narrow' else 2)
            weekdays = [b[idx] for b in base]
            weekday_y = cal_pos['y'] + calendar_height - header_height - font_size
            
            for i, day_name in enumerate(weekdays):
                weekday_x = cal_pos['x'] + week_col_width + (i * cell_width) + (cell_width / 2)
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
            # Bottom of this row
            row_bottom_y = grid_start_y - ((week + 1) * cell_height)
            for day_col in range(7):
                # Calculate cell position (offset by week number column if present)
                cell_x = cal_pos['x'] + week_col_width + (day_col * cell_width)
                cell_y = row_bottom_y
                
                # Calculate day number
                day_number = (week * 7 + day_col) - first_weekday + 1
                is_current_month = 1 <= day_number <= days_in_month
                # Determine the actual date for this cell (supports trailing/leading days)
                current_date = None
                if is_current_month:
                    current_date = date(year, month, day_number)
                elif show_trailing_days:
                    if day_number < 1:
                        pm = month - 1 if month > 1 else 12
                        py = year if month > 1 else year - 1
                        pdays = calendar.monthrange(py, pm)[1]
                        current_date = date(py, pm, pdays + day_number)
                    else:
                        nm = month + 1 if month < 12 else 1
                        ny = year if month < 12 else year + 1
                        current_date = date(ny, nm, day_number - days_in_month)

                # Draw cell border if grid lines enabled
                if show_grid_lines:
                    stroke_width = self.enforcer.check_stroke_width(0.5)
                    pdf_canvas.setLineWidth(stroke_width)
                    pdf_canvas.rect(cell_x, cell_y, cell_width, cell_height, stroke=1, fill=0)
                
                # Draw day label (current month or trailing/leading if enabled)
                if is_current_month or (show_trailing_days and current_date):
                    day_text = str((current_date.day if current_date else day_number))
                    day_x = cell_x + cell_padding
                    day_y = cell_y + cell_height - font_size - cell_padding
                    if not is_current_month:
                        prev_fill = pdf_canvas._fillColorObj
                        try:
                            pdf_canvas.setFillColor(HexColor('#888888'))
                        except Exception:
                            pass
                        pdf_canvas.drawString(day_x, day_y, day_text)
                        pdf_canvas.setFillColor(prev_fill)
                    else:
                        pdf_canvas.drawString(day_x, day_y, day_text)

                    # Link for current month days
                    if link_strategy != 'no_links' and current_date and is_current_month:
                        self._create_calendar_date_link(
                            pdf_canvas, widget, current_date,
                            cell_x, cell_y, cell_width, cell_height,
                            link_strategy, props
                        )

                    # Highlight today or specific date
                    try:
                        target_highlight = None
                        if highlight_date_str:
                            target_highlight = datetime.strptime(highlight_date_str, '%Y-%m-%d').date()
                        elif highlight_today:
                            target_highlight = datetime.utcnow().date()
                        if target_highlight and current_date and current_date == target_highlight:
                            stroke_width = self.enforcer.check_stroke_width(1.0)
                            pdf_canvas.setLineWidth(stroke_width)
                            pdf_canvas.rect(cell_x + 1.5, cell_y + 1.5, cell_width - 3, cell_height - 3, stroke=1, fill=0)
                    except Exception:
                        pass

            # Week numbers column
            if week_numbers:
                # Determine first date of this calendar row
                first_day_num = (week * 7 + 0) - first_weekday + 1
                if first_day_num < 1:
                    pm = month - 1 if month > 1 else 12
                    py = year if month > 1 else year - 1
                    pdays = calendar.monthrange(py, pm)[1]
                    first_date = date(py, pm, pdays + first_day_num)
                elif first_day_num > days_in_month:
                    nm = month + 1 if month < 12 else 1
                    ny = year if month < 12 else year + 1
                    first_date = date(ny, nm, first_day_num - days_in_month)
                else:
                    first_date = date(year, month, first_day_num)
                week_num = first_date.isocalendar()[1]
                wn_text = str(week_num)
                small_fs = font_size * 0.8
                pdf_canvas.setFont(font_name, small_fs)
                tx = cal_pos['x'] + (week_col_width - pdf_canvas.stringWidth(wn_text, font_name, small_fs)) / 2
                # Vertical center of the row
                row_mid_y = row_bottom_y + (cell_height / 2)
                ty = row_mid_y - (small_fs / 2)
                pdf_canvas.drawString(tx, ty, wn_text)
                pdf_canvas.setFont(font_name, font_size)
    
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
        
        # Calculate cell dimensions (7 columns for days of week), optional time gutter
        available_height = max(0.0, available_height)
        show_time_grid = bool(props.get('show_time_grid', False))
        show_time_gutter = bool(props.get('show_time_gutter', False))
        time_start_hour = int(props.get('time_start_hour', 8))
        time_end_hour = int(props.get('time_end_hour', 20))
        time_slot_minutes = int(props.get('time_slot_minutes', 60))
        time_label_interval = int(props.get('time_label_interval', 60))
        time_start_hour = max(0, min(23, time_start_hour))
        time_end_hour = max(time_start_hour + 1, min(24, time_end_hour))
        time_slot_minutes = max(5, min(120, time_slot_minutes))
        time_label_interval = max(time_slot_minutes, min(240, time_label_interval))
        gutter_width = (font_size * 2.2) if show_time_gutter else 0.0
        cell_width = (calendar_width - gutter_width) / 7
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
                weekday_x = cal_pos['x'] + gutter_width + (i * cell_width) + (cell_width / 2)
                # Center the text in the cell
                text_width = pdf_canvas.stringWidth(day_name, font_name, font_size * 0.8)
                weekday_x -= text_width / 2
                
                pdf_canvas.setFont(font_name, font_size * 0.8)
                pdf_canvas.drawString(weekday_x, weekday_y, day_name)
                pdf_canvas.setFont(font_name, font_size)  # Reset to normal size
        
        # Grid layout starting position
        grid_start_y = cal_pos['y'] + calendar_height - header_height - weekday_height
        
        # Draw weekly calendar grid
        cell_padding = float(props.get('cell_padding', 4.0))
        highlight_today = bool(props.get('highlight_today', False))
        highlight_date_str = props.get('highlight_date')
        for day_col in range(7):
            current_day = week_days[day_col]
            
            # Calculate cell position
            cell_x = cal_pos['x'] + gutter_width + (day_col * cell_width)
            cell_y = grid_start_y - cell_height
            
            # Draw cell border if grid lines enabled
            if show_grid_lines:
                stroke_width = self.enforcer.check_stroke_width(0.5)
                pdf_canvas.setLineWidth(stroke_width)
                pdf_canvas.rect(cell_x, cell_y, cell_width, cell_height, stroke=1, fill=0)

            # Time grid
            if show_time_grid:
                total_minutes = (time_end_hour - time_start_hour) * 60
                slots = int(total_minutes / time_slot_minutes)
                if slots > 0:
                    slot_height = cell_height / slots
                    stroke_width = self.enforcer.check_stroke_width(0.5)
                    pdf_canvas.setLineWidth(stroke_width)
                    for s in range(1, slots):
                        y = cell_y + s * slot_height
                        pdf_canvas.line(cell_x, y, cell_x + cell_width, y)

            # Day number at top-left with padding
            day_text = str(current_day.day)
            day_x = cell_x + cell_padding
            day_y = cell_y + cell_height - font_size - cell_padding
            pdf_canvas.drawString(day_x, day_y, day_text)

            # Link for day cell
            if link_strategy != 'no_links':
                self._create_calendar_date_link(
                    pdf_canvas, widget, current_day,
                    cell_x, cell_y, cell_width, cell_height,
                    link_strategy, props
                )

            # Highlight today
            try:
                target_highlight = None
                if highlight_date_str:
                    target_highlight = datetime.strptime(highlight_date_str, '%Y-%m-%d').date()
                elif highlight_today:
                    target_highlight = datetime.utcnow().date()
                if target_highlight and current_day == target_highlight:
                    stroke_width = self.enforcer.check_stroke_width(1.0)
                    pdf_canvas.setLineWidth(stroke_width)
                    pdf_canvas.rect(cell_x + 1.5, cell_y + 1.5, cell_width - 3, cell_height - 3, stroke=1, fill=0)
            except Exception:
                pass

        # Time gutter labels on the left
        if show_time_gutter and show_time_grid:
            total_minutes = (time_end_hour - time_start_hour) * 60
            slots = int(total_minutes / time_slot_minutes)
            if slots > 0:
                slot_height = cell_height / slots
                pdf_canvas.setFont(font_name, font_size * 0.75)
                for s in range(0, slots + 1):
                    minutes_from_start = s * time_slot_minutes
                    if minutes_from_start > total_minutes:
                        continue
                    if (minutes_from_start % time_label_interval) != 0:
                        continue
                    hour = time_start_hour + (minutes_from_start // 60)
                    minute = minutes_from_start % 60
                    label = f"{hour:02d}:{minute:02d}"
                    y = (grid_start_y - cell_height) + s * slot_height
                    tx = cal_pos['x'] + 2
                    ty = y - (font_size * 0.3)
                    pdf_canvas.drawString(tx, ty, label)
                pdf_canvas.setFont(font_name, font_size)

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
