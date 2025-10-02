"""
Widget renderer registry system.

Provides centralized registry for mapping widget types to their renderers.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import logging
from typing import Dict, Type, Optional
from reportlab.pdfgen import canvas

from ..schema import Widget
from .base import BaseWidgetRenderer, RenderingError

logger = logging.getLogger(__name__)


class WidgetRendererRegistry:
    """
    Registry for widget renderers.

    Maps widget types to their corresponding renderer classes and manages
    renderer lifecycle. Following CLAUDE.md rule #1: No dummy implementations.
    """

    def __init__(self):
        """Initialize empty registry."""
        self._renderers: Dict[str, BaseWidgetRenderer] = {}
        self._renderer_classes: Dict[str, Type[BaseWidgetRenderer]] = {}

    def register_renderer(self, widget_type: str, renderer_class: Type[BaseWidgetRenderer]) -> None:
        """
        Register a renderer class for a widget type.

        Args:
            widget_type: Widget type string (e.g., 'text_block', 'table')
            renderer_class: Renderer class that implements BaseWidgetRenderer

        Raises:
            ValueError: If widget_type is already registered
        """
        if widget_type in self._renderer_classes:
            raise ValueError(f"Widget type '{widget_type}' already registered")

        if not issubclass(renderer_class, BaseWidgetRenderer):
            raise ValueError(f"Renderer class must inherit from BaseWidgetRenderer")

        self._renderer_classes[widget_type] = renderer_class
        logger.debug(f"Registered renderer {renderer_class.__name__} for widget type '{widget_type}'")

    def get_renderer(self, widget_type: str, converter, strict_mode: bool = False) -> BaseWidgetRenderer:
        """
        Get renderer instance for widget type.

        Args:
            widget_type: Widget type to render
            converter: Coordinate converter for renderer
            strict_mode: Whether renderer should fail fast

        Returns:
            Renderer instance for the widget type

        Raises:
            RenderingError: If no renderer registered for widget type
        """
        # Check if we have a cached instance
        cache_key = f"{widget_type}_{id(converter)}_{strict_mode}"
        if cache_key in self._renderers:
            return self._renderers[cache_key]

        # Get renderer class
        renderer_class = self._renderer_classes.get(widget_type)
        if not renderer_class:
            available_types = list(self._renderer_classes.keys())
            raise RenderingError(
                f"No renderer registered for widget type '{widget_type}'. "
                f"Available types: {available_types}"
            )

        # Create and cache renderer instance
        try:
            renderer = renderer_class(converter, strict_mode)
            self._renderers[cache_key] = renderer
            return renderer
        except Exception as e:
            raise RenderingError(f"Failed to create renderer for '{widget_type}': {e}") from e

    def render_widget(self, pdf_canvas: canvas.Canvas, widget: Widget,
                     converter, strict_mode: bool = False, **kwargs) -> None:
        """
        Render widget using appropriate renderer.

        Args:
            pdf_canvas: ReportLab canvas to draw on
            widget: Widget to render
            converter: Coordinate converter
            strict_mode: Whether to fail fast on errors
            **kwargs: Additional context (page_num, total_pages, etc.)

        Raises:
            RenderingError: If rendering fails
        """
        try:
            renderer = self.get_renderer(widget.type, converter, strict_mode)
            renderer.validate_widget(widget)
            renderer.render(pdf_canvas, widget, **kwargs)
        except Exception as e:
            if strict_mode:
                raise RenderingError(f"Failed to render widget {widget.id} ({widget.type}): {e}") from e
            else:
                logger.warning(f"Skipping widget {widget.id} ({widget.type}) due to error: {e}")

    def get_supported_widget_types(self) -> list[str]:
        """Get list of all supported widget types."""
        return list(self._renderer_classes.keys())

    def is_supported(self, widget_type: str) -> bool:
        """Check if widget type is supported."""
        return widget_type in self._renderer_classes

    def clear_cache(self) -> None:
        """Clear cached renderer instances."""
        self._renderers.clear()
        logger.debug("Cleared renderer cache")


# Global registry instance
_global_registry = WidgetRendererRegistry()


def get_global_registry() -> WidgetRendererRegistry:
    """Get the global widget renderer registry."""
    return _global_registry


def register_widget_renderer(widget_type: str, renderer_class: Type[BaseWidgetRenderer]) -> None:
    """
    Convenience function to register renderer in global registry.

    Args:
        widget_type: Widget type string
        renderer_class: Renderer class
    """
    _global_registry.register_renderer(widget_type, renderer_class)