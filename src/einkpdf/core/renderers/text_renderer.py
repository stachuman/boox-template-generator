"""
Text widget renderer for e-ink PDF templates.

Handles rendering of text_block widgets with token processing,
multi-line layout, and TextEngine integration.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import logging
from reportlab.pdfgen import canvas

from ..schema import Widget
from .base import BaseWidgetRenderer, RenderingError
from .text import TextEngine
from .text.text_formatter import TextFormatter
from ..tokens import TokenProcessor, RenderingTokenContext

logger = logging.getLogger(__name__)


class TextRenderer(BaseWidgetRenderer):
    """
    Renderer for text block widgets.

    Handles: text_block
    Features: Token processing, multi-line layout, orientation support
    Following CLAUDE.md rule #1: No dummy implementations - complete functionality.
    """

    def __init__(self, converter, strict_mode: bool = False):
        """Initialize text renderer with text engine."""
        super().__init__(converter, strict_mode)
        self.text_engine = TextEngine(converter)

    @property
    def supported_widget_types(self) -> list[str]:
        return ['text_block']

    def render(self, pdf_canvas: canvas.Canvas, widget: Widget, **kwargs) -> None:
        """Render text widget based on its type."""
        self.validate_widget(widget)

        if widget.type == 'text_block':
            # Extract context from kwargs for token processing and constraints
            page_num = kwargs.get('page_num', 1)
            total_pages = kwargs.get('total_pages', 1)
            enforcer = kwargs.get('enforcer')
            self._render_text_block(pdf_canvas, widget, page_num, total_pages, enforcer)
        else:
            raise RenderingError(f"Unsupported widget type: {widget.type}")

    def _render_text_block(self, pdf_canvas: canvas.Canvas, widget: Widget,
                          page_num: int, total_pages: int, enforcer=None) -> None:
        """Render text block widget using TextEngine with token processing and word wrapping."""
        if not widget.content:
            return  # Skip empty text blocks

        # Get styling and properties
        styling = getattr(widget, 'styling', {}) or {}
        props = getattr(widget, 'properties', {}) or {}

        # Token substitution for dynamic fields
        content_text = widget.content
        try:
            render_context = RenderingTokenContext(
                page_num=page_num,
                total_pages=total_pages
            )
            content_text = TokenProcessor.replace_rendering_tokens(content_text, render_context)
        except Exception as e:
            if self.strict_mode:
                raise RenderingError(f"Text widget '{widget.id}': token processing failed: {e}") from e
            logger.warning(f"Token processing failed for text widget {widget.id}: {e}")

        # Apply constraints to styling before creating options
        constrained_styling = self._apply_styling_constraints(styling, enforcer)

        # Set orientation from properties
        orientation = props.get('orientation', 'horizontal')
        constrained_styling['orientation'] = orientation

        # Create text rendering options
        text_options = self.text_engine.create_text_options(constrained_styling)

        # Get bounding box for text positioning
        box = self.converter.convert_position_for_drawing(widget.position)

        # Split text into lines and apply word wrapping
        raw_lines = str(content_text).splitlines() if isinstance(content_text, str) else [str(content_text)]

        # Apply word wrapping to each line based on box width
        wrapped_lines = []
        for line in raw_lines:
            if not line.strip():
                # Preserve empty lines
                wrapped_lines.append('')
            else:
                # Wrap line to fit within box width
                # For vertical text, use height as wrapping constraint
                wrap_width = box['height'] if orientation == 'vertical' else box['width']
                line_wrapped = TextFormatter.wrap_text(
                    line, wrap_width, text_options.font_name,
                    text_options.font_size, pdf_canvas
                )
                wrapped_lines.extend(line_wrapped if line_wrapped else [''])

        if len(wrapped_lines) <= 1:
            # Single line text - use TextEngine directly
            self.text_engine.render_text(pdf_canvas, box, wrapped_lines[0] if wrapped_lines else '', text_options)
        else:
            # Multi-line text - render each line
            self._render_multi_line_text(pdf_canvas, box, wrapped_lines, text_options, constrained_styling)

    def _apply_styling_constraints(self, styling: dict, enforcer=None) -> dict:
        """Apply device profile constraints to styling parameters."""
        constrained_styling = styling.copy()

        # Apply font size constraints
        if 'size' in constrained_styling or 'font_size' in constrained_styling:
            raw_font_size = (
                constrained_styling.get('size')
                if constrained_styling.get('size') is not None
                else constrained_styling.get('font_size', 12.0)
            )

            try:
                font_size = float(raw_font_size)
            except (TypeError, ValueError):
                font_size = 12.0

            if enforcer:
                constrained_styling['font_size'] = enforcer.check_font_size(font_size)
            else:
                # Fallback to reasonable defaults if no enforcer available
                constrained_styling['font_size'] = max(8.0, min(72.0, font_size))

        # Apply color constraints
        if 'color' in constrained_styling:
            color = constrained_styling.get('color')
            if enforcer:
                constrained_styling['color'] = enforcer.validate_color(color)
            else:
                # Fallback validation - basic hex format
                if isinstance(color, str) and color.startswith('#') and len(color) == 7:
                    constrained_styling['color'] = color
                elif isinstance(color, str) and color.lower() in ['none', 'transparent']:
                    constrained_styling['color'] = color
                else:
                    constrained_styling['color'] = '#000000'

        return constrained_styling

    def _render_multi_line_text(self, pdf_canvas: canvas.Canvas, box: dict,
                               lines: list[str], text_options, styling: dict) -> None:
        """Render multi-line text using TextFormatter for layout."""
        # Get line spacing configuration
        line_spacing = styling.get('line_height', 1.2)
        try:
            line_spacing = max(0.8, float(line_spacing))
        except Exception:
            line_spacing = 1.2

        # Calculate line layout using TextFormatter
        text_boxes = TextFormatter.calculate_multi_line_layout(
            lines, box, text_options.font_size, line_spacing, 'center'
        )

        # Render each line with TextEngine
        for text_box in text_boxes:
            line_box = {
                'x': text_box.x,
                'y': text_box.y,
                'width': text_box.width,
                'height': text_box.height
            }
            self.text_engine.render_text(pdf_canvas, line_box, text_box.text, text_options)

    def validate_text_properties(self, widget: Widget) -> None:
        """
        Validate text widget properties.

        Args:
            widget: Widget to validate

        Raises:
            RenderingError: If properties are invalid
        """
        if not widget.content:
            if self.strict_mode:
                raise RenderingError(f"Text widget '{widget.id}': missing content")
            return

        if not isinstance(widget.content, str):
            raise RenderingError(f"Text widget '{widget.id}': content must be a string")

        # Validate styling parameters
        styling = getattr(widget, 'styling', {}) or {}

        if 'size' in styling or 'font_size' in styling:
            font_size = styling.get('size') or styling.get('font_size')
            try:
                font_size = float(font_size)
                if font_size <= 0:
                    raise RenderingError(f"Text widget '{widget.id}': font size must be positive")
            except (ValueError, TypeError):
                raise RenderingError(f"Text widget '{widget.id}': invalid font size")

        # Validate orientation
        props = getattr(widget, 'properties', {}) or {}
        orientation = props.get('orientation', 'horizontal')
        valid_orientations = ['horizontal', 'vertical']
        if orientation not in valid_orientations:
            raise RenderingError(
                f"Text widget '{widget.id}': invalid orientation '{orientation}'. "
                f"Valid orientations: {valid_orientations}"
            )
