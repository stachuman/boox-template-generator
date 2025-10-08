"""
PNG export service for e-ink device templates.

Exports master templates as PNG images at device native resolution.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

from PIL import Image
import pdf2image
import io
import logging
from typing import Optional

from ..core.schema import Template
from ..core.profiles import DeviceProfile, get_png_target_dimensions

logger = logging.getLogger(__name__)


class PNGExportError(Exception):
    """Raised when PNG export operations fail."""
    pass


class PNGExportService:
    """Service for exporting templates as PNG images."""

    def export_template_to_png(
        self,
        pdf_bytes: bytes,
        device_profile: DeviceProfile
    ) -> bytes:
        """
        Export PDF bytes as PNG at device resolution.

        Converts a single-page PDF to PNG at the device's native resolution,
        suitable for use as a reusable template on e-ink devices like
        reMarkable, Supernote, or Boox.

        Uses centralized orientation-aware dimension calculation from
        core.profiles.get_png_target_dimensions().

        Args:
            pdf_bytes: PDF file bytes (single page)
            device_profile: Target device profile for dimensions/PPI

        Returns:
            PNG image bytes optimized for the device

        Raises:
            PNGExportError: If conversion fails or dependencies missing
        """
        if not pdf_bytes:
            raise PNGExportError("PDF bytes cannot be empty")

        # Get device PPI and target dimensions (orientation-aware)
        try:
            ppi = device_profile.display["ppi"]
            target_width, target_height = get_png_target_dimensions(device_profile)
        except Exception as e:
            raise PNGExportError(f"Invalid device profile settings: {e}")

        # Convert PDF to PNG using pdf2image (poppler)
        try:
            images = pdf2image.convert_from_bytes(
                pdf_bytes,
                dpi=ppi,  # Use device PPI for correct resolution
                first_page=1,
                last_page=1,
                fmt='png'
            )
        except Exception as e:
            raise PNGExportError(
                f"PDF to PNG conversion failed. Is poppler-utils installed? "
                f"Error: {e}"
            )

        if not images:
            raise PNGExportError("No image generated from PDF")

        img = images[0]

        # Log dimensions for debugging
        logger.info(f"PNG Export: PDF rendered at {ppi} PPI → {img.size[0]}×{img.size[1]} px")
        logger.info(f"PNG Export: Target dimensions → {target_width}×{target_height} px")

        # Ensure exact target dimensions (respecting orientation)
        img = self._resize_to_device(img, target_width, target_height)
        logger.info(f"PNG Export: Final dimensions → {img.size[0]}×{img.size[1]} px")

        # Convert to optimized PNG bytes
        img_bytes = io.BytesIO()
        img.save(
            img_bytes,
            format='PNG',
            optimize=True,
            dpi=(ppi, ppi)  # Embed DPI metadata for reference
        )

        return img_bytes.getvalue()

    def _resize_to_device(
        self,
        img: Image.Image,
        target_width: int,
        target_height: int
    ) -> Image.Image:
        """
        Resize/crop image to exact device dimensions.

        E-ink devices are strict about template dimensions.
        This ensures the PNG matches the device screen exactly.

        Args:
            img: Source image
            target_width: Target width in pixels
            target_height: Target height in pixels

        Returns:
            Image resized to exact dimensions
        """
        current_width, current_height = img.size

        # If already correct size, return as-is
        if current_width == target_width and current_height == target_height:
            return img

        # Calculate aspect ratios
        target_ratio = target_width / target_height
        current_ratio = current_width / current_height

        logger.debug(f"Resize: current={current_width}×{current_height} (ratio={current_ratio:.4f}), "
                    f"target={target_width}×{target_height} (ratio={target_ratio:.4f})")

        if abs(current_ratio - target_ratio) < 0.01:
            # Aspect ratio matches, just resize
            logger.debug(f"Resize: Aspect ratios match, direct resize")
            return img.resize(
                (target_width, target_height),
                Image.Resampling.LANCZOS
            )

        # Aspect ratio mismatch - resize and center on white canvas
        # This handles cases where PDF page size doesn't match device exactly
        logger.warning(f"Resize: Aspect ratio mismatch (diff={abs(current_ratio - target_ratio):.4f}), adding padding")

        # Scale to fit within target dimensions
        scale = min(
            target_width / current_width,
            target_height / current_height
        )
        new_width = int(current_width * scale)
        new_height = int(current_height * scale)

        logger.debug(f"Resize: Scaling by {scale:.4f} → {new_width}×{new_height}")

        img_resized = img.resize(
            (new_width, new_height),
            Image.Resampling.LANCZOS
        )

        # Create white canvas at exact device size
        canvas = Image.new('RGB', (target_width, target_height), 'white')

        # Center the resized image
        offset_x = (target_width - new_width) // 2
        offset_y = (target_height - new_height) // 2
        logger.debug(f"Resize: Centering with offset ({offset_x}, {offset_y})")
        canvas.paste(img_resized, (offset_x, offset_y))

        return canvas
