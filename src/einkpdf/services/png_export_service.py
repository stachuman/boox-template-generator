"""
PNG export service for e-ink device templates.

Exports master templates as PNG images at device native resolution.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

from PIL import Image
import pdf2image
import io
from typing import Optional

from ..core.schema import Template
from ..core.profiles import DeviceProfile


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

        # Get device specifications from profile dict
        screen_width, screen_height = device_profile.display["screen_size"]
        ppi = device_profile.display["ppi"]

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

        # Ensure exact device dimensions
        img = self._resize_to_device(img, screen_width, screen_height)

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

        if abs(current_ratio - target_ratio) < 0.01:
            # Aspect ratio matches, just resize
            return img.resize(
                (target_width, target_height),
                Image.Resampling.LANCZOS
            )

        # Aspect ratio mismatch - resize and center on white canvas
        # This handles cases where PDF page size doesn't match device exactly

        # Scale to fit within target dimensions
        scale = min(
            target_width / current_width,
            target_height / current_height
        )
        new_width = int(current_width * scale)
        new_height = int(current_height * scale)

        img_resized = img.resize(
            (new_width, new_height),
            Image.Resampling.LANCZOS
        )

        # Create white canvas at exact device size
        canvas = Image.new('RGB', (target_width, target_height), 'white')

        # Center the resized image
        offset_x = (target_width - new_width) // 2
        offset_y = (target_height - new_height) // 2
        canvas.paste(img_resized, (offset_x, offset_y))

        return canvas
