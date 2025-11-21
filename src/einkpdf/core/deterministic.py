"""
Deterministic PDF post-processing for reproducible builds.

This module ensures PDFs are generated with fixed timestamps and metadata
for consistent testing and version control. Uses pikepdf for metadata control.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

from datetime import datetime
from typing import Optional
from io import BytesIO

import pikepdf
from pikepdf import Pdf

from .schema import Template


class DeterministicError(Exception):
    """Raised when deterministic processing fails."""
    pass


class DeterministicProcessor:
    """Post-processes PDFs to ensure deterministic output."""
    
    # Fixed creation date for deterministic builds (Unix epoch)
    FIXED_CREATION_DATE = datetime(1970, 1, 1, 0, 0, 0)
    
    def __init__(self, template: Template):
        """
        Initialize deterministic processor.
        
        Args:
            template: Template with metadata for PDF properties
        """
        self.template = template
    
    def make_deterministic(self, pdf_bytes: bytes, creation_date: Optional[datetime] = None) -> bytes:
        """
        Make PDF deterministic by fixing timestamps and metadata.
        
        Args:
            pdf_bytes: Input PDF bytes
            creation_date: Fixed creation date (defaults to Unix epoch)
            
        Returns:
            PDF bytes with deterministic properties
            
        Raises:
            DeterministicError: If processing fails
        """
        if creation_date is None:
            creation_date = self.FIXED_CREATION_DATE
            
        try:
            # Open PDF with pikepdf
            pdf = Pdf.open(BytesIO(pdf_bytes))
            
            # Set fixed metadata
            self._set_deterministic_metadata(pdf, creation_date)
            
            # Remove non-deterministic elements
            self._remove_variable_elements(pdf)
            
            # Save to bytes with fixed PDF version
            output_buffer = BytesIO()
            pdf.save(output_buffer, deterministic_id=True, min_version="1.6", force_version="1.6")
            pdf.close()
            
            return output_buffer.getvalue()
            
        except Exception as e:
            raise DeterministicError(f"Failed to make PDF deterministic: {e}") from e
    
    def _set_deterministic_metadata(self, pdf: Pdf, creation_date: datetime) -> None:
        """Set fixed metadata properties."""
        # Create fixed timestamp string in PDF format
        timestamp_str = creation_date.strftime("D:%Y%m%d%H%M%S+00'00'")
        
        # Set traditional PDF Info dictionary (simpler approach)
        if "/Info" not in pdf.Root:
            pdf.Root.Info = pdf.make_indirect({})
            
        info = pdf.Root.Info
        info["/Title"] = self.template.metadata.name
        info["/Subject"] = self.template.metadata.description  
        info["/Author"] = self.template.metadata.author or "E-ink PDF Templates"
        info["/Creator"] = "E-ink PDF Templates v0.7.4"
        info["/Producer"] = "E-ink PDF Templates v0.7.4"
        info["/CreationDate"] = timestamp_str
        info["/ModDate"] = timestamp_str
    
    def _remove_variable_elements(self, pdf: Pdf) -> None:
        """Remove or fix elements that vary between builds."""
        # Remove document ID which contains random elements
        # This helps ensure byte-for-byte reproducibility
        if "/ID" in pdf.trailer:
            del pdf.trailer["/ID"]
        
        # Note: PDF version is read-only in pikepdf, set during save instead


def make_pdf_deterministic(pdf_bytes: bytes, 
                          template: Template,
                          creation_date: Optional[datetime] = None) -> bytes:
    """
    Make PDF deterministic for reproducible builds.
    
    Args:
        pdf_bytes: Input PDF bytes
        template: Template with metadata
        creation_date: Fixed creation date (defaults to Unix epoch)
        
    Returns:
        PDF bytes with deterministic properties
        
    Raises:
        DeterministicError: If processing fails
    """
    processor = DeterministicProcessor(template)
    return processor.make_deterministic(pdf_bytes, creation_date)