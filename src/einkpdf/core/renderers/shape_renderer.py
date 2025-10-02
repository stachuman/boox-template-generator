"""
Shape widget renderers (box, divider, vertical_line, lines).

Handles rendering of basic geometric shapes and lines.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import logging
from typing import Dict, Any
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

from ..schema import Widget
from .base import BaseWidgetRenderer, RenderingUtils, RenderingError

logger = logging.getLogger(__name__)


class ShapeRenderer(BaseWidgetRenderer):
    """
    Renderer for basic shape widgets.

    Handles: box, divider, vertical_line, lines
    Following CLAUDE.md rule #1: No dummy implementations - complete functionality.
    """

    @property
    def supported_widget_types(self) -> list[str]:
        return ['box', 'divider', 'vertical_line', 'lines']

    def render(self, pdf_canvas: canvas.Canvas, widget: Widget, **kwargs) -> None:
        """Render shape widget based on its type."""
        self.validate_widget(widget)

        if widget.type == 'box':
            self._render_box(pdf_canvas, widget)
        elif widget.type == 'divider':
            self._render_divider(pdf_canvas, widget)
        elif widget.type == 'vertical_line':
            self._render_vertical_line(pdf_canvas, widget)
        elif widget.type == 'lines':
            self._render_lines(pdf_canvas, widget)
        else:
            raise RenderingError(f"Unsupported widget type: {widget.type}")

    def _render_box(self, pdf_canvas: canvas.Canvas, widget: Widget) -> None:
        """Render a rectangular box with optional styling."""
        props = getattr(widget, 'properties', {}) or {}
        opacity = RenderingUtils.get_safe_float(props.get('opacity'), 1.0, 0.0, 1.0)

        self._render_box_core(pdf_canvas, widget, opacity)

    def _render_box_core(self, pdf_canvas: canvas.Canvas, widget: Widget, opacity: float) -> None:
        """Core box rendering with opacity support."""
        styling = getattr(widget, 'styling', {}) or {}
        properties = getattr(widget, 'properties', {}) or {}

        # Get colors with validation
        stroke_color = RenderingUtils.validate_styling_color(
            styling.get('stroke_color', '#000000')
        )
        fill_color = RenderingUtils.validate_styling_color(
            styling.get('fill_color'), None
        )

        # Get position and convert coordinates
        pos = widget.position
        box = self.converter.convert_position_for_drawing(pos)

        # Get line width
        line_width = RenderingUtils.get_safe_float(
            styling.get('line_width'), 1.0, 0.0, 10.0
        )

        # Get corner radius with validation
        corner_radius = RenderingUtils.get_safe_float(
            properties.get('corner_radius'), 0.0, 0.0, 50.0
        )

        # Ensure corner radius doesn't exceed half of the smallest dimension
        max_radius = min(box['width'], box['height']) / 2.0
        corner_radius = min(corner_radius, max_radius)

        # Set opacity if less than 1.0
        if opacity < 1.0:
            # Create transparency group for proper opacity handling
            pdf_canvas.saveState()
            pdf_canvas.setFillAlpha(opacity)
            pdf_canvas.setStrokeAlpha(opacity)

        try:
            # Set stroke properties
            pdf_canvas.setStrokeColor(HexColor(stroke_color))
            pdf_canvas.setLineWidth(line_width)

            # Determine drawing mode
            stroke_mode = 1 if line_width > 0 else 0
            fill_mode = 0

            if fill_color and fill_color.lower() not in ['none', 'transparent']:
                pdf_canvas.setFillColor(HexColor(fill_color))
                fill_mode = 1

            # Draw rectangle (rounded if corner_radius > 0)
            if corner_radius > 0:
                pdf_canvas.roundRect(
                    box['x'], box['y'], box['width'], box['height'], corner_radius,
                    stroke=stroke_mode, fill=fill_mode
                )
            else:
                pdf_canvas.rect(
                    box['x'], box['y'], box['width'], box['height'],
                    stroke=stroke_mode, fill=fill_mode
                )

        except Exception as e:
            if self.strict_mode:
                raise RenderingError(f"Failed to render box widget '{widget.id}': {e}") from e
            logger.warning(f"Box rendering failed for widget {widget.id}: {e}")

        finally:
            if opacity < 1.0:
                pdf_canvas.restoreState()

    def _render_divider(self, pdf_canvas: canvas.Canvas, widget: Widget) -> None:
        """Render a horizontal divider line."""
        styling = getattr(widget, 'styling', {}) or {}

        # Get line properties
        color = RenderingUtils.validate_styling_color(
            styling.get('stroke_color', '#000000')
        )
        width = RenderingUtils.get_safe_float(
            styling.get('line_width'), 1.0, 0.0, 10.0
        )

        # Get position and convert coordinates
        pos = widget.position
        box = self.converter.convert_position_for_drawing(pos)

        try:
            pdf_canvas.setStrokeColor(HexColor(color))
            pdf_canvas.setLineWidth(width)

            # Draw horizontal line across the widget width
            y_center = box['y'] + box['height'] / 2
            pdf_canvas.line(box['x'], y_center, box['x'] + box['width'], y_center)

        except Exception as e:
            if self.strict_mode:
                raise RenderingError(f"Failed to render divider widget '{widget.id}': {e}") from e
            logger.warning(f"Divider rendering failed for widget {widget.id}: {e}")

    def _render_vertical_line(self, pdf_canvas: canvas.Canvas, widget: Widget) -> None:
        """Render a vertical line."""
        styling = getattr(widget, 'styling', {}) or {}

        # Get line properties
        color = RenderingUtils.validate_styling_color(
            styling.get('stroke_color', '#000000')
        )
        width = RenderingUtils.get_safe_float(
            styling.get('line_width'), 1.0, 0.0, 10.0
        )

        # Get position and convert coordinates
        pos = widget.position
        box = self.converter.convert_position_for_drawing(pos)

        try:
            pdf_canvas.setStrokeColor(HexColor(color))
            pdf_canvas.setLineWidth(width)

            # Draw vertical line across the widget height
            x_center = box['x'] + box['width'] / 2
            pdf_canvas.line(x_center, box['y'], x_center, box['y'] + box['height'])

        except Exception as e:
            if self.strict_mode:
                raise RenderingError(f"Failed to render vertical_line widget '{widget.id}': {e}") from e
            logger.warning(f"Vertical line rendering failed for widget {widget.id}: {e}")

    def _render_lines(self, pdf_canvas: canvas.Canvas, widget: Widget) -> None:
        """Render lines - either ruled lines (spacing/count) or custom coordinates."""
        props = getattr(widget, 'properties', {}) or {}
        styling = getattr(widget, 'styling', {}) or {}

        # Check if this is ruled lines (with line_spacing/line_count) or custom lines (with lines array)
        if 'line_count' in props or 'line_spacing' in props:
            self._render_ruled_lines(pdf_canvas, widget, props, styling)
        else:
            self._render_custom_lines(pdf_canvas, widget, props, styling)

    def _render_ruled_lines(self, pdf_canvas: canvas.Canvas, widget: Widget,
                           props: Dict[str, Any], styling: Dict[str, Any]) -> None:
        """Render evenly-spaced ruled lines with support for columns, styles, and padding."""
        # Get line properties
        color = RenderingUtils.validate_styling_color(
            styling.get('stroke_color', '#000000')
        )
        line_thickness = RenderingUtils.get_safe_float(
            props.get('line_thickness', 0.75), 0.75, 0.1, 10.0
        )

        # Get spacing and count
        line_spacing = RenderingUtils.get_safe_float(
            props.get('line_spacing', 20), 20, 1, 500
        )
        line_count = int(RenderingUtils.get_safe_float(
            props.get('line_count', 10), 10, 1, 1000
        ))

        # Get margins and padding
        margin_left = RenderingUtils.get_safe_float(
            props.get('margin_left', 0), 0, 0, 500
        )
        margin_right = RenderingUtils.get_safe_float(
            props.get('margin_right', 0), 0, 0, 500
        )
        top_padding = RenderingUtils.get_safe_float(
            props.get('top_padding', 0), 0, 0, 500
        )
        bottom_padding = RenderingUtils.get_safe_float(
            props.get('bottom_padding', 0), 0, 0, 500
        )

        # Get line style and cap
        line_style = props.get('line_style', 'solid')
        line_cap = props.get('line_cap', 'butt')

        # Get columns (number of vertical columns to divide lines into)
        columns = int(RenderingUtils.get_safe_float(
            props.get('columns', 1), 1, 1, 10
        ))

        # Get position and convert coordinates
        pos = widget.position
        box = self.converter.convert_position_for_drawing(pos)

        try:
            pdf_canvas.setStrokeColor(HexColor(color))
            pdf_canvas.setLineWidth(line_thickness)

            # Set line cap style
            if line_cap == 'round':
                pdf_canvas.setLineCap(1)  # Round cap
            elif line_cap == 'square':
                pdf_canvas.setLineCap(2)  # Projecting square cap
            else:  # 'butt' or default
                pdf_canvas.setLineCap(0)  # Butt cap

            # Set line dash pattern based on style
            if line_style == 'dotted':
                # Dotted pattern: [on, off] where on is very small
                pdf_canvas.setDash([1, 3])
            elif line_style == 'dashed':
                # Dashed pattern: [on, off]
                pdf_canvas.setDash([5, 3])
            else:  # 'solid' or default
                pdf_canvas.setDash([])  # Solid line

            # Calculate available height after padding
            available_height = box['height'] - top_padding - bottom_padding

            # Calculate column layout
            if columns > 1:
                # Multi-column layout
                column_gap = RenderingUtils.get_safe_float(
                    props.get('column_gap', 20), 20, 0, 200
                )
                total_gap_width = column_gap * (columns - 1)
                available_width = box['width'] - margin_left - margin_right - total_gap_width
                column_width = available_width / columns

                for col in range(columns):
                    x_start = box['x'] + margin_left + (col * (column_width + column_gap))
                    x_end = x_start + column_width

                    # Draw lines for this column
                    for i in range(line_count):
                        y_pos = box['y'] + box['height'] - top_padding - (i * line_spacing)

                        # Stop if we've run out of space
                        if y_pos < (box['y'] + bottom_padding):
                            break

                        pdf_canvas.line(x_start, y_pos, x_end, y_pos)
            else:
                # Single column layout
                x_start = box['x'] + margin_left
                x_end = box['x'] + box['width'] - margin_right

                # Draw horizontal lines from top to bottom
                for i in range(line_count):
                    y_pos = box['y'] + box['height'] - top_padding - (i * line_spacing)

                    # Stop if we've run out of space
                    if y_pos < (box['y'] + bottom_padding):
                        break

                    pdf_canvas.line(x_start, y_pos, x_end, y_pos)

            # Reset line style to solid after drawing
            pdf_canvas.setDash([])
            pdf_canvas.setLineCap(0)

        except Exception as e:
            if self.strict_mode:
                raise RenderingError(f"Failed to render ruled lines widget '{widget.id}': {e}") from e
            logger.warning(f"Ruled lines rendering failed for widget {widget.id}: {e}")

    def _render_custom_lines(self, pdf_canvas: canvas.Canvas, widget: Widget,
                            props: Dict[str, Any], styling: Dict[str, Any]) -> None:
        """Render custom lines based on explicit coordinates."""
        # Get line properties
        color = RenderingUtils.validate_styling_color(
            styling.get('stroke_color', '#000000')
        )
        width = RenderingUtils.get_safe_float(
            styling.get('line_width'), 1.0, 0.0, 10.0
        )

        # Get lines data
        lines_data = props.get('lines', [])
        if not lines_data:
            if self.strict_mode:
                raise RenderingError(f"Lines widget '{widget.id}' has no lines data")
            return

        try:
            pdf_canvas.setStrokeColor(HexColor(color))
            pdf_canvas.setLineWidth(width)

            # Draw each line
            for line in lines_data:
                if not isinstance(line, dict):
                    continue

                # Get line coordinates
                x1 = RenderingUtils.get_safe_float(line.get('x1'), 0)
                y1 = RenderingUtils.get_safe_float(line.get('y1'), 0)
                x2 = RenderingUtils.get_safe_float(line.get('x2'), 0)
                y2 = RenderingUtils.get_safe_float(line.get('y2'), 0)

                # Convert coordinates
                converted_start = self.converter.convert_point_for_drawing(x1, y1)
                converted_end = self.converter.convert_point_for_drawing(x2, y2)

                # Draw line
                pdf_canvas.line(
                    converted_start['x'], converted_start['y'],
                    converted_end['x'], converted_end['y']
                )

        except Exception as e:
            if self.strict_mode:
                raise RenderingError(f"Failed to render custom lines widget '{widget.id}': {e}") from e
            logger.warning(f"Custom lines rendering failed for widget {widget.id}: {e}")