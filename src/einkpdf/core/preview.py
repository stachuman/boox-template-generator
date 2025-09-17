"""
Ground truth PDF preview generation using PyMuPDF.

This module provides pixel-perfect PNG preview generation that exactly matches
the final PDF output, ensuring UI preview fidelity. Uses PyMuPDF (AGPL licensed).
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import hashlib
import logging
from io import BytesIO
from typing import Optional, Tuple
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image

from .schema import Template
from .profiles import DeviceProfile
from ..validation.yaml_validator import ValidationError

logger = logging.getLogger(__name__)


class PreviewError(Exception):
    """Raised when preview generation fails."""
    pass


class GroundTruthPreviewer:
    """Generates pixel-perfect PNG previews from PDF bytes using PyMuPDF."""
    
    def __init__(self, cache_dir: Optional[str] = None):
        """
        Initialize previewer with optional caching.
        
        Args:
            cache_dir: Directory for caching previews (None to disable)
        """
        self.cache_dir = Path(cache_dir) if cache_dir else None
        if self.cache_dir:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_preview(self, 
                        pdf_bytes: bytes, 
                        page_number: int = 1, 
                        scale: float = 2.0,
                        profile: Optional[DeviceProfile] = None) -> bytes:
        """
        Generate PNG preview from PDF bytes.
        
        Args:
            pdf_bytes: PDF content bytes
            page_number: Page to preview (1-based)
            scale: Scale factor for preview (2.0 = 200%)
            profile: Device profile for DPI optimization
            
        Returns:
            PNG image bytes
            
        Raises:
            PreviewError: If preview generation fails
        """
        # Generate cache key if caching enabled
        cache_key = None
        if self.cache_dir:
            cache_key = self._generate_cache_key(pdf_bytes, page_number, scale, profile)
            cached_preview = self._get_cached_preview(cache_key)
            if cached_preview:
                return cached_preview
        
        try:
            # Open PDF with PyMuPDF
            pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            if page_number < 1 or page_number > len(pdf_doc):
                raise PreviewError(
                    f"Page {page_number} out of range (PDF has {len(pdf_doc)} pages)"
                )
            
            # Get page
            page = pdf_doc.load_page(page_number - 1)  # 0-based indexing
            
            # Calculate DPI based on profile and scale
            dpi = self._calculate_preview_dpi(profile, scale)
            
            # Generate matrix for scaling
            matrix = fitz.Matrix(scale, scale)
            
            # Render page to pixmap
            pixmap = page.get_pixmap(matrix=matrix)
            
            # Convert to PNG bytes
            png_bytes = pixmap.tobytes("png")
            
            # Clean up
            pixmap = None
            pdf_doc.close()
            
            # Cache result if caching enabled
            if cache_key and self.cache_dir:
                self._cache_preview(cache_key, png_bytes)
            
            return png_bytes
            
        except Exception as e:
            raise PreviewError(f"Failed to generate preview: {e}") from e
    
    def generate_preview_to_file(self, 
                                pdf_bytes: bytes, 
                                output_path: str,
                                page_number: int = 1,
                                scale: float = 2.0,
                                profile: Optional[DeviceProfile] = None) -> None:
        """
        Generate preview and save to file.
        
        Args:
            pdf_bytes: PDF content bytes
            output_path: Output PNG file path
            page_number: Page to preview (1-based)
            scale: Scale factor for preview
            profile: Device profile for DPI optimization
        """
        png_bytes = self.generate_preview(pdf_bytes, page_number, scale, profile)
        
        with open(output_path, 'wb') as f:
            f.write(png_bytes)
    
    def get_page_info(self, pdf_bytes: bytes) -> dict:
        """
        Get information about PDF pages.
        
        Args:
            pdf_bytes: PDF content bytes
            
        Returns:
            Dictionary with page information
            
        Raises:
            PreviewError: If PDF cannot be opened
        """
        try:
            pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            page_info = {
                "page_count": len(pdf_doc),
                "pages": []
            }
            
            for page_num in range(len(pdf_doc)):
                page = pdf_doc.load_page(page_num)
                rect = page.rect
                
                page_info["pages"].append({
                    "page_number": page_num + 1,
                    "width": rect.width,
                    "height": rect.height,
                    "rotation": page.rotation
                })
            
            pdf_doc.close()
            return page_info
            
        except Exception as e:
            raise PreviewError(f"Failed to get page info: {e}") from e
    
    def _calculate_preview_dpi(self, profile: Optional[DeviceProfile], scale: float) -> float:
        """Calculate appropriate DPI for preview generation."""
        base_dpi = 150  # Default DPI for preview
        
        if profile and "ppi" in profile.display:
            # Use device PPI as base for realistic preview
            device_ppi = profile.display["ppi"]
            # Cap at reasonable values for preview
            base_dpi = min(device_ppi, 300)
        
        return base_dpi * scale
    
    def _generate_cache_key(self, 
                           pdf_bytes: bytes, 
                           page_number: int, 
                           scale: float, 
                           profile: Optional[DeviceProfile]) -> str:
        """Generate cache key for preview."""
        # Hash PDF content
        pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()[:16]
        
        # Profile hash
        profile_hash = "none"
        if profile:
            profile_str = f"{profile.name}:{profile.display.get('ppi', 150)}"
            profile_hash = hashlib.sha256(profile_str.encode()).hexdigest()[:8]
        
        # Combine all factors
        cache_key = f"preview_{pdf_hash}_{page_number}_{scale}_{profile_hash}.png"
        return cache_key
    
    def _get_cached_preview(self, cache_key: str) -> Optional[bytes]:
        """Get cached preview if exists."""
        if not self.cache_dir:
            return None
        
        cache_file = self.cache_dir / cache_key
        if cache_file.exists():
            try:
                return cache_file.read_bytes()
            except (OSError, IOError) as e:
                # Cache file corrupted or unreadable, log and continue
                logger.debug(f"Failed to read cache file {cache_file}: {e}")
                return None
            except Exception as e:
                # Unexpected error, log for debugging
                logger.warning(f"Unexpected error reading cache file {cache_file}: {e}")
                return None
        
        return None
    
    def _cache_preview(self, cache_key: str, png_bytes: bytes) -> None:
        """Cache preview PNG bytes."""
        if not self.cache_dir:
            return
        
        cache_file = self.cache_dir / cache_key
        try:
            cache_file.write_bytes(png_bytes)
        except Exception:
            # Cache write failed, ignore
            pass
    
    def clear_cache(self) -> None:
        """Clear all cached previews."""
        if not self.cache_dir or not self.cache_dir.exists():
            return
        
        for cache_file in self.cache_dir.glob("preview_*.png"):
            try:
                cache_file.unlink()
            except Exception:
                pass


def generate_ground_truth_preview(pdf_bytes: bytes,
                                 page_number: int = 1,
                                 scale: float = 2.0,
                                 profile: Optional[DeviceProfile] = None,
                                 cache_dir: Optional[str] = None) -> bytes:
    """
    Generate ground truth preview PNG from PDF bytes.
    
    This function provides the exact preview that matches PDF rendering,
    suitable for server-side preview generation.
    
    Args:
        pdf_bytes: PDF content bytes
        page_number: Page to preview (1-based)
        scale: Scale factor for preview (2.0 = 200%)
        profile: Device profile for DPI optimization
        cache_dir: Cache directory (None to disable caching)
        
    Returns:
        PNG image bytes
        
    Raises:
        PreviewError: If preview generation fails
    """
    previewer = GroundTruthPreviewer(cache_dir)
    return previewer.generate_preview(pdf_bytes, page_number, scale, profile)


def save_ground_truth_preview(pdf_bytes: bytes,
                             output_path: str,
                             page_number: int = 1,
                             scale: float = 2.0,
                             profile: Optional[DeviceProfile] = None,
                             cache_dir: Optional[str] = None) -> None:
    """
    Generate and save ground truth preview to file.
    
    Args:
        pdf_bytes: PDF content bytes
        output_path: Output PNG file path
        page_number: Page to preview (1-based) 
        scale: Scale factor for preview
        profile: Device profile for DPI optimization
        cache_dir: Cache directory (None to disable caching)
        
    Raises:
        PreviewError: If preview generation fails
    """
    previewer = GroundTruthPreviewer(cache_dir)
    previewer.generate_preview_to_file(pdf_bytes, output_path, page_number, scale, profile)