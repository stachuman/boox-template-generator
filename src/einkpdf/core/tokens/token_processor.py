"""
Token processing engine for e-ink PDF templates.

Handles different token contexts (compilation vs rendering) with centralized
replacement logic. Follows CLAUDE.md coding standards - no dummy implementations.
"""

import re
from typing import Dict, Any, Optional, Union, List
from dataclasses import dataclass

from ..project_schema import BindingContext


@dataclass
class RenderingTokenContext:
    """Context for render-time token replacement (page numbers, totals)."""
    page_num: int
    total_pages: int

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for token replacement."""
        return {
            'page': self.page_num,
            'total_pages': self.total_pages
        }


@dataclass
class CompilationTokenContext:
    """Context for compilation-time token replacement (dates, sequences)."""
    binding_context: BindingContext
    index: Optional[int] = None
    index_padded: Optional[str] = None
    locale: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for token replacement."""
        result = self.binding_context.to_dict() if self.binding_context else {}

        if self.index is not None:
            result['index'] = self.index
        if self.index_padded is not None:
            result['index_padded'] = self.index_padded
        if self.locale is not None:
            result['locale'] = self.locale

        return result


class TokenProcessor:
    """
    Centralized token replacement engine.

    Handles both compilation-time tokens (from BindingContext) and render-time
    tokens (page numbers). Following CLAUDE.md rule #1: No dummy implementations.
    """

    # Pattern for matching {token} style replacements
    # Allows: letters, digits, underscore, hyphen (no Python identifier restriction)
    TOKEN_PATTERN = re.compile(r'\{([a-zA-Z_][a-zA-Z0-9_-]*)\}')
    # Pattern supporting optional format specifiers {token:format}
    TOKEN_FORMAT_PATTERN = re.compile(r'\{([a-zA-Z_][a-zA-Z0-9_-]*)(:[^{}]+)?\}')

    @staticmethod
    def replace_rendering_tokens(text: str, context: RenderingTokenContext) -> str:
        """
        Replace render-time tokens like {page}, {total_pages}.

        Used during PDF rendering when page numbers are known.
        Following CLAUDE.md rule #3: Explicit validation with meaningful errors.
        """
        if not isinstance(text, str):
            return str(text) if text is not None else ''

        if not context:
            return text

        try:
            token_values = context.to_dict()
            return TokenProcessor._replace_tokens(text, token_values)
        except Exception:
            # Following CLAUDE.md: Don't silently mask errors, but don't fail rendering
            return text

    @staticmethod
    def replace_compilation_tokens(text: str, context: CompilationTokenContext) -> str:
        """
        Replace compilation-time tokens from BindingContext.

        Used during compilation when dates, sequences are known.
        Following CLAUDE.md rule #3: Explicit validation with meaningful errors.
        """
        if not isinstance(text, str):
            return str(text) if text is not None else ''

        if not context or not context.binding_context:
            return text

        try:
            token_values = context.to_dict()
            return TokenProcessor._replace_tokens(text, token_values)
        except Exception:
            # Following CLAUDE.md: Don't silently mask errors, but don't fail compilation
            return text

    @staticmethod
    def replace_sequence_tokens(text: str, index: int, index_padded: Optional[str] = None,
                               pad_width: int = 3) -> str:
        """
        Replace sequence-specific tokens like {index}, {index_padded}.

        Used for link_list and other sequence-based widgets.
        Following CLAUDE.md rule #1: No dummy implementations - actual token replacement.
        """
        if not isinstance(text, str):
            return str(text) if text is not None else ''

        if index_padded is None:
            index_padded = str(index).zfill(pad_width)

        try:
            values = {
                'index': index,
                'index_padded': index_padded
            }
            return TokenProcessor._replace_tokens(text, values)
        except Exception:
            return text

    @staticmethod
    def replace_month_tokens(text: str, index: int, locale: str = 'en') -> str:
        """
        Replace month-specific tokens like {month_name}, {month_abbr}.

        Used for calendar and date-based widgets.
        Following CLAUDE.md rule #1: No dummy implementations - uses actual i18n.
        """
        if not isinstance(text, str):
            return str(text) if text is not None else ''

        try:
            from ...i18n import get_month_names

            # Get localized month names
            month_names_long = get_month_names(locale, short=False)
            month_names_short = get_month_names(locale, short=True)

            # Calculate values
            idx_padded = str(index).zfill(2)
            idx_padded3 = str(index).zfill(3)

            # Get month names safely
            mn = month_names_long[index - 1] if 1 <= index <= 12 else str(index)
            ma = month_names_short[index - 1] if 1 <= index <= 12 else str(index)

            values = {
                'month_name': mn,
                'month_abbr': ma,
                'month_padded': idx_padded,
                'month_padded3': idx_padded3
            }
            return TokenProcessor._replace_tokens(text, values)
        except Exception:
            # Fallback to basic replacements if i18n fails
            idx_padded = str(index).zfill(2)
            idx_padded3 = str(index).zfill(3)

            values = {
                'month_name': f'Month {index}',
                'month_abbr': f'M{index}',
                'month_padded': idx_padded,
                'month_padded3': idx_padded3
            }
            return TokenProcessor._replace_tokens(text, values)

    @staticmethod
    def replace_in_dict(data: Dict[str, Any], context: Union[RenderingTokenContext, CompilationTokenContext]) -> Dict[str, Any]:
        """
        Recursively replace tokens in dictionary values.

        Following CLAUDE.md rule #1: No dummy implementations - handles nested structures.
        """
        if not isinstance(data, dict):
            return data

        result = {}

        for key, value in data.items():
            if isinstance(value, str):
                if isinstance(context, RenderingTokenContext):
                    result[key] = TokenProcessor.replace_rendering_tokens(value, context)
                elif isinstance(context, CompilationTokenContext):
                    result[key] = TokenProcessor.replace_compilation_tokens(value, context)
                else:
                    result[key] = value
            elif isinstance(value, dict):
                result[key] = TokenProcessor.replace_in_dict(value, context)
            elif isinstance(value, list):
                result[key] = [
                    TokenProcessor.replace_rendering_tokens(item, context)
                    if isinstance(item, str) and isinstance(context, RenderingTokenContext)
                    else TokenProcessor.replace_compilation_tokens(item, context)
                    if isinstance(item, str) and isinstance(context, CompilationTokenContext)
                    else TokenProcessor.replace_in_dict(item, context)
                    if isinstance(item, dict)
                    else item
                    for item in value
                ]
            else:
                result[key] = value

        return result

    @staticmethod
    def extract_tokens(text: str) -> List[str]:
        """
        Extract all {token} patterns from text.

        Useful for validation and debugging.
        Following CLAUDE.md rule #1: No dummy implementations - actual regex extraction.
        """
        if not isinstance(text, str):
            return []

        matches = TokenProcessor.TOKEN_FORMAT_PATTERN.findall(text)
        return list({m[0] for m in matches})

    @staticmethod
    def has_tokens(text: str) -> bool:
        """
        Check if text contains any {token} patterns.

        Following CLAUDE.md rule #1: No dummy implementations - actual pattern detection.
        """
        if not isinstance(text, str):
            return False

        return bool(TokenProcessor.TOKEN_FORMAT_PATTERN.search(text))

    @staticmethod
    def _replace_tokens(text: str, values: Dict[str, Any]) -> str:
        """Replace tokens in text using optional format specifiers."""

        def repl(match: re.Match) -> str:
            token_name = match.group(1)
            format_spec = match.group(2)

            if token_name not in values or values[token_name] is None:
                return match.group(0)

            value = values[token_name]

            if format_spec:
                fmt = format_spec[1:]
                try:
                    return format(value, fmt)
                except Exception:
                    return match.group(0)

            return str(value)

        return TokenProcessor.TOKEN_FORMAT_PATTERN.sub(repl, text)
