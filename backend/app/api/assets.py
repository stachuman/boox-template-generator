from fastapi import APIRouter, HTTPException
from typing import List
import sys
from pathlib import Path

# Ensure src is on path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from einkpdf.core.fonts import KNOWN_FONTS
from pathlib import Path as _Path

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/fonts", response_model=List[str])
async def list_fonts() -> List[str]:
    """List available custom fonts (from assets/fonts)."""
    try:
        base = _Path(__file__).resolve().parents[3] / "src" / "einkpdf" / "assets" / "fonts"
        available = []
        for display, filename in KNOWN_FONTS.items():
            if (base / filename).exists():
                available.append(display)
        # Fallback if none found
        if not available:
            available = ["Helvetica", "Times-Roman", "Courier"]
        return available
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list fonts: {e}")

