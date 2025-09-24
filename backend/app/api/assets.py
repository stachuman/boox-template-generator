from fastapi import APIRouter, HTTPException
from typing import List
import sys
from pathlib import Path

# Ensure src is on path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from einkpdf.core.fonts import list_available_fonts
from pathlib import Path as _Path

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/fonts", response_model=List[str])
async def list_fonts() -> List[str]:
    """List available custom fonts (from assets/fonts)."""
    try:
        return list_available_fonts()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list fonts: {e}")
