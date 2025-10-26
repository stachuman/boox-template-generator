"""
Modular widget renderers for e-ink PDF templates.

Provides a registry-based system where each widget type has its own focused
renderer class. Follows CLAUDE.md coding standards - no dummy implementations.
"""

from .base import BaseWidgetRenderer, RenderingUtils
from .registry import WidgetRendererRegistry
from .shape_renderer import ShapeRenderer
from .form_renderer import FormRenderer
from .image_renderer import ImageRenderer
from .text_renderer import TextRenderer
from .table_renderer import TableRenderer
from .link_renderer import LinkRenderer
from .composite_renderer import CompositeRenderer
from .calendar_renderer import CalendarRenderer
from .day_list_renderer import DayListRenderer

__all__ = [
    'BaseWidgetRenderer',
    'RenderingUtils',
    'WidgetRendererRegistry',
    'ShapeRenderer',
    'FormRenderer',
    'ImageRenderer',
    'TextRenderer',
    'TableRenderer',
    'LinkRenderer',
    'CompositeRenderer',
    'CalendarRenderer',
    'DayListRenderer'
]