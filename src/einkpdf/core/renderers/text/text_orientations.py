"""
Text orientation utilities for different display modes.

Handles horizontal, vertical, and rotated text rendering
with proper coordinate transformations for e-ink displays.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import logging
from enum import Enum
from typing import Dict, Tuple, Optional
from dataclasses import dataclass
from reportlab.pdfgen import canvas

logger = logging.getLogger(__name__)


class TextOrientation(Enum):
    """Supported text orientation modes."""
    HORIZONTAL = 'horizontal'
    VERTICAL = 'vertical'
    ROTATED_90 = 'rotated_90'
    ROTATED_180 = 'rotated_180'
    ROTATED_270 = 'rotated_270'


@dataclass
class OrientationTransform:
    """Text transformation parameters for specific orientation."""
    rotation_angle: float
    needs_state_save: bool
    transform_x_offset: float = 0.0
    transform_y_offset: float = 0.0


class TextOrientationHandler:
    """
    Handles text rendering with different orientations.

    Provides coordinate transformations and canvas state management
    for various text orientations. Following CLAUDE.md rule #1: No dummy implementations.
    """

    # Orientation configuration mapping
    _ORIENTATION_CONFIG = {
        TextOrientation.HORIZONTAL: OrientationTransform(
            rotation_angle=0.0,
            needs_state_save=False
        ),
        TextOrientation.VERTICAL: OrientationTransform(
            rotation_angle=90.0,
            needs_state_save=True
        ),
        TextOrientation.ROTATED_90: OrientationTransform(
            rotation_angle=90.0,
            needs_state_save=True
        ),
        TextOrientation.ROTATED_180: OrientationTransform(
            rotation_angle=180.0,
            needs_state_save=True
        ),
        TextOrientation.ROTATED_270: OrientationTransform(
            rotation_angle=270.0,
            needs_state_save=True
        )
    }

    @classmethod
    def parse_orientation(cls, orientation_str: str) -> TextOrientation:
        """
        Parse orientation string to TextOrientation enum.

        Args:
            orientation_str: String representation of orientation

        Returns:
            TextOrientation enum value

        Raises:
            ValueError: If orientation string is invalid
        """
        if not isinstance(orientation_str, str):
            raise ValueError(f"Orientation must be string, got {type(orientation_str)}")

        orientation_str = orientation_str.lower().strip()

        # Handle common aliases
        orientation_map = {
            'horizontal': TextOrientation.HORIZONTAL,
            'h': TextOrientation.HORIZONTAL,
            'normal': TextOrientation.HORIZONTAL,
            'vertical': TextOrientation.VERTICAL,
            'v': TextOrientation.VERTICAL,
            'rotated_90': TextOrientation.ROTATED_90,
            '90': TextOrientation.ROTATED_90,
            'rotated_180': TextOrientation.ROTATED_180,
            '180': TextOrientation.ROTATED_180,
            'rotated_270': TextOrientation.ROTATED_270,
            '270': TextOrientation.ROTATED_270
        }

        if orientation_str not in orientation_map:
            valid_options = list(orientation_map.keys())
            raise ValueError(f"Invalid orientation '{orientation_str}'. Valid options: {valid_options}")

        return orientation_map[orientation_str]

    @classmethod
    def get_transform_config(cls, orientation: TextOrientation) -> OrientationTransform:
        """Get transformation configuration for orientation."""
        return cls._ORIENTATION_CONFIG[orientation]

    @classmethod
    def calculate_rotation_center(cls, box: Dict[str, float],
                                 orientation: TextOrientation) -> Tuple[float, float]:
        """
        Calculate rotation center point for text orientation.

        Args:
            box: Bounding box dictionary with x, y, width, height
            orientation: Text orientation

        Returns:
            Tuple of (center_x, center_y) coordinates
        """
        if orientation == TextOrientation.HORIZONTAL:
            # No rotation needed for horizontal text
            return 0.0, 0.0

        # For rotated text, use the center of the bounding box
        center_x = box['x'] + box['width'] / 2.0
        center_y = box['y'] + box['height'] / 2.0

        return center_x, center_y

    @classmethod
    def calculate_text_position(cls, box: Dict[str, float], text_width: float,
                               font_size: float, text_align: str,
                               orientation: TextOrientation) -> Tuple[float, float]:
        """
        Calculate text drawing position based on alignment and orientation.

        Args:
            box: Bounding box for text positioning
            text_width: Width of the text in points
            font_size: Font size for baseline calculation
            text_align: Text alignment (left, center, right)
            orientation: Text orientation

        Returns:
            Tuple of (text_x, text_y) drawing coordinates
        """
        if orientation == TextOrientation.HORIZONTAL:
            return cls._calculate_horizontal_position(
                box, text_width, font_size, text_align
            )
        elif orientation in [TextOrientation.VERTICAL, TextOrientation.ROTATED_90]:
            return cls._calculate_vertical_position(
                box, text_width, font_size, text_align
            )
        elif orientation == TextOrientation.ROTATED_180:
            return cls._calculate_rotated_180_position(
                box, text_width, font_size, text_align
            )
        elif orientation == TextOrientation.ROTATED_270:
            return cls._calculate_rotated_270_position(
                box, text_width, font_size, text_align
            )
        else:
            raise ValueError(f"Unsupported orientation: {orientation}")

    @classmethod
    def _calculate_horizontal_position(cls, box: Dict[str, float], text_width: float,
                                      font_size: float, text_align: str) -> Tuple[float, float]:
        """Calculate position for horizontal text."""
        # Horizontal positioning based on alignment
        if text_align == 'center':
            text_x = box['x'] + max(0.0, (box['width'] - text_width) / 2.0)
        elif text_align == 'right':
            text_x = box['x'] + max(0.0, box['width'] - text_width)
        else:  # left alignment
            text_x = box['x']

        # Vertical centering
        text_y = box['y'] + (box['height'] - font_size) / 2.0

        return text_x, text_y

    @classmethod
    def _calculate_vertical_position(cls, box: Dict[str, float], text_width: float,
                                    font_size: float, text_align: str) -> Tuple[float, float]:
        """Calculate position for vertical text (90-degree rotation)."""
        # For vertical text, alignment works differently due to rotation
        if text_align == 'center':
            start_x = -text_width / 2.0
        elif text_align == 'right':
            start_x = -text_width
        else:  # left alignment (or default for vertical)
            start_x = -text_width / 2.0

        start_y = -font_size / 3.0

        return start_x, start_y

    @classmethod
    def _calculate_rotated_180_position(cls, box: Dict[str, float], text_width: float,
                                       font_size: float, text_align: str) -> Tuple[float, float]:
        """Calculate position for 180-degree rotated text."""
        # 180-degree rotation flips both x and y
        if text_align == 'center':
            start_x = text_width / 2.0
        elif text_align == 'right':
            start_x = text_width
        else:  # left alignment
            start_x = -text_width / 2.0

        start_y = font_size / 3.0

        return start_x, start_y

    @classmethod
    def _calculate_rotated_270_position(cls, box: Dict[str, float], text_width: float,
                                       font_size: float, text_align: str) -> Tuple[float, float]:
        """Calculate position for 270-degree rotated text."""
        # 270-degree rotation is like vertical but flipped
        if text_align == 'center':
            start_x = text_width / 2.0
        elif text_align == 'right':
            start_x = text_width
        else:  # left alignment
            start_x = text_width / 2.0

        start_y = font_size / 3.0

        return start_x, start_y

    @classmethod
    def apply_orientation_transform(cls, pdf_canvas: canvas.Canvas,
                                   box: Dict[str, float],
                                   orientation: TextOrientation) -> None:
        """
        Apply canvas transformations for text orientation.

        Args:
            pdf_canvas: ReportLab canvas to transform
            box: Bounding box for transformation center
            orientation: Text orientation to apply

        Note:
            Must be called within saveState/restoreState block for rotated text.
        """
        transform_config = cls.get_transform_config(orientation)

        if not transform_config.needs_state_save:
            return  # No transformation needed for horizontal text

        # Calculate rotation center
        center_x, center_y = cls.calculate_rotation_center(box, orientation)

        # Apply transformation
        pdf_canvas.translate(center_x, center_y)
        pdf_canvas.rotate(transform_config.rotation_angle)

        # Apply any additional offsets
        if transform_config.transform_x_offset or transform_config.transform_y_offset:
            pdf_canvas.translate(
                transform_config.transform_x_offset,
                transform_config.transform_y_offset
            )

    @classmethod
    def render_oriented_text(cls, pdf_canvas: canvas.Canvas, box: Dict[str, float],
                            text: str, text_width: float, font_size: float,
                            text_align: str, orientation: TextOrientation,
                            underline: bool = False) -> None:
        """
        Render text with specified orientation and alignment.

        Args:
            pdf_canvas: ReportLab canvas to draw on
            box: Bounding box for text positioning
            text: Text content to render
            text_width: Pre-calculated text width
            font_size: Font size
            text_align: Text alignment
            orientation: Text orientation
            underline: Whether to underline text
        """
        transform_config = cls.get_transform_config(orientation)

        if transform_config.needs_state_save:
            pdf_canvas.saveState()

        try:
            # Apply orientation transformation
            cls.apply_orientation_transform(pdf_canvas, box, orientation)

            # Calculate text position
            text_x, text_y = cls.calculate_text_position(
                box, text_width, font_size, text_align, orientation
            )

            # Draw text
            pdf_canvas.drawString(text_x, text_y, text)

            # Draw underline if specified
            if underline:
                underline_y = text_y - font_size * 0.1
                pdf_canvas.line(text_x, underline_y, text_x + text_width, underline_y)

        except Exception as e:
            logger.warning(f"Failed to render oriented text ({orientation}): {e}")
        finally:
            if transform_config.needs_state_save:
                pdf_canvas.restoreState()