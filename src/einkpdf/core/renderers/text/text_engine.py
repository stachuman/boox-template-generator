"""
Core text rendering engine for e-ink PDF templates.

Centralizes all text drawing operations with support for orientation,
alignment, styling, and coordinate conversion.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

from ...fonts import ensure_font_registered
from ...coordinates import CoordinateConverter

logger = logging.getLogger(__name__)


@dataclass
class TextRenderingOptions:
    """Options for text rendering configuration."""
    font_name: str = 'Helvetica'
    font_size: float = 12.0
    color: str = '#000000'
    text_align: str = 'left'  # left, center, right
    orientation: str = 'horizontal'  # horizontal, vertical
    underline: bool = False
    horiz_y: float = 0.0  # For horizontal text positioning


class TextEngine:
    """
    Core text rendering engine for all widget renderers.

    Provides centralized text drawing with orientation, alignment,
    and styling support. Following CLAUDE.md rule #1: No dummy implementations.
    """

    def __init__(self, converter: CoordinateConverter):
        """
        Initialize text engine with coordinate converter.

        Args:
            converter: Coordinate conversion utilities
        """
        self.converter = converter

    def render_text(self, pdf_canvas: canvas.Canvas, box: Dict[str, float],
                   text: str, options: TextRenderingOptions) -> None:
        """
        Render text with specified options and positioning.

        Args:
            pdf_canvas: ReportLab canvas to draw on
            box: Bounding box for text positioning (PDF coordinates)
            text: Text content to render
            options: Text rendering configuration

        Raises:
            ValueError: If text or options are invalid
        """
        if not text:
            return  # Skip empty text

        if not isinstance(options, TextRenderingOptions):
            raise ValueError("options must be TextRenderingOptions instance")

        # Validate and register font
        font_name = ensure_font_registered(options.font_name)

        # Calculate text width for positioning
        try:
            text_width = pdf_canvas.stringWidth(text, font_name, options.font_size)
        except Exception:
            # Fallback calculation if font width calculation fails
            text_width = len(text) * (options.font_size * 0.6)

        # Render based on orientation
        if options.orientation == 'vertical':
            self._render_vertical_text(
                pdf_canvas, box, text, text_width, font_name, options
            )
        else:
            self._render_horizontal_text(
                pdf_canvas, box, text, text_width, font_name, options
            )

    def _render_vertical_text(self, pdf_canvas: canvas.Canvas, box: Dict[str, float],
                             text: str, text_width: float, font_name: str,
                             options: TextRenderingOptions) -> None:
        """Render text with vertical orientation (90-degree rotation)."""
        pdf_canvas.saveState()
        try:
            # Set font and color
            pdf_canvas.setFont(font_name, options.font_size)
            pdf_canvas.setFillColor(HexColor(options.color))

            # Calculate rotation center
            cx = box['x'] + box['width'] / 2.0
            cy = box['y'] + box['height'] / 2.0

            # Apply rotation transformation
            pdf_canvas.translate(cx, cy)
            pdf_canvas.rotate(90)

            # Calculate text position based on alignment
            if options.text_align == 'center':
                start_x = -text_width / 2.0
            elif options.text_align == 'right':
                start_x = -text_width
            else:  # left alignment (default for vertical)
                start_x = -text_width / 2.0

            start_y = -options.font_size / 3.0

            # Draw text
            pdf_canvas.drawString(start_x, start_y, text)

            # Draw underline if specified
            if options.underline:
                underline_y = start_y - options.font_size * 0.1
                pdf_canvas.line(start_x, underline_y, start_x + text_width, underline_y)

        except Exception as e:
            logger.warning(f"Failed to render vertical text: {e}")
        finally:
            pdf_canvas.restoreState()

    def _render_horizontal_text(self, pdf_canvas: canvas.Canvas, box: Dict[str, float],
                               text: str, text_width: float, font_name: str,
                               options: TextRenderingOptions) -> None:
        """Render text with horizontal orientation."""
        try:
            # Set font and color (no state save/restore needed for horizontal)
            pdf_canvas.setFont(font_name, options.font_size)
            pdf_canvas.setFillColor(HexColor(options.color))

            # Calculate text position based on alignment
            if options.text_align == 'center':
                start_x = box['x'] + max(0.0, (box['width'] - text_width) / 2.0)
            elif options.text_align == 'right':
                start_x = box['x'] + max(0.0, box['width'] - text_width)
            else:  # left alignment
                start_x = box['x']

            # Use provided horiz_y or calculate center position
            text_y = options.horiz_y if options.horiz_y > 0 else (
                box['y'] + (box['height'] - options.font_size) / 2.0
            )

            # Draw text
            pdf_canvas.drawString(start_x, text_y, text)

            # Draw underline if specified
            if options.underline:
                underline_y = text_y - options.font_size * 0.1
                pdf_canvas.line(start_x, underline_y, start_x + text_width, underline_y)

        except Exception as e:
            logger.warning(f"Failed to render horizontal text: {e}")

    def calculate_text_dimensions(self, pdf_canvas: canvas.Canvas, text: str,
                                 font_name: str, font_size: float) -> Dict[str, float]:
        """
        Calculate text dimensions for layout planning.

        Args:
            pdf_canvas: ReportLab canvas for width calculation
            text: Text content to measure
            font_name: Font for measurement
            font_size: Font size for measurement

        Returns:
            Dictionary with 'width' and 'height' keys
        """
        try:
            font_name = ensure_font_registered(font_name)
            width = pdf_canvas.stringWidth(text, font_name, font_size)
            height = font_size
            return {'width': width, 'height': height}
        except Exception:
            # Fallback calculation
            width = len(text) * (font_size * 0.6)
            height = font_size
            return {'width': width, 'height': height}

    def create_text_options(self, styling: Dict[str, Any],
                           default_font: str = 'Helvetica',
                           default_size: float = 12.0) -> TextRenderingOptions:
        """
        Create TextRenderingOptions from widget styling dictionary.

        Args:
            styling: Widget styling configuration
            default_font: Default font if not specified
            default_size: Default font size if not specified

        Returns:
            Configured TextRenderingOptions instance
        """
        # Extract font settings with validation and registration
        font_name = styling.get('font', default_font)
        # Ensure font is registered with ReportLab (needed for TableStyle and other direct uses)
        font_name = ensure_font_registered(font_name)

        # Handle font size (may be string or number)
        font_size_raw = styling.get('size') or styling.get('font_size')
        if font_size_raw is None:
            font_size = default_size
        else:
            try:
                font_size = float(font_size_raw)
                font_size = max(6.0, min(font_size, 72.0))  # Reasonable bounds
            except (ValueError, TypeError):
                font_size = default_size

        # Extract color with validation
        color = styling.get('color') or styling.get('font_color', '#000000')
        if not color.startswith('#') and color not in ['none', 'transparent']:
            color = f'#{color}'

        # Extract alignment and orientation
        text_align = styling.get('text_align', 'left')
        if text_align not in ['left', 'center', 'right']:
            text_align = 'left'

        orientation = styling.get('orientation', 'horizontal')
        if orientation not in ['horizontal', 'vertical']:
            orientation = 'horizontal'

        # Extract formatting options
        underline = bool(styling.get('underline', False))

        return TextRenderingOptions(
            font_name=font_name,
            font_size=font_size,
            color=color,
            text_align=text_align,
            orientation=orientation,
            underline=underline
        )