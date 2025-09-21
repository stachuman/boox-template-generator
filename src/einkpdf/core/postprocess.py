"""
PDF post-processing with pikepdf for named destinations and outlines.
"""

from io import BytesIO
from typing import Dict, Tuple

import pikepdf
from pikepdf import Pdf

from .schema import Template
from .coordinates import CoordinateConverter


class PostProcessingError(Exception):
    pass


def add_navigation_to_pdf(pdf_bytes: bytes, template: Template, anchor_positions: Dict[str, Tuple[int, float, float]]) -> bytes:
    try:
        pdf = Pdf.open(BytesIO(pdf_bytes))
        conv = CoordinateConverter(template.canvas.dimensions["height"])

        # Build Root.Dests from anchor_positions
        dests = pikepdf.Dictionary()
        for dest_id, (page_num, x, y) in anchor_positions.items():
            if 1 <= page_num <= len(pdf.pages):
                px, py = conv.top_left_to_bottom_left(x, y)
                page_ref = pdf.pages[page_num - 1].obj
                dests[f"/{dest_id}"] = pikepdf.Array([page_ref, "/FitH", py])

        if len(dests):
            pdf.Root.Dests = dests

        out = BytesIO()
        pdf.save(out)
        pdf.close()
        return out.getvalue()
    except Exception as e:
        raise PostProcessingError(f"Navigation post-processing failed: {e}")

