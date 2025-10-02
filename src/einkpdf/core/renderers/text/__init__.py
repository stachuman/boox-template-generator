"""
Text rendering engine for e-ink PDF templates.

Centralized text rendering utilities used across all widget renderers.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

from .text_engine import TextEngine, TextRenderingOptions
from .text_formatter import TextFormatter
from .text_orientations import TextOrientation

__all__ = [
    'TextEngine',
    'TextRenderingOptions',
    'TextFormatter',
    'TextOrientation'
]