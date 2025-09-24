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
