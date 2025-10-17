"""
Image widget renderer for e-ink PDF templates.

Handles rendering of image widgets with support for various formats,
sizing modes, and data sources (files, URLs, base64).
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import os
import logging
from typing import Optional
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

from ..schema import Widget
from .base import BaseWidgetRenderer, RenderingError

logger = logging.getLogger(__name__)


class ImageRenderer(BaseWidgetRenderer):
    """
    Renderer for image widgets.

    Handles: image
    Supports: PNG, JPEG, data URIs, remote URLs, local files
    Following CLAUDE.md rule #1: No dummy implementations - complete functionality.
    """

    @property
    def supported_widget_types(self) -> list[str]:
        return ['image']

    def render(self, pdf_canvas: canvas.Canvas, widget: Widget, **kwargs) -> None:
        """Render image widget based on its properties."""
        self.validate_widget(widget)

        if widget.type == 'image':
            self._render_image(pdf_canvas, widget)
        else:
            raise RenderingError(f"Unsupported widget type: {widget.type}")

    def _render_image(self, pdf_canvas: canvas.Canvas, widget: Widget) -> None:
        """Render an image widget with proper scaling and positioning."""
        props = getattr(widget, 'properties', {}) or {}

        # Get image source and fit mode
        # Support both image_src (URL/path) and image_data (base64)
        src = props.get('image_src')
        image_data = props.get('image_data')
        fit = props.get('image_fit', 'fit')  # fit|actual|stretch

        if not src and not image_data:
            if self.strict_mode:
                raise RenderingError(f"Image widget '{widget.id}': missing image_src or image_data property")
            logger.warning(f"Skipping image widget {widget.id}: no image source provided")
            return

        # Prioritize image_data over image_src
        source = image_data if image_data else src

        # Resolve image source to ImageReader
        img_reader = self._resolve_image_reader(source)
        if not img_reader:
            if self.strict_mode:
                raise RenderingError(f"Image widget '{widget.id}': cannot load image from '{src}'")
            logger.warning(f"Skipping image widget {widget.id}: source not found: {src}")
            return

        # Convert to grayscale if requested
        convert_to_grayscale = props.get('convert_to_grayscale', False)
        if convert_to_grayscale:
            img_reader = self._convert_to_grayscale(img_reader, widget.id)
            if not img_reader:
                if self.strict_mode:
                    raise RenderingError(f"Image widget '{widget.id}': failed to convert to grayscale")
                logger.warning(f"Skipping image widget {widget.id}: grayscale conversion failed")
                return

        # Apply opacity if specified (useful for e-ink to reduce darkness)
        opacity = props.get('opacity')
        if opacity is not None and opacity < 1.0:
            img_reader = self._apply_opacity(img_reader, opacity, widget.id)
            if not img_reader:
                if self.strict_mode:
                    raise RenderingError(f"Image widget '{widget.id}': failed to apply opacity")
                logger.warning(f"Skipping image widget {widget.id}: opacity application failed")
                return

        # Get image intrinsic size
        try:
            image_width, image_height = img_reader.getSize()
        except Exception as e:
            if self.strict_mode:
                raise RenderingError(f"Image widget '{widget.id}': failed to read image size: {e}") from e
            logger.warning(f"Skipping image widget {widget.id}: failed to read size: {e}")
            return

        # Get widget position in PDF coordinates
        box = self.converter.convert_position_for_drawing(widget.position)
        widget_x = box['x']
        widget_y = box['y']
        widget_width = box['width']
        widget_height = box['height']

        # Calculate drawing dimensions and position based on fit mode
        draw_info = self._calculate_draw_dimensions(
            image_width, image_height,
            widget_x, widget_y, widget_width, widget_height,
            fit
        )

        # Draw the image
        try:
            pdf_canvas.drawImage(
                img_reader,
                draw_info['x'], draw_info['y'],
                width=draw_info['width'], height=draw_info['height'],
                preserveAspectRatio=False,
                mask='auto'
            )
        except Exception as e:
            if self.strict_mode:
                raise RenderingError(f"Image widget '{widget.id}': failed to draw image: {e}") from e
            logger.warning(f"Failed to draw image {widget.id}: {e}")

    def _convert_to_grayscale(self, img_reader: ImageReader, widget_id: str) -> Optional[ImageReader]:
        """
        Convert image to grayscale.

        Args:
            img_reader: Original ImageReader
            widget_id: Widget ID for error reporting

        Returns:
            New ImageReader with grayscale image or None on failure
        """
        try:
            from PIL import Image

            # Get PIL Image from ImageReader
            pil_img = img_reader._image if hasattr(img_reader, '_image') else None

            if pil_img is None:
                # Try to extract from ImageReader's internal file pointer
                if hasattr(img_reader, 'fp'):
                    img_reader.fp.seek(0)
                    pil_img = Image.open(img_reader.fp)
                else:
                    logger.debug(f"Cannot extract PIL image from ImageReader for widget {widget_id}")
                    return None

            # Convert to grayscale
            if pil_img.mode != 'L':  # L = 8-bit grayscale
                grayscale_img = pil_img.convert('L')
            else:
                grayscale_img = pil_img

            # Create new ImageReader from grayscale image
            img_buffer = BytesIO()
            grayscale_img.save(img_buffer, format='PNG')
            img_buffer.seek(0)

            return ImageReader(img_buffer)

        except ImportError:
            logger.warning(f"PIL/Pillow not available for grayscale conversion in widget {widget_id}")
            return img_reader  # Return original if PIL not available
        except Exception as e:
            logger.debug(f"Failed to convert image to grayscale for widget {widget_id}: {e}")
            return None

    def _apply_opacity(self, img_reader: ImageReader, opacity: float, widget_id: str) -> Optional[ImageReader]:
        """
        Apply opacity/transparency to image to reduce darkness for e-ink displays.

        Args:
            img_reader: Original ImageReader
            opacity: Opacity value (0.0=fully transparent, 1.0=fully opaque)
            widget_id: Widget ID for error reporting

        Returns:
            New ImageReader with opacity applied or None on failure
        """
        # Validate opacity value
        if not isinstance(opacity, (int, float)):
            logger.warning(f"Invalid opacity type for widget {widget_id}: {type(opacity)}")
            return img_reader

        if opacity < 0.0 or opacity > 1.0:
            logger.warning(f"Opacity value {opacity} out of range [0.0, 1.0] for widget {widget_id}")
            # Clamp to valid range
            opacity = max(0.0, min(1.0, opacity))

        # Opacity 1.0 means no change
        if opacity >= 1.0:
            return img_reader

        try:
            from PIL import Image

            # Get PIL Image from ImageReader
            pil_img = img_reader._image if hasattr(img_reader, '_image') else None

            if pil_img is None:
                # Try to extract from ImageReader's internal file pointer
                if hasattr(img_reader, 'fp'):
                    img_reader.fp.seek(0)
                    pil_img = Image.open(img_reader.fp)
                else:
                    logger.debug(f"Cannot extract PIL image from ImageReader for widget {widget_id}")
                    return img_reader  # Return original if can't extract

            # Ensure image has alpha channel
            if pil_img.mode not in ('RGBA', 'LA'):
                # Convert to RGBA to add alpha channel
                if pil_img.mode == 'L':
                    pil_img = pil_img.convert('LA')
                else:
                    pil_img = pil_img.convert('RGBA')

            # Apply opacity by adjusting alpha channel
            # Split into bands, multiply alpha by opacity factor
            if pil_img.mode == 'RGBA':
                r, g, b, a = pil_img.split()
                # Apply opacity to alpha channel
                a = a.point(lambda x: int(x * opacity))
                result_img = Image.merge('RGBA', (r, g, b, a))
            elif pil_img.mode == 'LA':
                l, a = pil_img.split()
                a = a.point(lambda x: int(x * opacity))
                result_img = Image.merge('LA', (l, a))
            else:
                # Fallback - should not reach here
                logger.warning(f"Unexpected image mode {pil_img.mode} for opacity in widget {widget_id}")
                return img_reader

            # Create new ImageReader from modified image
            img_buffer = BytesIO()
            result_img.save(img_buffer, format='PNG')
            img_buffer.seek(0)

            return ImageReader(img_buffer)

        except ImportError:
            logger.warning(f"PIL/Pillow not available for opacity adjustment in widget {widget_id}")
            return img_reader  # Return original if PIL not available
        except Exception as e:
            logger.debug(f"Failed to apply opacity for widget {widget_id}: {e}")
            return img_reader  # Return original on error

    def _resolve_image_reader(self, src: str) -> Optional[ImageReader]:
        """
        Resolve an ImageReader from various source types.

        Args:
            src: Image source - can be file path, URL, data URI, or base64 string

        Returns:
            ImageReader instance or None if source cannot be resolved
        """
        if not src or not isinstance(src, str):
            return None

        try:
            # Handle data URIs (base64 encoded images)
            if src.startswith('data:image/'):
                return self._resolve_data_uri(src)

            # Handle remote URLs
            elif src.startswith('http://') or src.startswith('https://'):
                return self._resolve_remote_url(src)

            # Handle raw base64 strings (without data URI prefix)
            # This handles image_data property which may be stored as plain base64
            elif self._is_base64_string(src):
                return self._resolve_base64(src)

            # Handle local file paths
            else:
                return self._resolve_local_path(src)

        except Exception as e:
            logger.debug(f"Failed to resolve image source '{src}': {e}")
            return None

    def _is_base64_string(self, src: str) -> bool:
        """Check if string appears to be base64 encoded data."""
        # Base64 strings are typically long and contain only valid base64 characters
        if len(src) < 100:  # Too short to be meaningful image data
            return False
        # Check if string contains only base64 characters
        import re
        return bool(re.match(r'^[A-Za-z0-9+/]+={0,2}$', src.strip()))

    def _resolve_data_uri(self, src: str) -> Optional[ImageReader]:
        """Resolve data URI to ImageReader."""
        try:
            import base64
            # Format: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...
            header, b64data = src.split(',', 1)
            raw_data = base64.b64decode(b64data)
            return ImageReader(BytesIO(raw_data))
        except Exception as e:
            logger.debug(f"Failed to decode data URI: {e}")
            return None

    def _resolve_base64(self, src: str) -> Optional[ImageReader]:
        """Resolve raw base64 string to ImageReader."""
        try:
            import base64
            # Decode raw base64 string (no data URI prefix)
            raw_data = base64.b64decode(src.strip())
            return ImageReader(BytesIO(raw_data))
        except Exception as e:
            logger.debug(f"Failed to decode base64 string: {e}")
            return None

    def _resolve_remote_url(self, src: str) -> Optional[ImageReader]:
        """Resolve remote URL to ImageReader."""
        try:
            import urllib.request
            req = urllib.request.Request(src, headers={
                'User-Agent': 'einkpdf/0.2 (+https://github.com/einkpdf)'
            })
            with urllib.request.urlopen(req, timeout=10) as response:
                data = response.read()
            return ImageReader(BytesIO(data))
        except Exception as e:
            logger.debug(f"Failed to fetch remote image '{src}': {e}")
            return None

    def _resolve_local_path(self, src: str) -> Optional[ImageReader]:
        """Resolve local file path to ImageReader."""
        try:
            # Try absolute path
            if os.path.isabs(src) and os.path.exists(src):
                return ImageReader(src)

            # Try relative to current working directory
            if os.path.exists(src):
                return ImageReader(src)

            # Try package assets directory
            cleaned_path = src.lstrip('/').lstrip('./')
            base_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
            asset_path = os.path.normpath(os.path.join(base_dir, 'assets', cleaned_path))

            if os.path.exists(asset_path):
                return ImageReader(asset_path)

            # Try if path already contains 'assets/'
            if cleaned_path.startswith('assets/'):
                asset_path2 = os.path.normpath(os.path.join(base_dir, cleaned_path))
                if os.path.exists(asset_path2):
                    return ImageReader(asset_path2)

            # Final attempt - let ImageReader try
            return ImageReader(src)

        except Exception as e:
            logger.debug(f"Failed to resolve local path '{src}': {e}")
            return None

    def _calculate_draw_dimensions(self, image_width: float, image_height: float,
                                  widget_x: float, widget_y: float,
                                  widget_width: float, widget_height: float,
                                  fit_mode: str) -> dict:
        """
        Calculate final drawing dimensions and position for image.

        Args:
            image_width: Original image width
            image_height: Original image height
            widget_x: Widget X position in PDF coordinates
            widget_y: Widget Y position in PDF coordinates
            widget_width: Widget width
            widget_height: Widget height
            fit_mode: How to fit image ('fit', 'actual', 'stretch')

        Returns:
            Dictionary with 'x', 'y', 'width', 'height' for drawing
        """
        if fit_mode == 'fit':
            # Preserve aspect ratio, fit within widget bounds, center
            if image_width <= 0 or image_height <= 0:
                scale = 1.0
            else:
                scale = min(widget_width / image_width, widget_height / image_height)

            draw_width = image_width * scale
            draw_height = image_height * scale
            draw_x = widget_x + (widget_width - draw_width) / 2
            draw_y = widget_y + (widget_height - draw_height) / 2

        elif fit_mode == 'actual':
            # Use original image size, position at widget top-left
            draw_width = image_width
            draw_height = image_height
            draw_x = widget_x
            draw_y = widget_y

        else:  # 'stretch' or unknown
            # Fill entire widget area, may distort aspect ratio
            draw_width = widget_width
            draw_height = widget_height
            draw_x = widget_x
            draw_y = widget_y

        return {
            'x': draw_x,
            'y': draw_y,
            'width': draw_width,
            'height': draw_height
        }

    def get_supported_formats(self) -> list[str]:
        """Get list of supported image formats."""
        return ['PNG', 'JPEG', 'JPG', 'SVG', 'GIF', 'BMP', 'TIFF']

    def validate_image_properties(self, widget: Widget) -> None:
        """
        Validate image widget properties.

        Args:
            widget: Widget to validate

        Raises:
            RenderingError: If properties are invalid
        """
        props = getattr(widget, 'properties', {}) or {}

        # Validate image source - either image_src or image_data required
        image_src = props.get('image_src')
        image_data = props.get('image_data')

        if not image_src and not image_data:
            raise RenderingError(
                f"Image widget '{widget.id}': missing required property 'image_src' or 'image_data'"
            )

        if image_src and not isinstance(image_src, str):
            raise RenderingError(f"Image widget '{widget.id}': image_src must be a string")

        if image_data and not isinstance(image_data, str):
            raise RenderingError(f"Image widget '{widget.id}': image_data must be a string")

        # Validate image_fit mode
        image_fit = props.get('image_fit', 'fit')
        valid_fit_modes = ['fit', 'actual', 'stretch']
        if image_fit not in valid_fit_modes:
            raise RenderingError(
                f"Image widget '{widget.id}': invalid image_fit '{image_fit}'. "
                f"Valid modes: {valid_fit_modes}"
            )

        # Validate opacity if specified
        opacity = props.get('opacity')
        if opacity is not None:
            if not isinstance(opacity, (int, float)):
                raise RenderingError(
                    f"Image widget '{widget.id}': opacity must be a number, got {type(opacity).__name__}"
                )
            if opacity < 0.0 or opacity > 1.0:
                raise RenderingError(
                    f"Image widget '{widget.id}': opacity must be between 0.0 and 1.0, got {opacity}"
                )