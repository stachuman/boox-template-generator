"""
Composite widget renderer for e-ink PDF templates.

Handles rendering of composite widgets that generate multiple sub-widgets,
specifically link_list widgets that expand into multiple internal_link widgets.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import logging
import math
from typing import Dict, Any, List
from reportlab.pdfgen import canvas

from ..schema import Widget, Position
from .base import BaseWidgetRenderer, RenderingError
from .link_renderer import LinkRenderer
from ..tokens import TokenProcessor, RenderingTokenContext

logger = logging.getLogger(__name__)


class CompositeRenderer(BaseWidgetRenderer):
    """
    Renderer for composite widgets.

    Handles: link_list
    Features: Dynamic widget generation, layout calculations, delegation to LinkRenderer
    Following CLAUDE.md rule #1: No dummy implementations - complete functionality.
    """

    def __init__(self, converter, strict_mode: bool = False):
        """Initialize composite renderer with LinkRenderer for delegation."""
        super().__init__(converter, strict_mode)
        self.link_renderer = LinkRenderer(converter, strict_mode)

    @property
    def supported_widget_types(self) -> list[str]:
        return ['link_list']

    def render(self, pdf_canvas: canvas.Canvas, widget: Widget, **kwargs) -> None:
        """Render composite widget based on its type."""
        self.validate_widget(widget)

        if widget.type == 'link_list':
            self._render_link_list(pdf_canvas, widget, **kwargs)
        else:
            raise RenderingError(f"Unsupported widget type: {widget.type}")

    def _render_link_list(self, pdf_canvas: canvas.Canvas, widget: Widget, **kwargs) -> None:
        """
        Expand and render a link_list composite as multiple internal_link widgets.

        This mirrors the compilation-time expansion so preview works when a raw
        Template (not a compiled Project) is sent to the renderer.
        """
        props = getattr(widget, 'properties', {}) or {}
        styling = getattr(widget, 'styling', {}) or {}

        # Parse and validate properties
        config = self._parse_link_list_config(props, widget.id)

        # Calculate layout
        layout = self._calculate_link_list_layout(widget, config)

        # Generate and render individual links
        page_num = kwargs.get('page_num', 1)
        total_pages = kwargs.get('total_pages', 1)
        links = self._generate_link_widgets(widget, config, layout, styling, page_num, total_pages)

        # Render each generated link using LinkRenderer
        for link_widget in links:
            self.link_renderer.render(pdf_canvas, link_widget, **kwargs)

    def _parse_link_list_config(self, props: Dict[str, Any], widget_id: str) -> Dict[str, Any]:
        """Parse and validate link_list configuration properties."""
        config = {}

        # If labels array is provided, use its length for count
        # This matches UI behavior where labels takes precedence
        labels = props.get('labels')
        if labels and isinstance(labels, list):
            config['count'] = len(labels)
            config['labels'] = labels
        else:
            # Otherwise use count property
            try:
                config['count'] = max(1, int(props.get('count', 1)))
            except (ValueError, TypeError):
                raise RenderingError(f"link_list '{widget_id}': invalid count, must be positive integer")
            config['labels'] = None

        # Parse start_index with validation
        try:
            config['start_index'] = max(1, int(props.get('start_index', 1)))
        except (ValueError, TypeError):
            raise RenderingError(f"link_list '{widget_id}': invalid start_index, must be positive integer")

        # Parse index_pad with validation
        try:
            config['index_pad'] = max(1, int(props.get('index_pad', 3)))
        except (ValueError, TypeError):
            raise RenderingError(f"link_list '{widget_id}': invalid index_pad, must be positive integer")

        # Parse columns with validation
        try:
            config['columns'] = max(1, int(props.get('columns', 1)))
        except (ValueError, TypeError):
            raise RenderingError(f"link_list '{widget_id}': invalid columns, must be positive integer")

        # Parse gaps with validation
        try:
            config['gap_x'] = float(props.get('gap_x', 0.0) or 0.0)
            config['gap_y'] = float(props.get('gap_y', 0.0) or 0.0)
        except (ValueError, TypeError):
            raise RenderingError(f"link_list '{widget_id}': invalid gap values, must be numbers")

        # Parse item_height (optional)
        item_height = props.get('item_height')
        if item_height is not None:
            try:
                config['item_height'] = float(item_height)
                if config['item_height'] <= 0:
                    raise RenderingError(f"link_list '{widget_id}': item_height must be positive")
            except (ValueError, TypeError):
                raise RenderingError(f"link_list '{widget_id}': invalid item_height, must be positive number")
        else:
            config['item_height'] = None

        # Parse templates and bindings
        config['label_template'] = props.get('label_template', 'Note {index_padded}') or 'Note {index_padded}'
        config['bind_expr'] = props.get('bind', 'notes(@index)') or 'notes(@index)'

        # Parse highlight configuration
        highlight_index = props.get('highlight_index')
        if highlight_index is not None:
            try:
                config['highlight_index'] = int(highlight_index)
            except (ValueError, TypeError):
                logger.warning(f"link_list '{widget_id}': invalid highlight_index, ignoring")
                config['highlight_index'] = None
        else:
            config['highlight_index'] = None

        config['highlight_color'] = props.get('highlight_color', '#dbeafe')

        # Parse orientation
        orientation = props.get('orientation', 'horizontal')
        # Normalize legacy 'vertical' to 'vertical_cw' for backward compatibility
        if orientation == 'vertical':
            orientation = 'vertical_cw'
        if orientation not in ['horizontal', 'vertical_cw', 'vertical_ccw']:
            raise RenderingError(
                f"link_list '{widget_id}': invalid orientation '{orientation}', "
                f"must be 'horizontal', 'vertical_cw', or 'vertical_ccw'"
            )
        config['orientation'] = orientation

        # Parse locale for potential future use
        config['locale'] = str(props.get('locale', 'en')).lower()

        return config

    def _calculate_link_list_layout(self, widget: Widget, config: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate layout parameters for link_list items."""
        # For vertical orientations, swap dimensions to match the rotated content space
        # This matches the UI behavior where CanvasWidget swaps dimensions
        orientation = config.get('orientation', 'horizontal')
        is_vertical = orientation in ['vertical_cw', 'vertical_ccw']

        if is_vertical:
            total_w = float(widget.position.height)
            total_h = float(widget.position.width)
        else:
            total_w = float(widget.position.width)
            total_h = float(widget.position.height)

        count = config['count']
        gap_x = config['gap_x']
        gap_y = config['gap_y']
        item_height = config['item_height']
        columns = config['columns']

        # Calculate rows
        rows = int(math.ceil(count / columns)) if columns > 0 else count

        # Base cell sizes from the container
        base_cell_w = (total_w - (columns - 1) * gap_x) / max(1, columns)
        base_cell_h = (total_h - (rows - 1) * gap_y) / max(1, rows)

        # Cell dimensions
        cell_w = base_cell_w
        cell_h = item_height if item_height is not None else base_cell_h

        logger.info(f"[link_list] Layout calc: widget_pos=({widget.position.x},{widget.position.y},{widget.position.width}x{widget.position.height})")
        logger.info(f"[link_list] count={count}, columns={columns}, rows={rows}, orientation={config.get('orientation')}")
        logger.info(f"[link_list] total_w={total_w}, total_h={total_h}")
        logger.info(f"[link_list] cell_w={cell_w}, cell_h={cell_h}, gap_x={gap_x}, gap_y={gap_y}")

        return {
            'base_x': float(widget.position.x),
            'base_y': float(widget.position.y),
            'cell_w': cell_w,
            'cell_h': cell_h,
            'gap_x': gap_x,
            'gap_y': gap_y,
            'columns': columns,
            'rows': rows
        }

    def _generate_link_widgets(self, widget: Widget, config: Dict[str, Any], layout: Dict[str, Any], styling: Dict[str, Any], page_num: int = 1, total_pages: int = 1) -> List[Widget]:
        """Generate individual internal_link widgets from link_list configuration."""
        links = []

        count = config['count']
        start_index = config['start_index']
        index_pad = config['index_pad']
        label_template = config['label_template']
        bind_expr = config['bind_expr']
        highlight_index = config['highlight_index']
        highlight_color = config['highlight_color']
        labels_array = config.get('labels')  # May be None if using template

        base_x = layout['base_x']
        base_y = layout['base_y']
        cell_w = layout['cell_w']
        cell_h = layout['cell_h']
        gap_x = layout['gap_x']
        gap_y = layout['gap_y']
        columns = layout['columns']

        # Also get destinations array if provided
        props = getattr(widget, 'properties', {}) or {}
        destinations_array = props.get('destinations')

        for i in range(count):
            # Calculate position in grid
            row = i // columns
            col = i % columns

            # Calculate actual position
            x = base_x + col * (cell_w + gap_x)
            y = base_y + row * (cell_h + gap_y)

            logger.info(f"[link_list] Item {i}: row={row}, col={col}, pos=({x},{y}), size=({cell_w}x{cell_h})")

            # Calculate index values
            actual_index = start_index + i
            index_padded = str(actual_index).zfill(index_pad)

            # Generate label - use labels array if available, otherwise use template
            if labels_array and i < len(labels_array):
                label = str(labels_array[i])
                logger.info(f"[link_list] Item {i}: Using label from array: '{label}'")
            else:
                # Generate label from template with token processing
                try:
                    # First process any tokens in the template
                    processed_template = label_template
                    try:
                        render_context = RenderingTokenContext(
                            page_num=page_num,
                            total_pages=total_pages
                        )
                        processed_template = TokenProcessor.replace_rendering_tokens(label_template, render_context)
                    except Exception as token_err:
                        logger.warning(f"link_list '{widget.id}': token processing in label_template failed: {token_err}")

                    # Then format with index values
                    label = processed_template.format(
                        index=actual_index,
                        index_padded=index_padded
                    )
                except (KeyError, ValueError) as e:
                    logger.warning(f"link_list '{widget.id}': label template error: {e}")
                    label = f"Item {actual_index}"

            # Generate destination - use destinations array if available, otherwise use bind expression
            if destinations_array and i < len(destinations_array):
                destination = str(destinations_array[i])
            else:
                # Generate destination from bind expression with formatting support
                try:
                    normalized_bind = bind_expr.replace('{PAGE}', '{page}').replace('{TOTAL_PAGES}', '{total_pages}')
                    normalized_bind = normalized_bind.replace('@index', '{index}').replace('@index_padded', '{index_padded}')

                    values = {
                        'index': actual_index,
                        'index_padded': index_padded,
                        'page': page_num,
                        'total_pages': total_pages
                    }
                    destination = TokenProcessor._replace_tokens(normalized_bind, values)
                except Exception as e:
                    logger.warning(f"link_list '{widget.id}': bind expression error: {e}")
                    destination = f"item_{actual_index}"

            # Create position for this link
            position = Position(
                x=x,
                y=y,
                width=cell_w,
                height=cell_h
            )

            # Prepare properties for the link
            link_props = {'to_dest': destination}

            # Pass orientation to generated links
            if config.get('orientation') in ['vertical_cw', 'vertical_ccw']:
                link_props['orientation'] = config['orientation']
                logger.info(f"[link_list] Item {i}: Setting orientation={config['orientation']}")

            # Add highlight if this is the highlighted index
            if highlight_index is not None and actual_index == highlight_index:
                link_props['highlight'] = True
                link_props['highlight_color'] = highlight_color

            # Create the internal_link widget
            link_widget = Widget(
                id=f"{widget.id}_item_{actual_index}",
                type='internal_link',
                position=position,
                content=label,
                properties=link_props,
                styling=styling
            )

            links.append(link_widget)

        return links

    def validate_composite_properties(self, widget: Widget) -> None:
        """
        Validate composite widget properties.

        Args:
            widget: Widget to validate

        Raises:
            RenderingError: If properties are invalid
        """
        if widget.type == 'link_list':
            props = getattr(widget, 'properties', {}) or {}

            # Validate required numeric properties
            numeric_props = ['count', 'start_index', 'index_pad', 'columns']
            for prop_name in numeric_props:
                value = props.get(prop_name)
                if value is not None:
                    try:
                        num_value = int(value)
                        if num_value < 1:
                            raise RenderingError(
                                f"link_list '{widget.id}': {prop_name} must be positive, got {num_value}"
                            )
                    except (ValueError, TypeError):
                        raise RenderingError(
                            f"link_list '{widget.id}': {prop_name} must be an integer, got '{value}'"
                        )

            # Validate gap properties
            for gap_prop in ['gap_x', 'gap_y']:
                value = props.get(gap_prop)
                if value is not None:
                    try:
                        float_value = float(value)
                        if float_value < 0:
                            raise RenderingError(
                                f"link_list '{widget.id}': {gap_prop} must be non-negative, got {float_value}"
                            )
                    except (ValueError, TypeError):
                        raise RenderingError(
                            f"link_list '{widget.id}': {gap_prop} must be a number, got '{value}'"
                        )

            # Validate item_height if specified
            item_height = props.get('item_height')
            if item_height is not None:
                try:
                    height_value = float(item_height)
                    if height_value <= 0:
                        raise RenderingError(
                            f"link_list '{widget.id}': item_height must be positive, got {height_value}"
                        )
                except (ValueError, TypeError):
                    raise RenderingError(
                        f"link_list '{widget.id}': item_height must be a positive number, got '{item_height}'"
                    )

            # Validate orientation
            orientation = props.get('orientation', 'horizontal')
            # Normalize legacy 'vertical' to 'vertical_cw'
            if orientation == 'vertical':
                orientation = 'vertical_cw'
            if orientation not in ['horizontal', 'vertical_cw', 'vertical_ccw']:
                raise RenderingError(
                    f"link_list '{widget.id}': invalid orientation '{orientation}', "
                    f"must be 'horizontal', 'vertical_cw', or 'vertical_ccw'"
                )

            # Validate templates are strings
            label_template = props.get('label_template')
            if label_template is not None and not isinstance(label_template, str):
                raise RenderingError(
                    f"link_list '{widget.id}': label_template must be a string"
                )

            bind_expr = props.get('bind')
            if bind_expr is not None and not isinstance(bind_expr, str):
                raise RenderingError(
                    f"link_list '{widget.id}': bind expression must be a string"
                )
