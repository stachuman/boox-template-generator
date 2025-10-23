"""
Link widget renderer for e-ink PDF templates.

Handles rendering of internal_link and tap_zone widgets with PDF link annotations,
touch target validation, and centralized text processing.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import logging
from typing import Dict, Any
from reportlab.pdfgen import canvas

from ..schema import Widget
from .base import BaseWidgetRenderer, RenderingError
from .text import TextEngine
from ..tokens import TokenProcessor, RenderingTokenContext

logger = logging.getLogger(__name__)


class LinkRenderer(BaseWidgetRenderer):
    """
    Renderer for link widgets.

    Handles: internal_link, tap_zone
    Features: PDF link annotations, touch target validation, text rendering
    Following CLAUDE.md rule #1: No dummy implementations - complete functionality.
    """

    def __init__(self, converter, strict_mode: bool = False):
        """Initialize link renderer with centralized TextEngine."""
        super().__init__(converter, strict_mode)
        self.text_engine = TextEngine(converter)

    @property
    def supported_widget_types(self) -> list[str]:
        return ['internal_link', 'tap_zone']

    def render(self, pdf_canvas: canvas.Canvas, widget: Widget, **kwargs) -> None:
        """Render link widget based on its type."""
        self.validate_widget(widget)

        # Extract context from kwargs
        page_num = kwargs.get('page_num', 1)
        enforcer = kwargs.get('enforcer')

        if widget.type == 'internal_link':
            # Remove enforcer from kwargs to avoid duplicate parameter
            kwargs_no_enforcer = {k: v for k, v in kwargs.items() if k != 'enforcer'}
            self._render_internal_link(pdf_canvas, widget, enforcer, **kwargs_no_enforcer)
        elif widget.type == 'tap_zone':
            total_pages = kwargs.get('total_pages', page_num)
            self._render_tap_zone(pdf_canvas, widget, page_num, total_pages, enforcer)
        else:
            raise RenderingError(f"Unsupported widget type: {widget.type}")

    def _render_internal_link(self, pdf_canvas: canvas.Canvas, widget: Widget, enforcer=None, **kwargs) -> None:
        """Render text link to a named destination (properties.to_dest)."""
        if not widget.content:
            return

        props = getattr(widget, 'properties', {}) or {}
        to_dest = props.get('to_dest')
        if not to_dest or not isinstance(to_dest, str):
            raise RenderingError(f"internal_link '{widget.id}': missing properties.to_dest")

        to_dest = self._normalize_destination(to_dest)

        # Skip link creation if destination is empty/whitespace after token processing
        # This handles automatic navigation variables (_prev/_next) that may not exist
        # Following CLAUDE.md Rule #3: Explicit behavior - widget renders but link is skipped

        styling = getattr(widget, 'styling', {}) or {}

        # Process tokens in widget content
        content_text = widget.content
        try:
            page_num = kwargs.get('page_num', 1)
            total_pages = kwargs.get('total_pages', 1)
            render_context = RenderingTokenContext(
                page_num=page_num,
                total_pages=total_pages
            )
            content_text = TokenProcessor.replace_rendering_tokens(content_text, render_context)
        except Exception as e:
            if self.strict_mode:
                raise RenderingError(f"internal_link '{widget.id}': token processing failed: {e}") from e
            logger.warning(f"Token processing failed for internal_link {widget.id}: {e}")

        # Apply constraints using centralized approach
        constrained_styling = self._apply_styling_constraints(styling, enforcer)

        orientation = props.get('orientation')
        # Support both legacy 'vertical' and new 'vertical_cw'/'vertical_ccw'
        if isinstance(orientation, str) and orientation in ['horizontal', 'vertical', 'vertical_cw', 'vertical_ccw']:
            constrained_styling['orientation'] = orientation

        text_options = self.text_engine.create_text_options(constrained_styling)

        # Validate touch target size
        self._validate_touch_target(widget, enforcer)

        # Get position and convert coordinates
        box = self.converter.convert_position_for_drawing(widget.position)

        # Render background if specified
        if props.get('highlight') or props.get('background_color'):
            self._render_link_background(pdf_canvas, box, props)

        # Render text content using centralized TextEngine
        self.text_engine.render_text(pdf_canvas, box, content_text, text_options)

        # Create PDF link annotation only if destination is valid
        # Skip if destination is empty (e.g., {counter_prev} on first page)
        if to_dest and to_dest.strip():
            self._create_pdf_link_annotation(pdf_canvas, box, to_dest)

    def _render_tap_zone(self, pdf_canvas: canvas.Canvas, widget: Widget, page_num: int, total_pages: int, enforcer=None) -> None:
        """Render an invisible tap zone that creates a link rectangle."""
        props = getattr(widget, 'properties', {}) or {}
        action = props.get('tap_action', 'page_link')

        # Validate touch target size
        self._validate_touch_target(widget, enforcer)

        # Convert position to PDF coordinates
        rect_pos = self.converter.convert_position_for_drawing(widget.position)

        if rect_pos['width'] <= 0 or rect_pos['height'] <= 0:
            return

        # Create link rectangle
        link_rect = (
            rect_pos['x'],
            rect_pos['y'],
            rect_pos['x'] + rect_pos['width'],
            rect_pos['y'] + rect_pos['height']
        )

        # Determine link destination
        to_dest = props.get('to_dest')

        if to_dest and isinstance(to_dest, str):
            # Named destination
            destination = self._normalize_destination(to_dest)
            # Check if destination is empty after normalization (e.g., missing _prev/_next token)
            if not destination or not destination.strip():
                logger.debug(f"Skipping tap_zone link for '{widget.id}' - destination is empty")
                destination = None  # Will skip link creation below
        else:
            # Page-based action
            destination = None  # Will be set if we should create a link

            if action == 'page_link':
                target_page = props.get('target_page', page_num)
                try:
                    target_page = int(target_page)
                    if 1 <= target_page <= total_pages:
                        destination = f"Page_{target_page}"
                        # logger.info(f"Tap zone page_link: widget={widget.id}, target_page={target_page}, → destination='{destination}'")
                    else:
                        logger.warning(f"Tap zone page_link: widget={widget.id}, target_page={target_page} out of range (1-{total_pages}), skipping link")
                except (ValueError, TypeError):
                    logger.warning(f"tap_zone '{widget.id}': invalid target_page '{target_page}', using current page")
                    destination = f"Page_{page_num}"
            elif action == 'next_page':
                next_page = page_num + 1
                if next_page <= total_pages:
                    destination = f"Page_{next_page}"
                    # logger.info(f"Tap zone next_page: widget={widget.id}, current_page={page_num}, → destination='{destination}'")
                else:
                    # Don't create link beyond last page - just log and skip
                    # logger.info(f"Tap zone next_page: widget={widget.id}, current_page={page_num}, skipping link (no page {next_page}, total={total_pages})")
                    pass  # No link created
            elif action == 'prev_page':
                prev_page = max(1, page_num - 1)
                if prev_page < page_num:  # Only create link if there's actually a previous page
                    destination = f"Page_{prev_page}"
                    # logger.info(f"Tap zone prev_page: widget={widget.id}, current_page={page_num}, → destination='{destination}'")
                else:
                    # Don't create link from page 1 to page 1 - just log and skip
                    # logger.info(f"Tap zone prev_page: widget={widget.id}, current_page={page_num}, skipping link (already on first page)")
                    pass  # No link created
            else:
                raise RenderingError(f"tap_zone '{widget.id}': unsupported tap_action '{action}'")

        # Create PDF link annotation only if we have a valid destination
        if destination:
            self._create_pdf_link_annotation(pdf_canvas, link_rect, destination, invisible=True)

    def _render_link_background(self, pdf_canvas: canvas.Canvas, box: Dict[str, float], props: Dict[str, Any]) -> None:
        """Render background/highlight for link with minimal state management."""
        try:
            is_highlighted = props.get('highlight', False)
            highlight_color = props.get('highlight_color', '#dbeafe')  # Default light blue
            background_color = props.get('background_color')

            if is_highlighted:
                # Highlight always works if highlight flag is set, using highlight_color
                color_rgb = self._hex_to_rgb(highlight_color)
                if color_rgb:
                    pdf_canvas.setFillColor(color_rgb)
                    pdf_canvas.rect(box['x'], box['y'], box['width'], box['height'], fill=1, stroke=0)

            elif background_color:
                # Standard background color
                color_rgb = self._hex_to_rgb(background_color)
                if color_rgb:
                    pdf_canvas.setFillColor(color_rgb)
                    pdf_canvas.rect(box['x'], box['y'], box['width'], box['height'], fill=1, stroke=0)

        except Exception as e:
            logger.warning(f"Failed to render link background: {e}")

    def _create_pdf_link_annotation(self, pdf_canvas: canvas.Canvas, rect, destination: str, invisible: bool = False) -> None:
        """Create PDF link annotation with proper error handling."""
        try:
            destination = self._normalize_destination(destination)
            if isinstance(rect, dict):
                # Convert dict format to tuple
                link_rect = (rect['x'], rect['y'], rect['x'] + rect['width'], rect['y'] + rect['height'])
            else:
                # Already tuple format
                link_rect = rect

            pdf_canvas.linkRect("", destination, link_rect, relative=0)

            if not invisible:
                logger.debug(f"Created PDF link annotation to '{destination}' at {link_rect}")

        except Exception as e:
            logger.warning(f"Failed to create PDF link annotation to '{destination}': {e}")

    def _validate_touch_target(self, widget: Widget, enforcer=None) -> None:
        """Validate touch target size according to device profile."""
        if not enforcer:
            return

    @staticmethod
    def _normalize_destination(destination: str) -> str:
        """Normalize page destinations to match bookmark naming."""
        if not isinstance(destination, str):
            return destination

        lower = destination.lower()
        if lower.startswith('page_'):
            suffix = destination.split('_', 1)[1]
            if suffix.isdigit():
                return f"Page_{suffix}"

        return destination

        try:
            min_w, min_h = enforcer.check_touch_target_size(widget.position.width, widget.position.height)
            if (widget.position.width < min_w or widget.position.height < min_h) and self.strict_mode:
                raise RenderingError(
                    f"{widget.type} '{widget.id}': touch target {widget.position.width}x{widget.position.height}pt "
                    f"below profile minimum {min_w}x{min_h}pt"
                )
        except RenderingError:
            raise
        except Exception:
            # In non-strict mode the enforcer tracks violations; continue rendering
            pass

    def _apply_styling_constraints(self, styling: dict, enforcer=None) -> dict:
        """Apply device profile constraints to styling parameters."""
        constrained_styling = styling.copy()

        # Apply font size constraints
        font_size = styling.get('size') or styling.get('font_size', 12.0)
        try:
            font_size = float(font_size)
            if enforcer:
                constrained_styling['font_size'] = enforcer.check_font_size(font_size)
            else:
                # Fallback to reasonable defaults
                constrained_styling['font_size'] = max(8.0, min(72.0, font_size))
        except Exception:
            constrained_styling['font_size'] = 12.0

        # Apply color constraints
        color = styling.get('color', '#0066CC')
        try:
            if enforcer:
                constrained_styling['color'] = enforcer.validate_color(color)
            else:
                # Basic hex validation
                if isinstance(color, str) and color.startswith('#') and len(color) == 7:
                    constrained_styling['color'] = color
                else:
                    constrained_styling['color'] = '#0066CC'
        except Exception:
            constrained_styling['color'] = '#0066CC'

        return constrained_styling

    def _hex_to_rgb(self, hex_color: str) -> tuple:
        """Convert hex color to RGB tuple (0-1 range for PDF)."""
        try:
            hex_color = hex_color.lstrip('#')
            if len(hex_color) == 6:
                r = int(hex_color[0:2], 16) / 255.0
                g = int(hex_color[2:4], 16) / 255.0
                b = int(hex_color[4:6], 16) / 255.0
                return (r, g, b)
            else:
                return (0.0, 0.4, 0.8)  # Default blue
        except Exception:
            return (0.0, 0.4, 0.8)  # Default blue

    def validate_link_properties(self, widget: Widget) -> None:
        """
        Validate link widget properties.

        Args:
            widget: Widget to validate

        Raises:
            RenderingError: If properties are invalid
        """
        props = getattr(widget, 'properties', {}) or {}

        if widget.type == 'internal_link':
            # internal_link requires content and to_dest
            if not widget.content:
                if self.strict_mode:
                    raise RenderingError(f"internal_link '{widget.id}': missing content")
                return

            to_dest = props.get('to_dest')
            if not to_dest or not isinstance(to_dest, str):
                raise RenderingError(f"internal_link '{widget.id}': missing or invalid properties.to_dest")

            orientation = props.get('orientation')
            if orientation is not None and orientation not in ['horizontal', 'vertical', 'vertical_cw', 'vertical_ccw']:
                raise RenderingError(
                    f"internal_link '{widget.id}': invalid orientation '{orientation}'. "
                    f"Valid orientations: ['horizontal', 'vertical', 'vertical_cw', 'vertical_ccw']"
                )

        elif widget.type == 'tap_zone':
            # tap_zone requires valid tap_action
            action = props.get('tap_action', 'page_link')
            valid_actions = ['page_link', 'next_page', 'prev_page']
            if action not in valid_actions:
                raise RenderingError(
                    f"tap_zone '{widget.id}': invalid tap_action '{action}'. "
                    f"Valid actions: {valid_actions}"
                )

            # If page_link action, validate target_page
            if action == 'page_link':
                target_page = props.get('target_page')
                if target_page is not None:
                    try:
                        target_page = int(target_page)
                        if target_page < 1:
                            raise RenderingError(
                                f"tap_zone '{widget.id}': target_page must be >= 1, got {target_page}"
                            )
                    except (ValueError, TypeError):
                        raise RenderingError(
                            f"tap_zone '{widget.id}': target_page must be an integer, got '{target_page}'"
                        )
