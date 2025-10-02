"""
Base widget renderer and shared utilities.

Provides common interface and utilities for all widget renderers.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Tuple
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

from ..schema import Widget
from ..coordinates import CoordinateConverter
from ..tokens import TokenProcessor, RenderingTokenContext

logger = logging.getLogger(__name__)


class RenderingError(Exception):
    """Raised when widget rendering fails."""
    pass


class BaseWidgetRenderer(ABC):
    """
    Base class for all widget renderers.

    Provides common functionality and enforces consistent interface.
    Following CLAUDE.md rule #1: No dummy implementations - concrete interface.
    """

    def __init__(self, converter: CoordinateConverter, strict_mode: bool = False):
        """
        Initialize renderer with shared dependencies.

        Args:
            converter: Coordinate conversion utilities
            strict_mode: Whether to fail fast on errors
        """
        self.converter = converter
        self.strict_mode = strict_mode

    @abstractmethod
    def render(self, pdf_canvas: canvas.Canvas, widget: Widget, **kwargs) -> None:
        """
        Render the widget to PDF canvas.

        Args:
            pdf_canvas: ReportLab canvas to draw on
            widget: Widget definition to render
            **kwargs: Additional context (page_num, total_pages, etc.)

        Raises:
            RenderingError: If rendering fails and strict_mode is True
        """
        pass

    @property
    @abstractmethod
    def supported_widget_types(self) -> list[str]:
        """Return list of widget types this renderer supports."""
        pass

    def validate_widget(self, widget: Widget) -> None:
        """
        Validate widget before rendering.

        Following CLAUDE.md rule #3: Explicit validation with meaningful errors.
        """
        if not widget:
            raise RenderingError("Widget cannot be None")

        if widget.type not in self.supported_widget_types:
            raise RenderingError(
                f"Widget type '{widget.type}' not supported by {self.__class__.__name__}. "
                f"Supported types: {self.supported_widget_types}"
            )

    def get_rendering_context(self, **kwargs) -> Optional[RenderingTokenContext]:
        """Extract rendering context from kwargs if available."""
        page_num = kwargs.get('page_num')
        total_pages = kwargs.get('total_pages')

        if page_num is not None and total_pages is not None:
            return RenderingTokenContext(page_num=page_num, total_pages=total_pages)

        return None

    def process_tokens(self, text: str, **kwargs) -> str:
        """Process rendering tokens in text using context from kwargs."""
        if not isinstance(text, str):
            return str(text) if text is not None else ''

        context = self.get_rendering_context(**kwargs)
        if context:
            return TokenProcessor.replace_rendering_tokens(text, context)

        return text


class RenderingUtils:
    """
    Shared rendering utilities for all widget renderers.

    Contains common drawing operations that are reused across renderers.
    Following CLAUDE.md rule #1: No dummy implementations - actual utilities.
    """

    @staticmethod
    def draw_widget_background(pdf_canvas: canvas.Canvas, widget: Widget,
                              converter: CoordinateConverter) -> None:
        """Draw widget background if specified in styling."""
        styling = getattr(widget, 'styling', {}) or {}
        background_color = styling.get('background_color')

        if not background_color or background_color.lower() in ['none', 'transparent']:
            return

        try:
            # Get position and convert coordinates
            pos = widget.position
            box = converter.convert_position_for_drawing(pos)

            # Set background color
            pdf_canvas.setFillColor(HexColor(background_color))
            pdf_canvas.rect(
                box['x'], box['y'], box['width'], box['height'],
                stroke=0, fill=1
            )
        except Exception as e:
            logger.warning(f"Failed to draw background for widget {widget.id}: {e}")

    @staticmethod
    def draw_highlight_background(pdf_canvas: canvas.Canvas, box: Dict[str, float],
                                 highlight_color: str) -> None:
        """Draw highlight background with the given color."""
        try:
            pdf_canvas.setFillColor(HexColor(highlight_color))
            pdf_canvas.rect(
                box['x'], box['y'], box['width'], box['height'],
                stroke=0, fill=1
            )
        except Exception as e:
            logger.warning(f"Failed to draw highlight background: {e}")

    @staticmethod
    def draw_plain_background(pdf_canvas: canvas.Canvas, box: Dict[str, float],
                             background_color: str) -> None:
        """Draw plain background with the given color."""
        try:
            if background_color and background_color.lower() not in ['none', 'transparent']:
                pdf_canvas.setFillColor(HexColor(background_color))
                pdf_canvas.rect(
                    box['x'], box['y'], box['width'], box['height'],
                    stroke=0, fill=1
                )
        except Exception as e:
            logger.warning(f"Failed to draw plain background: {e}")

    @staticmethod
    def validate_styling_color(color: str, default: str = '#000000') -> str:
        """Validate and normalize color values."""
        if not color:
            return default

        # Normalize color format
        color = color.strip()
        if not color.startswith('#') and color not in ['none', 'transparent']:
            color = f'#{color}'

        return color

    @staticmethod
    def get_safe_float(value: Any, default: float, min_val: float = None,
                      max_val: float = None) -> float:
        """Safely convert value to float with bounds checking."""
        try:
            result = float(value) if value is not None else default

            if min_val is not None:
                result = max(result, min_val)
            if max_val is not None:
                result = min(result, max_val)

            return result
        except (ValueError, TypeError):
            return default

    @staticmethod
    def get_safe_int(value: Any, default: int, min_val: int = None,
                    max_val: int = None) -> int:
        """Safely convert value to int with bounds checking."""
        try:
            result = int(value) if value is not None else default

            if min_val is not None:
                result = max(result, min_val)
            if max_val is not None:
                result = min(result, max_val)

            return result
        except (ValueError, TypeError):
            return default