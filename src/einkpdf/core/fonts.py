"""
Font registration helpers for ReportLab.

Adds support for optional custom fonts bundled in assets/fonts.
If a requested font is not available, falls back to safe base-14 fonts.
"""

from pathlib import Path
from typing import Optional, Dict, List, Tuple
import logging

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# Base-14 fonts always available in ReportLab/PDF
BASE14 = {
    "Helvetica",
    "Helvetica-Bold",
    "Helvetica-Oblique",
    "Helvetica-BoldOblique",
    "Times-Roman",
    "Times-Bold",
    "Times-Italic",
    "Times-BoldItalic",
    "Courier",
    "Courier-Bold",
    "Courier-Oblique",
    "Courier-BoldOblique",
    "Symbol",
    "ZapfDingbats",
}


_FONT_MAP: Dict[str, Path] = {}
_NORM_MAP: Dict[str, Path] = {}
_SCANNED: bool = False


def _assets_font_dir() -> Path:
    # src/einkpdf/core/fonts.py -> assets/fonts/
    return Path(__file__).resolve().parent.parent / "assets" / "fonts"


def _normalize_name(name: str) -> str:
    return ''.join(ch for ch in name.lower() if ch.isalnum())


def _camel_to_title(s: str) -> str:
    # Insert spaces before capital letters that follow lowercase or another capital followed by lowercase
    out = []
    prev = ''
    for i, ch in enumerate(s):
        if i > 0 and ch.isupper() and (prev.islower() or (prev.isupper() and (i+1 < len(s) and s[i+1].islower()))):
            out.append(' ')
        out.append(ch)
        prev = ch
    return ''.join(out)


def _derive_display_name(stem: str) -> str:
    # Replace separators with space then apply camel split
    cleaned = stem.replace('_', ' ').replace('-', ' ')
    # Remove duplicate spaces
    cleaned = ' '.join(cleaned.split())
    # Apply camel case spacing on each token joined
    tokens = cleaned.split(' ')
    tokens = [_camel_to_title(t) for t in tokens]
    title = ' '.join(tokens)
    return title


def _scan_fonts() -> None:
    global _SCANNED, _FONT_MAP, _NORM_MAP
    if _SCANNED:
        return
    _SCANNED = True
    _FONT_MAP = {}
    _NORM_MAP = {}
    base = _assets_font_dir()
    if not base.exists():
        return
    for path in base.glob('**/*'):
        if path.suffix.lower() not in {'.ttf', '.otf'}:
            continue
        stem = path.stem
        display = _derive_display_name(stem)
        _FONT_MAP[display] = path
        _NORM_MAP[_normalize_name(display)] = path
        # also allow matching by raw stem
        _NORM_MAP[_normalize_name(stem)] = path


def ensure_font_registered(font_name: Optional[str]) -> str:
    """Ensure the requested font is registered with ReportLab.

    Returns the effective font name to use (may be a fallback).
    """
    name = (font_name or "Helvetica").strip()

    # Already available base-14 font
    if name in BASE14:
        return name

    # Already registered
    try:
        if name in pdfmetrics.getRegisteredFontNames():
            return name
    except Exception:
        pass

    # Try to register any asset font dynamically
    try:
        _scan_fonts()
        # direct display name match (case sensitive)
        path = _FONT_MAP.get(name)
        if path and path.exists():
            pdfmetrics.registerFont(TTFont(name, str(path)))
            return name
        # normalized match
        path = _NORM_MAP.get(_normalize_name(name))
        if path and path.exists():
            # Register under requested name for setFont compatibility
            pdfmetrics.registerFont(TTFont(name, str(path)))
            return name
    except Exception:
        pass

    # Fallback: choose a similar base-14 font
    if "Courier" in name:
        return "Courier"
    # Handwritten fallback to Helvetica (clean, legible on e-ink)
    return "Helvetica"


def list_available_fonts() -> List[str]:
    """Return display names of available asset fonts (for UI/backend)."""
    _scan_fonts()
    if _FONT_MAP:
        return sorted(_FONT_MAP.keys())
    # Fallback base fonts if none present
    return sorted(list(BASE14))


def list_font_families() -> Dict[str, List[str]]:
    """Return font families grouped by family name with their variants."""
    _scan_fonts()
    families = {}

    # Add base14 fonts
    families["Helvetica"] = ["Regular", "Bold", "Oblique", "Bold Oblique"]
    families["Times"] = ["Roman", "Bold", "Italic", "Bold Italic"]
    families["Courier"] = ["Regular", "Bold", "Oblique", "Bold Oblique"]
    families["Symbol"] = ["Regular"]
    families["ZapfDingbats"] = ["Regular"]

    # Process asset fonts
    for display_name in _FONT_MAP.keys():
        family, variant = _parse_font_name(display_name)
        if family not in families:
            families[family] = []
        if variant not in families[family]:
            families[family].append(variant)

    # Sort variants within each family
    for family in families:
        families[family] = sorted(families[family])

    return families


def _parse_font_name(display_name: str) -> Tuple[str, str]:
    """Parse font display name into family and variant."""
    # Common patterns for font variants
    variant_patterns = [
        'Bold Oblique', 'Bold Italic', 'Bold',
        'Oblique', 'Italic',
        'Extra Bold', 'Semi Bold', 'Light', 'Thin',
        'Extra Light', 'Medium', 'Black', 'Heavy',
        'Condensed', 'Extended', 'Narrow'
    ]

    name = display_name.strip()

    # Try to match variant patterns at the end
    for variant in sorted(variant_patterns, key=len, reverse=True):
        if name.endswith(' ' + variant):
            family = name[:-len(' ' + variant)].strip()
            return family, variant

    # No variant found, it's a regular font
    return name, 'Regular'


def get_font_display_name(family: str, variant: str = 'Regular') -> str:
    """Convert family + variant back to display name used by ReportLab."""
    if variant == 'Regular':
        # Special cases for base14
        if family == 'Times' and variant == 'Regular':
            return 'Times-Roman'
        elif family in ['Helvetica', 'Courier', 'Symbol', 'ZapfDingbats']:
            return family
        else:
            return family
    else:
        # For base14 fonts, use hyphen format
        if family in ['Helvetica', 'Times', 'Courier']:
            variant_map = {
                'Bold': 'Bold',
                'Italic': 'Italic' if family == 'Times' else 'Oblique',
                'Oblique': 'Oblique',
                'Bold Italic': 'BoldItalic' if family == 'Times' else 'BoldOblique',
                'Bold Oblique': 'BoldOblique',
                'Roman': 'Roman'
            }
            mapped_variant = variant_map.get(variant, variant.replace(' ', ''))
            return f"{family}-{mapped_variant}"
        else:
            # Asset fonts use space format
            return f"{family} {variant}"
