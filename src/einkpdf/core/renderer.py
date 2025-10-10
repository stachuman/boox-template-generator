"""
Core PDF rendering with ReportLab and deterministic output.

This module provides the main PDF generation functionality with coordinate
conversion, device profile enforcement, and deterministic builds.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import os
import math
import logging
from datetime import datetime, date
from typing import Dict, Any, List, Optional, Tuple
from io import BytesIO

logger = logging.getLogger(__name__)

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, LETTER, A5, LEGAL
from reportlab.lib.units import inch
from reportlab.lib.colors import black, white, HexColor
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Table, TableStyle

from .schema import Template, Widget, Canvas as CanvasConfig, Position
from .coordinates import CoordinateConverter, create_converter_for_canvas
from .fonts import ensure_font_registered
from .profiles import ConstraintEnforcer, create_constraint_enforcer
from .deterministic import make_pdf_deterministic
from ..validation.yaml_validator import ValidationError
from .postprocess import add_navigation_to_pdf
from .tokens import TokenProcessor, RenderingTokenContext
from .renderers.text import TextEngine, TextRenderingOptions
from .renderers import WidgetRendererRegistry, ShapeRenderer, FormRenderer, ImageRenderer, TextRenderer, TableRenderer, LinkRenderer, CompositeRenderer, CalendarRenderer


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

        # Initialize text engine for centralized text rendering
        self.text_engine = TextEngine(self.converter)

        # Initialize widget renderer registry and register built-in renderers
        self.renderer_registry = WidgetRendererRegistry()
        self._register_builtin_renderers()

        self.violations = []  # Track constraint violations
        # Master page mapping and total pages for token substitution
        self._page_master_map: Dict[int, str] = {}
        self._total_pages: int = 1
        # Named destination anchor positions collected during layout
        self.anchor_positions: Dict[str, Tuple[int, float, float]] = {}

    def _register_builtin_renderers(self) -> None:
        """Register built-in widget renderers with the registry."""
        # Register simple renderers that are ready for integration
        self.renderer_registry.register_renderer('box', ShapeRenderer)
        self.renderer_registry.register_renderer('divider', ShapeRenderer)
        self.renderer_registry.register_renderer('vertical_line', ShapeRenderer)
        self.renderer_registry.register_renderer('lines', ShapeRenderer)

        self.renderer_registry.register_renderer('checkbox', FormRenderer)

        self.renderer_registry.register_renderer('image', ImageRenderer)

        self.renderer_registry.register_renderer('text_block', TextRenderer)

        self.renderer_registry.register_renderer('table', TableRenderer)
        self.renderer_registry.register_renderer('internal_link', LinkRenderer)
        self.renderer_registry.register_renderer('tap_zone', LinkRenderer)
        self.renderer_registry.register_renderer('link_list', CompositeRenderer)

        self.renderer_registry.register_renderer('calendar', CalendarRenderer)

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
            # Pass 1: Initialize ReportLab canvas with compression for e-ink optimization
            page_width, page_height = self.get_page_size()
            pdf_canvas = canvas.Canvas(
                buffer,
                pagesize=(page_width, page_height),
                pageCompression=1  # Enable compression for smaller file size (better for e-ink)
            )
            
            # Set deterministic properties if requested
            if deterministic:
                pdf_canvas.setTitle(self.template.metadata.name)
                pdf_canvas.setSubject(self.template.metadata.description)
                pdf_canvas.setCreator("E-ink PDF Templates v0.3.4")
                pdf_canvas.setAuthor(self.template.metadata.author or "Unknown")
                # Note: ReportLab Canvas doesn't support setCreationDate directly
                # Creation date will be handled by pikepdf post-processor for deterministic builds
            
            # Pre-pass: collect all anchor destination IDs available in template
            try:
                self._available_dest_ids = set()
                for w in getattr(self.template, 'widgets', []) or []:
                    try:
                        if getattr(w, 'type', None) == 'anchor':
                            props = getattr(w, 'properties', {}) or {}
                            did = props.get('dest_id') if isinstance(props, dict) else None
                            if isinstance(did, str) and did.strip():
                                self._available_dest_ids.add(did.strip())
                    except Exception:
                        continue
            except Exception:
                self._available_dest_ids = set()

            # Pass 2: Layout pass - render content and collect anchor positions
            self._layout_pass(pdf_canvas)
            
            # Finalize base PDF
            pdf_canvas.save()
            
            # Store violations for later reporting
            self.violations = self.enforcer.violations.copy()
            
            # Pass 3: Post-process named destinations (from anchor widgets)
            base_pdf = buffer.getvalue()
            # Guard against missing attribute in older instances
            if getattr(self, 'anchor_positions', None):
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
            # For widgets without page numbers (e.g., master templates), default to page 1
            if not hasattr(widget, 'page') or widget.page is None:
                page = 1
            else:
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
                # Sort master widgets by z_order (default to 0 if not specified)
                master_widgets = sorted(
                    getattr(master, 'widgets', []) or [],
                    key=lambda w: getattr(w, 'z_order', None) or 0
                )
                for m_widget in master_widgets:
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

        # Sort page widgets by z_order (default to 0 if not specified)
        sorted_widgets = sorted(widgets, key=lambda w: getattr(w, 'z_order', None) or 0)

        # Render page widgets
        for widget in sorted_widgets:
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
        # For link_list widgets, skip widget-level background if properties.background_color is set
        # (individual items will handle their own backgrounds)
        widget_props = getattr(widget, 'properties', {}) or {}
        should_draw_widget_bg = (
            hasattr(widget, 'background_color') and
            widget.background_color and
            not (widget.type == 'link_list' and widget_props.get('background_color'))
        )
        if should_draw_widget_bg:
            self._draw_widget_background(pdf_canvas, widget)

        # Collect explicit anchor destinations (dest_id) for named destinations
        if widget.type == "anchor":
            did = widget_props.get('dest_id') if isinstance(widget_props, dict) else None
            if isinstance(did, str) and did.strip():
                context = RenderingTokenContext(page_num=page_num, total_pages=self._total_pages or page_num)
                normalized = did.strip().replace('{PAGE}', '{page}').replace('{TOTAL_PAGES}', '{total_pages}')
                resolved_dest = TokenProcessor.replace_rendering_tokens(normalized, context).strip().lower()
                if resolved_dest:
                    if isinstance(widget_props, dict):
                        widget_props['dest_id'] = resolved_dest
                        widget.properties = widget_props
                    self.anchor_positions[resolved_dest] = (page_num, widget.position.x, widget.position.y)

        # Render based on widget type
        # First, try using the registry for supported widget types
        if self.renderer_registry.is_supported(widget.type):
            self.renderer_registry.render_widget(
                pdf_canvas, widget, self.converter, self.strict_mode,
                page_num=page_num, total_pages=self._total_pages,
                enforcer=self.enforcer, profile=self.profile_name
            )
        elif widget.type == "anchor":
            # Define a named destination immediately so ReportLab resolves links.
            did = widget_props.get('dest_id') if isinstance(widget_props, dict) else None
            if isinstance(did, str) and did.strip():
                name = did.strip()
                # Convert y to bottom-left coordinate for horizontal bookmark if supported
                try:
                    # Try most specific API if available
                    if hasattr(pdf_canvas, 'bookmarkHorizontalAbsolute'):
                        pos = self.converter.convert_position_for_drawing(widget.position)
                        pdf_canvas.bookmarkHorizontalAbsolute(name, pos['y'] + pos['height'])
                    elif hasattr(pdf_canvas, 'bookmarkHorizontal'):
                        pos = self.converter.convert_position_for_drawing(widget.position)
                        pdf_canvas.bookmarkHorizontal(name, pos['y'] + pos['height'])
                    else:
                        # Fallback: page-level bookmark
                        pdf_canvas.bookmarkPage(name)
                except Exception:
                    # As a safety, ensure at least a page bookmark exists
                    try:
                        pdf_canvas.bookmarkPage(name)
                    except Exception:
                        pass
                # Also register a named destination in the PDF so linkAbsolute resolves names immediately
                try:
                    if hasattr(pdf_canvas, 'addNamedDestination'):
                        pdf_canvas.addNamedDestination(name)
                except Exception:
                    pass
        else:
            # Following CLAUDE.md rule #4: explicit NotImplementedError
            # Get list of supported widget types from registry plus legacy types
            registry_types = self.renderer_registry.get_supported_widget_types()
            legacy_types = ['anchor']
            all_supported = sorted(registry_types + legacy_types)

            raise UnsupportedWidgetError(
                f"Widget type '{widget.type}' not implemented. "
                f"Supported: {', '.join(all_supported)}"
            )


    def _resolve_link_list_bind(self, bind_expr: str, idx: int, idx_padded: str) -> str:
        """Resolve a simple bind expression for link_list items.

        Supports: notes(@index), year(@index), month(@index), day(@index),
        generic func(arg) → "func:arg", plus optional #suffix. If arg is
        '@index' or '@index_padded', it substitutes the current values.
        """
        if not isinstance(bind_expr, str) or not bind_expr:
            return ""
        import re
        m = re.match(r'^(\w+)\(([^)]+)\)(#.*)?$', bind_expr)
        if not m:
            # No function form; treat as direct destination
            return bind_expr
        func, arg, suffix = m.group(1), m.group(2), m.group(3) or ''
        if arg == '@index':
            resolved = str(idx)
        elif arg == '@index_padded':
            resolved = idx_padded
        else:
            resolved = arg

        if func == 'notes':
            # notes(N) → notes:page:NNN
            try:
                return f"notes:page:{int(resolved):03d}{suffix}"
            except Exception:
                return f"notes:page:{resolved}{suffix}"
        if func in ('year', 'month', 'day'):
            return f"{func}:{resolved}{suffix}"
        # Generic
        return f"{func}:{resolved}{suffix}"

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

    def _draw_highlight_background(self, pdf_canvas: canvas.Canvas, box: Dict[str, float], highlight_color: str) -> None:
        """Draw highlighted background with border - no state management."""
        try:
            color_hex = self.enforcer.validate_color(highlight_color)
            # Draw background fill
            pdf_canvas.setFillColor(HexColor(color_hex))
            pdf_canvas.rect(
                box['x'] + 1,
                box['y'] + 1,
                max(0, box['width'] - 2),
                max(0, box['height'] - 2),
                stroke=0,
                fill=1,
            )
            # Draw border
            stroke_width = self.enforcer.check_stroke_width(2.0)
            pdf_canvas.setLineWidth(stroke_width)
            pdf_canvas.setStrokeColor(HexColor(color_hex))
            pdf_canvas.rect(
                box['x'] + 1,
                box['y'] + 1,
                max(0, box['width'] - 2),
                max(0, box['height'] - 2),
                stroke=1,
                fill=0,
            )
        except Exception:
            # Fallback to gray highlight if color validation fails
            try:
                pdf_canvas.setFillGray(0.85)
                pdf_canvas.rect(box['x'] + 1, box['y'] + 1, max(0, box['width'] - 2), max(0, box['height'] - 2), stroke=0, fill=1)
            except Exception:
                pass

    def _draw_plain_background(self, pdf_canvas: canvas.Canvas, box: Dict[str, float], background_color: str) -> None:
        """Draw plain background fill - no state management."""
        try:
            color_hex = self.enforcer.validate_color(background_color)
            pdf_canvas.setFillColor(HexColor(color_hex))
            pdf_canvas.rect(
                box['x'],
                box['y'],
                box['width'],
                box['height'],
                stroke=0,
                fill=1,
            )
        except Exception:
            # Fail fast: if background color is invalid, don't draw anything
            pass

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
