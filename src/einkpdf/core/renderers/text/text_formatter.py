"""
Text formatting utilities for advanced text styling.

Handles text wrapping, multi-line text, rich formatting,
and special text processing for e-ink displays.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TextBox:
    """Represents a box of text with positioning and styling."""
    text: str
    x: float
    y: float
    width: float
    height: float
    font_name: str = 'Helvetica'
    font_size: float = 12.0
    color: str = '#000000'


class TextFormatter:
    """
    Advanced text formatting utilities.

    Handles text wrapping, multi-line layout, and rich text processing.
    Following CLAUDE.md rule #1: No dummy implementations.
    """

    @staticmethod
    def wrap_text(text: str, max_width: float, font_name: str, font_size: float,
                  canvas_for_width_calc) -> List[str]:
        """
        Wrap text to fit within specified width.

        Args:
            text: Text to wrap
            max_width: Maximum width in points
            font_name: Font for width calculation
            font_size: Font size for width calculation
            canvas_for_width_calc: Canvas object for string width calculation

        Returns:
            List of text lines that fit within max_width
        """
        if not text or max_width <= 0:
            return []

        words = text.split()
        if not words:
            return []

        lines = []
        current_line = ""

        for word in words:
            # Test if adding this word would exceed width
            test_line = f"{current_line} {word}".strip()

            try:
                test_width = canvas_for_width_calc.stringWidth(test_line, font_name, font_size)
            except Exception:
                # Fallback width calculation
                test_width = len(test_line) * (font_size * 0.6)

            if test_width <= max_width:
                current_line = test_line
            else:
                # Current line is ready, start new line with current word
                if current_line:
                    lines.append(current_line)

                # Check if single word is too long
                try:
                    word_width = canvas_for_width_calc.stringWidth(word, font_name, font_size)
                except Exception:
                    word_width = len(word) * (font_size * 0.6)

                if word_width > max_width:
                    # Word is too long, need to break it
                    lines.extend(TextFormatter._break_long_word(
                        word, max_width, font_name, font_size, canvas_for_width_calc
                    ))
                    current_line = ""
                else:
                    current_line = word

        # Add the last line if not empty
        if current_line:
            lines.append(current_line)

        return lines

    @staticmethod
    def _break_long_word(word: str, max_width: float, font_name: str, font_size: float,
                        canvas_for_width_calc) -> List[str]:
        """Break a word that's too long to fit on a single line."""
        if not word:
            return []

        parts = []
        current_part = ""

        for char in word:
            test_part = current_part + char

            try:
                test_width = canvas_for_width_calc.stringWidth(test_part, font_name, font_size)
            except Exception:
                test_width = len(test_part) * (font_size * 0.6)

            if test_width <= max_width:
                current_part = test_part
            else:
                if current_part:
                    parts.append(current_part)
                current_part = char

        if current_part:
            parts.append(current_part)

        return parts

    @staticmethod
    def calculate_multi_line_layout(lines: List[str], box: Dict[str, float],
                                   font_size: float, line_spacing: float = 1.2,
                                   vertical_align: str = 'top') -> List[TextBox]:
        """
        Calculate layout for multi-line text within a bounding box.

        Args:
            lines: List of text lines
            box: Bounding box dictionary with x, y, width, height
            font_size: Font size for line height calculation
            line_spacing: Line spacing multiplier (1.0 = no extra spacing)
            vertical_align: 'top', 'center', or 'bottom' alignment

        Returns:
            List of TextBox objects with positioning for each line
        """
        if not lines:
            return []

        line_height = font_size * line_spacing
        total_text_height = len(lines) * line_height

        # Calculate starting Y position based on vertical alignment
        if vertical_align == 'center':
            start_y = box['y'] + (box['height'] - total_text_height) / 2 + total_text_height - line_height
        elif vertical_align == 'bottom':
            start_y = box['y'] + total_text_height - line_height
        else:  # top alignment
            start_y = box['y'] + box['height'] - line_height

        text_boxes = []
        current_y = start_y

        for line in lines:
            text_box = TextBox(
                text=line,
                x=box['x'],
                y=current_y,
                width=box['width'],
                height=line_height,
                font_size=font_size
            )
            text_boxes.append(text_box)
            current_y -= line_height

        return text_boxes

    @staticmethod
    def extract_font_properties(styling: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract and validate font properties from styling dictionary.

        Args:
            styling: Widget styling configuration

        Returns:
            Normalized font properties dictionary
        """
        # Extract font name
        font_name = styling.get('font', 'Helvetica')

        # Extract and validate font size
        font_size_raw = styling.get('size') or styling.get('font_size', 12.0)
        try:
            font_size = float(font_size_raw)
            font_size = max(6.0, min(font_size, 72.0))  # Reasonable bounds
        except (ValueError, TypeError):
            font_size = 12.0

        # Extract and validate color
        color = styling.get('color') or styling.get('font_color', '#000000')
        if not color.startswith('#') and color not in ['none', 'transparent']:
            color = f'#{color}'

        # Extract text alignment
        text_align = styling.get('text_align', 'left')
        if text_align not in ['left', 'center', 'right']:
            text_align = 'left'

        # Extract line spacing
        line_spacing = styling.get('line_spacing', 1.2)
        try:
            line_spacing = float(line_spacing)
            line_spacing = max(0.8, min(line_spacing, 3.0))  # Reasonable bounds
        except (ValueError, TypeError):
            line_spacing = 1.2

        return {
            'font_name': font_name,
            'font_size': font_size,
            'color': color,
            'text_align': text_align,
            'line_spacing': line_spacing,
            'underline': bool(styling.get('underline', False)),
            'bold': bool(styling.get('bold', False)),
            'italic': bool(styling.get('italic', False))
        }

    @staticmethod
    def process_special_characters(text: str) -> str:
        """
        Process special characters for e-ink display compatibility.

        Args:
            text: Raw text input

        Returns:
            Processed text with e-ink compatible character replacements
        """
        if not isinstance(text, str):
            return str(text) if text is not None else ''

        # Replace problematic characters for e-ink displays
        replacements = {
            '“': '"',  # Curly double quote (left)
            '”': '"',  # Curly double quote (right)
            '‘': "'",  # Curly single quote (left)
            '’': "'",  # Curly single quote (right)
            '–': '-',   # En dash to hyphen
            '—': '-',   # Em dash to hyphen
            '…': '...',  # Ellipsis to three dots
            '\xa0': ' ',  # Non-breaking space to regular space
        }

        processed_text = text
        for old_char, new_char in replacements.items():
            processed_text = processed_text.replace(old_char, new_char)

        return processed_text

    @staticmethod
    def validate_text_content(text: str, max_length: Optional[int] = None) -> str:
        """
        Validate and sanitize text content.

        Args:
            text: Text to validate
            max_length: Maximum allowed text length

        Returns:
            Validated and sanitized text

        Raises:
            ValueError: If text is invalid
        """
        if text is None:
            return ''

        if not isinstance(text, str):
            text = str(text)

        # Process special characters
        text = TextFormatter.process_special_characters(text)

        # Check length if specified
        if max_length is not None and len(text) > max_length:
            logger.warning(f"Text truncated from {len(text)} to {max_length} characters")
            text = text[:max_length]

        return text
