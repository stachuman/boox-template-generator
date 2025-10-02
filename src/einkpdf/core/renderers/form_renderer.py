"""
Form widget renderers (checkbox).

Handles rendering of form input elements.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import logging
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

from ..schema import Widget
from .base import BaseWidgetRenderer, RenderingUtils, RenderingError
from .text import TextEngine, TextRenderingOptions

logger = logging.getLogger(__name__)


class FormRenderer(BaseWidgetRenderer):
    """
    Renderer for form input widgets.

    Handles: checkbox
    Following CLAUDE.md rule #1: No dummy implementations - complete functionality.
    """

    def __init__(self, converter, strict_mode: bool = False):
        """Initialize form renderer with text engine."""
        super().__init__(converter, strict_mode)
        self.text_engine = TextEngine(converter)

    @property
    def supported_widget_types(self) -> list[str]:
        return ['checkbox']

    def render(self, pdf_canvas: canvas.Canvas, widget: Widget, **kwargs) -> None:
        """Render form widget based on its type."""
        self.validate_widget(widget)

        if widget.type == 'checkbox':
            self._render_checkbox(pdf_canvas, widget)
        else:
            raise RenderingError(f"Unsupported widget type: {widget.type}")

    def _render_checkbox(self, pdf_canvas: canvas.Canvas, widget: Widget) -> None:
        """Render a checkbox with optional label."""
        props = getattr(widget, 'properties', {}) or {}
        styling = getattr(widget, 'styling', {}) or {}

        # Get checkbox properties
        checked = props.get('checked', False)
        # label = props.get('label', '')
        content_text = widget.content

        # Get styling
        stroke_color = RenderingUtils.validate_styling_color(
            styling.get('stroke_color', '#000000')
        )
        fill_color = RenderingUtils.validate_styling_color(
            styling.get('fill_color', '#FFFFFF')
        )
        check_color = RenderingUtils.validate_styling_color(
            styling.get('check_color', '#000000')
        )

        # Get dimensions
        box_size = RenderingUtils.get_safe_float(props.get('box_size'), 12.0, 4.0, 50.0)
        line_width = RenderingUtils.get_safe_float(
            styling.get('line_width'), 1.0, 0.1, 5.0
        )

        # Get position and convert coordinates
        pos = widget.position
        widget_box = self.converter.convert_position_for_drawing(pos)

        try:
            # Calculate checkbox position (left side of widget)
            checkbox_x = widget_box['x']
            checkbox_y = widget_box['y'] + (widget_box['height'] - box_size) / 2

            # Draw checkbox background
            if fill_color and fill_color.lower() not in ['none', 'transparent']:
                pdf_canvas.setFillColor(HexColor(fill_color))
                pdf_canvas.rect(checkbox_x, checkbox_y, box_size, box_size, stroke=0, fill=1)

            # Draw checkbox border
            pdf_canvas.setStrokeColor(HexColor(stroke_color))
            pdf_canvas.setLineWidth(line_width)
            pdf_canvas.rect(checkbox_x, checkbox_y, box_size, box_size, stroke=1, fill=0)

            # Draw check mark if checked
            if checked:
                self._draw_check_mark(pdf_canvas, checkbox_x, checkbox_y, box_size, check_color)

            # Draw label if provided
            if content_text:
                self._draw_checkbox_label(
                    pdf_canvas, widget, content_text, checkbox_x + box_size + 4,
                    checkbox_y, widget_box, styling
                )

        except Exception as e:
            if self.strict_mode:
                raise RenderingError(f"Failed to render checkbox widget '{widget.id}': {e}") from e
            logger.warning(f"Checkbox rendering failed for widget {widget.id}: {e}")

    def _draw_check_mark(self, pdf_canvas: canvas.Canvas, x: float, y: float,
                        size: float, color: str) -> None:
        """Draw a check mark inside the checkbox."""
        try:
            pdf_canvas.setStrokeColor(HexColor(color))
            pdf_canvas.setLineWidth(2.0)

            # Draw check mark as two lines
            margin = size * 0.2
            mid_x = x + size * 0.4
            mid_y = y + size * 0.3

            # First line: bottom-left to middle
            pdf_canvas.line(
                x + margin, y + size * 0.5,
                mid_x, mid_y
            )

            # Second line: middle to top-right
            pdf_canvas.line(
                mid_x, mid_y,
                x + size - margin, y + size - margin
            )

        except Exception as e:
            logger.warning(f"Failed to draw check mark: {e}")

    def _draw_checkbox_label(self, pdf_canvas: canvas.Canvas, widget: Widget, label: str,
                           start_x: float, checkbox_y: float, widget_box: dict,
                           styling: dict) -> None:
        """Draw label text next to checkbox using TextEngine."""
        try:
            # Create text rendering options from styling
            text_options = self.text_engine.create_text_options(styling)

            # Calculate text box for label positioning
            label_box = {
                'x': start_x,
                'y': checkbox_y,
                'width': widget_box['width'] - (start_x - widget_box['x']),
                'height': widget_box['height']
            }

            # Use TextEngine for consistent text rendering
            self.text_engine.render_text(pdf_canvas, label_box, label, text_options)

        except Exception as e:
            logger.warning(f"Failed to draw checkbox label: {e}")