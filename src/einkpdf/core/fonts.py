"""
Font registration helpers for ReportLab.

Adds support for optional custom fonts bundled in assets/fonts.
If a requested font is not available, falls back to safe base-14 fonts.
"""

from pathlib import Path
from typing import Optional

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


# Known custom font display name -> TTF filename in assets/fonts
# Contributors: add your new fonts here and drop .ttf files in assets/fonts/
KNOWN_FONTS = {
    # Old typist style
    "Courier-Prime": "CourierPrime-Regular.ttf",
    # Handwritten style
    "Patrick-Hand": "PatrickHand-Regular.ttf",
}


def _assets_font_dir() -> Path:
    # src/einkpdf/core/fonts.py -> assets/fonts/
    return Path(__file__).resolve().parent.parent / "assets" / "fonts"


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

    # Try to register from assets if known
    ttf = KNOWN_FONTS.get(name)
    if ttf:
        font_path = _assets_font_dir() / ttf
        try:
            if font_path.exists():
                pdfmetrics.registerFont(TTFont(name, str(font_path)))
                return name
        except Exception:
            # Fall back below
            pass

    # Fallback: choose a similar base-14 font
    if "Courier" in name:
        return "Courier"
    # Handwritten fallback to Helvetica (clean, legible on e-ink)
    return "Helvetica"
