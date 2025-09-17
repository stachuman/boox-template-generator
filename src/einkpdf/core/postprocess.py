"""
PDF post-processing with pikepdf for outlines, destinations, and links.

This module handles the post-processing phase of PDF generation using pikepdf
to add navigation features that ReportLab doesn't support directly.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

from typing import Dict, List, Tuple, Optional
from io import BytesIO

import pikepdf
from pikepdf import Pdf, OutlineItem as PikePDFOutlineItem

from .schema import Template, NamedDestination, OutlineItem, InternalLink
from .coordinates import CoordinateConverter
from ..validation.yaml_validator import ValidationError


class PostProcessingError(Exception):
    """Raised when PDF post-processing fails."""
    pass


class NavigationPostProcessor:
    """Post-processes PDF to add navigation features using pikepdf."""
    
    def __init__(self, template: Template):
        """
        Initialize post-processor.
        
        Args:
            template: Template with navigation configuration
        """
        self.template = template
        self.converter = CoordinateConverter(template.canvas.dimensions["height"])
        
    def add_navigation(self, pdf_bytes: bytes, anchor_positions: Dict[str, Tuple[int, float, float]]) -> bytes:
        """
        Add navigation features to PDF.
        
        Args:
            pdf_bytes: Input PDF bytes from ReportLab
            anchor_positions: Collected anchor positions from renderer
            
        Returns:
            PDF bytes with navigation added
            
        Raises:
            PostProcessingError: If post-processing fails
        """
        try:
            # Open PDF with pikepdf
            pdf = Pdf.open(BytesIO(pdf_bytes))
            
            # Add named destinations
            self._add_named_destinations(pdf, anchor_positions)
            
            # Add outlines/bookmarks
            self._add_outlines(pdf)
            
            # Add internal links
            self._add_internal_links(pdf, anchor_positions)
            
            # Save to bytes
            output_buffer = BytesIO()
            pdf.save(output_buffer)
            pdf.close()
            
            return output_buffer.getvalue()
            
        except Exception as e:
            raise PostProcessingError(f"Navigation post-processing failed: {e}") from e
    
    def _add_named_destinations(self, pdf: Pdf, anchor_positions: Dict[str, Tuple[int, float, float]]) -> None:
        """Add named destinations to PDF."""
        if not self.template.navigation.named_destinations:
            return
            
        # Create destinations dictionary
        destinations = {}
        
        for dest in self.template.navigation.named_destinations:
            if dest.id in anchor_positions:
                page_num, x, y = anchor_positions[dest.id]
                
                # Convert coordinates to PDF coordinate system
                pdf_x, pdf_y = self.converter.top_left_to_bottom_left(x, y)
                
                # Get page object reference
                page_ref = pdf.pages[page_num - 1].obj
                
                # Create destination array based on fit mode
                if dest.fit.value == "FitH":
                    # Fit horizontally with specified top position
                    dest_array = [page_ref, "/FitH", pdf_y]
                elif dest.fit.value == "Fit":
                    # Fit entire page
                    dest_array = [page_ref, "/Fit"]
                elif dest.fit.value == "XYZ":
                    # Exact position with inherit zoom
                    dest_array = [page_ref, "/XYZ", pdf_x, pdf_y, None]
                else:
                    # Default to FitH
                    dest_array = [page_ref, "/FitH", pdf_y]
                
                destinations[dest.id] = dest_array
        
        # Add destinations to PDF
        if destinations:
            # Create destinations dictionary as pikepdf objects
            dest_dict = {}
            for key, value in destinations.items():
                # Convert list to pikepdf Array
                dest_dict["/" + key] = pikepdf.Array(value)
            pdf.Root.Dests = pikepdf.Dictionary(dest_dict)
    
    def _add_outlines(self, pdf: Pdf) -> None:
        """Add outline/bookmark tree to PDF.""" 
        if not self.template.navigation.outlines:
            return
            
        # Create outline items
        outline_items = []
        
        for outline in self.template.navigation.outlines:
            try:
                # Create pikepdf outline item
                item = PikePDFOutlineItem(
                    title=outline.title,
                    destination=outline.dest
                )
                outline_items.append(item)
                
            except Exception as e:
                # Skip invalid outline items in non-strict mode
                print(f"Warning: Skipping invalid outline '{outline.title}': {e}")
                continue
        
        if outline_items:
            # Set outline root
            with pdf.open_outline() as outline:
                outline.root.extend(outline_items)
    
    def _add_internal_links(self, pdf: Pdf, anchor_positions: Dict[str, Tuple[int, float, float]]) -> None:
        """Add internal link annotations to PDF."""
        if not self.template.navigation.links:
            return
            
        # Group links by page based on source widget positions
        links_by_page = self._group_links_by_page(anchor_positions)
        
        for page_num, page_links in links_by_page.items():
            if page_num <= len(pdf.pages):
                page = pdf.pages[page_num - 1]
                
                # Ensure page has Annots array
                if "/Annots" not in page:
                    page.Annots = pdf.make_indirect([])
                
                # Add link annotations for this page
                for link in page_links:
                    self._add_link_annotation(pdf, page, link, anchor_positions)
    
    def _group_links_by_page(self, anchor_positions: Dict[str, Tuple[int, float, float]]) -> Dict[int, List[InternalLink]]:
        """Group internal links by the page of their source widget."""
        links_by_page = {}
        
        for link in self.template.navigation.links:
            # Find source widget to determine page
            source_widget = None
            for widget in self.template.widgets:
                if widget.id == link.from_widget:
                    source_widget = widget
                    break
            
            if source_widget:
                page_num = getattr(source_widget, 'page', 1)
                if page_num not in links_by_page:
                    links_by_page[page_num] = []
                links_by_page[page_num].append(link)
        
        return links_by_page
    
    def _add_link_annotation(self, pdf: Pdf, page: pikepdf.Page, link: InternalLink, 
                           anchor_positions: Dict[str, Tuple[int, float, float]]) -> None:
        """Add a single link annotation to a page."""
        # Find source widget position
        source_widget = None
        for widget in self.template.widgets:
            if widget.id == link.from_widget:
                source_widget = widget
                break
        
        if not source_widget:
            return
        
        # Calculate link rectangle with padding
        padding = link.padding
        link_rect = self._calculate_link_rectangle(source_widget, padding)
        
        # Find target destination
        target_dest = None
        for dest in self.template.navigation.named_destinations:
            if dest.id == link.to_dest:
                target_dest = dest
                break
        
        if not target_dest or target_dest.id not in anchor_positions:
            return
        
        # Get target position
        target_page, target_x, target_y = anchor_positions[target_dest.id]
        target_pdf_x, target_pdf_y = self.converter.top_left_to_bottom_left(target_x, target_y)
        
        # Create link annotation
        link_annotation = {
            "/Type": "/Annot",
            "/Subtype": "/Link",
            "/Rect": link_rect,
            "/Dest": [pdf.pages[target_page - 1], "/FitH", target_pdf_y],
            "/H": "/I",  # Highlight mode: invert
            "/Border": [0, 0, 0],  # No border
        }
        
        # Add annotation to page
        page.Annots.append(pdf.make_indirect(link_annotation))
    
    def _calculate_link_rectangle(self, widget, padding: float) -> List[float]:
        """Calculate link rectangle in PDF coordinates with padding."""
        # Convert widget position to PDF coordinates  
        pdf_pos = self.converter.convert_position_for_drawing(widget.position)
        
        # Add padding and create rectangle [left, bottom, right, top]
        left = pdf_pos['x'] - padding
        bottom = pdf_pos['y'] - padding
        right = pdf_pos['x'] + pdf_pos['width'] + padding
        top = pdf_pos['y'] + pdf_pos['height'] + padding
        
        return [left, bottom, right, top]


def add_navigation_to_pdf(pdf_bytes: bytes, 
                         template: Template,
                         anchor_positions: Dict[str, Tuple[int, float, float]]) -> bytes:
    """
    Add navigation features to rendered PDF.
    
    Args:
        pdf_bytes: PDF bytes from ReportLab renderer
        template: Template with navigation configuration
        anchor_positions: Anchor positions collected during rendering
        
    Returns:
        PDF bytes with navigation added
        
    Raises:
        PostProcessingError: If post-processing fails
    """
    processor = NavigationPostProcessor(template)
    return processor.add_navigation(pdf_bytes, anchor_positions)