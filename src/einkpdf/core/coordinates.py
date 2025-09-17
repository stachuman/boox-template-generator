"""
Coordinate system conversion between UI (top-left) and PDF (bottom-left).

This module handles the fundamental coordinate transformation between the
template YAML format (top-left origin) and ReportLab PDF (bottom-left origin).
Follows CLAUDE.md coding standards - no dummy implementations.
"""

from typing import Tuple, List, Dict, Any
from ..core.schema import Position


class CoordinateConverter:
    """Converts coordinates between top-left (YAML) and bottom-left (PDF) systems."""
    
    def __init__(self, page_height: float):
        """
        Initialize coordinate converter.
        
        Args:
            page_height: Page height in points (e.g., 841.8 for A4)
        """
        if page_height <= 0:
            raise ValueError(f"Page height must be positive, got {page_height}")
        
        self.page_height = page_height
    
    def top_left_to_bottom_left(self, x: float, y: float) -> Tuple[float, float]:
        """
        Convert top-left coordinates to bottom-left (PDF coordinates).
        
        Args:
            x: X coordinate (unchanged - left is always 0)
            y: Y coordinate from top edge
            
        Returns:
            Tuple of (pdf_x, pdf_y) where pdf_y is from bottom edge
        """
        pdf_x = x  # X coordinate remains the same
        pdf_y = self.page_height - y  # Flip Y coordinate
        return pdf_x, pdf_y
    
    def bottom_left_to_top_left(self, pdf_x: float, pdf_y: float) -> Tuple[float, float]:
        """
        Convert bottom-left (PDF) coordinates to top-left coordinates.
        
        Args:
            pdf_x: X coordinate from left edge
            pdf_y: Y coordinate from bottom edge
            
        Returns:
            Tuple of (x, y) where y is from top edge
        """
        x = pdf_x  # X coordinate remains the same
        y = self.page_height - pdf_y  # Flip Y coordinate
        return x, y
    
    def convert_position(self, position: Position) -> Dict[str, float]:
        """
        Convert Position object from top-left to bottom-left coordinates.
        
        Args:
            position: Position with top-left coordinates
            
        Returns:
            Dictionary with PDF coordinates: {x, y, width, height}
            Note: Y coordinate is converted to bottom-left reference
        """
        pdf_x, pdf_y = self.top_left_to_bottom_left(position.x, position.y)
        
        return {
            "x": pdf_x,
            "y": pdf_y,  # This is now the BOTTOM edge of the element
            "width": position.width,
            "height": position.height
        }
    
    def convert_position_for_drawing(self, position: Position) -> Dict[str, float]:
        """
        Convert Position for ReportLab drawing operations.
        
        ReportLab draws from the bottom-left corner of shapes, so we need
        to adjust the Y coordinate to position the shape correctly.
        
        Args:
            position: Position with top-left coordinates
            
        Returns:
            Dictionary with ReportLab drawing coordinates
        """
        # Convert top-left corner to bottom-left coordinate system
        pdf_x, top_edge_y = self.top_left_to_bottom_left(position.x, position.y)
        
        # For ReportLab drawing, we need the bottom edge of the element
        # since that's where ReportLab positions shapes
        bottom_edge_y = top_edge_y - position.height
        
        return {
            "x": pdf_x,
            "y": bottom_edge_y,  # Bottom edge for ReportLab drawing
            "width": position.width,
            "height": position.height
        }
    
    def convert_text_position(self, position: Position, font_size: float) -> Dict[str, float]:
        """
        Convert Position for ReportLab text drawing.
        
        ReportLab positions text at the baseline, which is roughly at the
        bottom of the text height. We need to adjust for this.
        
        Args:
            position: Position with top-left coordinates
            font_size: Font size in points for baseline calculation
            
        Returns:
            Dictionary with text drawing coordinates
        """
        pdf_x, top_edge_y = self.top_left_to_bottom_left(position.x, position.y)
        
        # Center text vertically to match UI behavior (flex items-center)
        # ReportLab positions text at baseline, so we need to account for that
        # Position baseline at the vertical center minus descender offset
        vertical_center = top_edge_y - (position.height / 2)
        descender_offset = font_size * 0.2  # Typical descender height
        text_y = vertical_center - descender_offset
        
        return {
            "x": pdf_x,
            "y": text_y,  # Y position for text baseline
            "width": position.width,
            "height": position.height
        }


def create_converter_for_canvas(canvas_dimensions: Dict[str, Any]) -> CoordinateConverter:
    """
    Create coordinate converter from canvas dimensions.
    
    Args:
        canvas_dimensions: Canvas dimensions dict with width, height, margins
        
    Returns:
        CoordinateConverter instance
        
    Raises:
        ValueError: If dimensions are invalid
    """
    if not isinstance(canvas_dimensions, dict):
        raise ValueError("Canvas dimensions must be a dictionary")
    
    if "height" not in canvas_dimensions:
        raise ValueError("Canvas dimensions must include 'height'")
    
    height = canvas_dimensions["height"]
    if not isinstance(height, (int, float)) or height <= 0:
        raise ValueError(f"Canvas height must be positive number, got {height}")
    
    return CoordinateConverter(height)


def batch_convert_positions(positions: List[Position], page_height: float) -> List[Dict[str, float]]:
    """
    Convert multiple positions efficiently.
    
    Args:
        positions: List of Position objects to convert
        page_height: Page height in points
        
    Returns:
        List of converted position dictionaries
    """
    converter = CoordinateConverter(page_height)
    return [converter.convert_position_for_drawing(pos) for pos in positions]