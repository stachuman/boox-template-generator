"""
Table widget renderer for e-ink PDF templates.

Handles rendering of table widgets with data validation, token processing,
ReportLab Table integration, and PDF link annotations.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import logging
from typing import List, Dict, Any, Optional
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle, Paragraph
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

from ..schema import Widget
from .base import BaseWidgetRenderer, RenderingError
from ..tokens import TokenProcessor, RenderingTokenContext
from .text import TextEngine

logger = logging.getLogger(__name__)


class TableRenderer(BaseWidgetRenderer):
    """
    Renderer for table widgets.

    Handles: table
    Features: Data validation, token processing, styling, PDF links
    Following CLAUDE.md rule #1: No dummy implementations - complete functionality.
    """

    def __init__(self, converter, strict_mode: bool = False):
        """Initialize table renderer with centralized TextEngine."""
        super().__init__(converter, strict_mode)
        self.text_engine = TextEngine(converter)

    @property
    def supported_widget_types(self) -> list[str]:
        return ['table']

    def render(self, pdf_canvas: canvas.Canvas, widget: Widget, **kwargs) -> None:
        """Render table widget based on its type."""
        self.validate_widget(widget)

        if widget.type == 'table':
            # Extract context from kwargs for token processing and constraints
            page_num = kwargs.get('page_num', 1)
            total_pages = kwargs.get('total_pages', 1)
            enforcer = kwargs.get('enforcer')
            profile = kwargs.get('profile')  # For touch target validation
            self._render_table(pdf_canvas, widget, page_num, total_pages, enforcer, profile)
        else:
            raise RenderingError(f"Unsupported widget type: {widget.type}")

    def _render_table(self, pdf_canvas: canvas.Canvas, widget: Widget,
                     page_num: int, total_pages: int, enforcer=None, profile=None) -> None:
        """Render a data table with proper styling and optional cell links.

        Following CLAUDE.md rule #1: No dummy implementations - fully functional table rendering.
        Following CLAUDE.md rule #3: Explicit validation with meaningful errors.
        """
        # Get table properties with explicit validation
        props = getattr(widget, 'properties', {}) or {}
        styling = getattr(widget, 'styling', {}) or {}

        # Required structure properties - fail fast if missing
        rows = props.get('rows')
        columns = props.get('columns')
        if rows is None or columns is None:
            raise RenderingError(
                f"Table widget '{widget.id}' missing required properties: "
                f"rows={rows}, columns={columns}. Both must be specified."
            )

        try:
            rows = int(rows)
            columns = int(columns)
        except (ValueError, TypeError):
            raise RenderingError(
                f"Table widget '{widget.id}' has invalid rows/columns: "
                f"rows='{rows}', columns='{columns}'. Must be integers."
            )

        if rows < 1 or rows > 100:
            raise RenderingError(
                f"Table widget '{widget.id}' rows={rows} out of range. Must be 1-100."
            )
        if columns < 1 or columns > 20:
            raise RenderingError(
                f"Table widget '{widget.id}' columns={columns} out of range. Must be 1-20."
            )

        # Get table data - always honor tokens regardless of mode
        table_data = props.get('table_data')

        if not table_data:
            # Generate default data if none provided
            table_data = []
            for r in range(rows):
                row = []
                for c in range(columns):
                    row.append(f"R{r+1}C{c+1}")
                table_data.append(row)
        elif not isinstance(table_data, list):
            raise RenderingError(
                f"Table widget '{widget.id}' table_data must be a list of lists (2D array)."
            )

        # Validate data structure
        if len(table_data) == 0:
            raise RenderingError(
                f"Table widget '{widget.id}' has empty table_data."
            )

        # Normalize data to match structural expectations while being forgiving if
        # the author-provided data array is out of sync with the declared row count.
        has_header = props.get('has_header', True)
        table_data = self._normalize_table_data(table_data, rows, columns, has_header,
                                               widget.id, page_num, total_pages)

        # Validate each row has correct number of columns
        for row_idx, row in enumerate(table_data):
            if not isinstance(row, list) or len(row) != columns:
                raise RenderingError(
                    f"Table widget '{widget.id}' row {row_idx} has {len(row) if isinstance(row, list) else 'invalid'} columns, "
                    f"expected {columns}."
                )

        # Get position and convert coordinates
        pos = widget.position
        cal_pos = self.converter.convert_position_for_drawing(pos)

        # Create text options using centralized TextEngine (handles font validation and registration)
        constrained_styling = self._apply_styling_constraints(styling, enforcer)
        text_options = self.text_engine.create_text_options(constrained_styling)

        # Get table styling properties
        border_style = props.get('border_style', 'all')
        if border_style not in ['none', 'outer', 'all', 'horizontal', 'vertical']:
            raise RenderingError(
                f"Table widget '{widget.id}' invalid border_style='{border_style}'. "
                f"Must be: none, outer, all, horizontal, vertical."
            )

        stroke_color = props.get('stroke_color') or '#000000'
        stroke_width = props.get('stroke_width', 1)
        cell_padding = props.get('cell_padding', 4)
        row_height = props.get('row_height', 24)

        try:
            if enforcer:
                stroke_width = enforcer.check_stroke_width(float(stroke_width))
            else:
                stroke_width = max(0.1, min(5.0, float(stroke_width)))
            cell_padding = float(cell_padding)
            row_height = float(row_height)
        except Exception as e:
            raise RenderingError(f"Table widget '{widget.id}' styling error: {str(e)}")

        # Calculate column widths
        column_widths = props.get('column_widths')
        if column_widths:
            if len(column_widths) != columns:
                raise RenderingError(
                    f"Table widget '{widget.id}' column_widths has {len(column_widths)} values, "
                    f"expected {columns}."
                )
            # Normalize to sum to total width
            total_ratio = sum(column_widths)
            if total_ratio <= 0:
                raise RenderingError(
                    f"Table widget '{widget.id}' column_widths sum must be > 0, got {total_ratio}."
                )
            col_widths = [(w / total_ratio) * cal_pos['width'] for w in column_widths]
        else:
            # Equal width columns
            col_width = cal_pos['width'] / columns
            col_widths = [col_width] * columns

        # Validate touch targets for interactive cells
        cell_links = props.get('cell_links', False)
        if cell_links and profile:
            min_touch_size = profile.constraints.min_touch_target_pt
            for col_width in col_widths:
                if col_width < min_touch_size or row_height < min_touch_size:
                    logger.warning(
                        f"Table widget '{widget.id}' has small touch targets: "
                        f"cell size {col_width:.1f}x{row_height:.1f}pt "
                        f"(profile minimum: {min_touch_size}pt)"
                    )
                    break

        # Create ReportLab Table data structure
        # Convert string data to proper format, using Paragraph objects for text wrapping
        text_wrap = props.get('text_wrap', True)
        max_lines = props.get('max_lines', 2)
        text_align = props.get('text_align', 'left')

        # Create paragraph style for wrapped cells
        paragraph_style = None
        if text_wrap:
            # Map text alignment to ReportLab alignment constants
            alignment_map = {
                'left': TA_LEFT,
                'center': TA_CENTER,
                'right': TA_RIGHT
            }
            para_alignment = alignment_map.get(text_align, TA_LEFT)

            paragraph_style = ParagraphStyle(
                'table_cell',
                fontName=text_options.font_name,
                fontSize=text_options.font_size,
                textColor=HexColor(text_options.color),
                alignment=para_alignment,
                leading=text_options.font_size * 1.2,  # Line spacing
                wordWrap='CJK'  # Enable word wrapping
            )

        reportlab_data = []
        for row in table_data:
            reportlab_row = []
            for cell in row:
                # Ensure cell content is string
                cell_content = str(cell) if cell is not None else ""

                # Use Paragraph for text wrapping if enabled
                if text_wrap and paragraph_style:
                    # Limit lines by truncating text if needed
                    # ReportLab Paragraph doesn't have built-in max_lines, so we approximate
                    # by limiting content length based on max_lines
                    if max_lines and max_lines > 0:
                        # Split by lines and limit
                        lines = cell_content.split('\n')
                        if len(lines) > max_lines:
                            cell_content = '\n'.join(lines[:max_lines])

                    try:
                        cell_obj = Paragraph(cell_content, paragraph_style)
                    except Exception as e:
                        logger.warning(f"Failed to create Paragraph for cell content '{cell_content}': {e}")
                        cell_obj = cell_content  # Fallback to plain string
                    reportlab_row.append(cell_obj)
                else:
                    reportlab_row.append(cell_content)
            reportlab_data.append(reportlab_row)

        # Create ReportLab Table
        try:
            table = Table(reportlab_data, colWidths=col_widths, rowHeights=[row_height] * len(table_data))
        except Exception as e:
            raise RenderingError(f"Table widget '{widget.id}' ReportLab Table creation failed: {str(e)}")

        # Build table style
        table_style_commands = self._build_table_style(
            text_options.font_name,
            text_options.font_size,
            text_options.color,
            cell_padding,
            props,
            has_header,
            len(table_data),
            text_wrap  # Pass text_wrap flag to skip ALIGN when using Paragraphs
        )

        # Apply border styling
        self._apply_border_style(table_style_commands, border_style, stroke_color, stroke_width,
                                len(table_data), columns)

        # Apply the style
        try:
            table.setStyle(TableStyle(table_style_commands))
        except Exception as e:
            raise RenderingError(f"Table widget '{widget.id}' style application failed: {str(e)}")

        # Position and draw the table
        try:
            # WrapOn calculates the table's actual dimensions
            table_width, table_height = table.wrapOn(pdf_canvas, cal_pos['width'], cal_pos['height'])

            logger.warning(f"[table] Widget '{widget.id}': widget_height={cal_pos['height']}, "
                          f"calculated_table_height={table_height}, rows={len(table_data)}, "
                          f"row_height={row_height}, stroke_width={stroke_width}, border_style={border_style}")

            # ReportLab Table draws from bottom-left corner
            # cal_pos['y'] is the widget's bottom edge (already converted from top-left)
            # Adjust for border positioning:
            # - ReportLab draws borders centered on the edge coordinates
            # - For 'outer' or 'all' borders, offset by half stroke width to align outer edge with widget bounds
            # - This ensures top/left borders start exactly at widget boundary
            offset = 0
            if border_style in ['outer', 'all']:
                offset = stroke_width / 2.0

            draw_x = cal_pos['x'] + offset
            draw_y = cal_pos['y'] + offset

            table.drawOn(pdf_canvas, draw_x, draw_y)
        except Exception as e:
            raise RenderingError(f"Table widget '{widget.id}' drawing failed: {str(e)}")

        # Add cell links if specified
        link_template = props.get('link_template')
        if link_template and link_template.strip():
            # Get link columns - if empty, link ALL columns (following CLAUDE.md rule #3: explicit intent)
            link_columns = props.get('link_columns', [])
            if not link_columns or len(link_columns) == 0:
                # Empty means all columns clickable
                link_columns = list(range(len(col_widths)))
            self._add_table_cell_links(pdf_canvas, widget, table_data, cal_pos, col_widths,
                                     row_height, link_template, link_columns, has_header,
                                     page_num, total_pages)

    def _apply_styling_constraints(self, styling: dict, enforcer=None) -> dict:
        """Apply device profile constraints to styling parameters."""
        constrained_styling = styling.copy()

        # Apply font size constraints
        if 'size' in constrained_styling or 'font_size' in constrained_styling:
            raw_font_size = (
                constrained_styling.get('size')
                if constrained_styling.get('size') is not None
                else constrained_styling.get('font_size', 10.0)
            )

            try:
                font_size = float(raw_font_size)
            except (TypeError, ValueError):
                font_size = 10.0

            if enforcer:
                constrained_styling['font_size'] = enforcer.check_font_size(font_size)
            else:
                # Fallback to reasonable defaults if no enforcer available
                constrained_styling['font_size'] = max(8.0, min(72.0, font_size))

        # Apply color constraints
        if 'color' in constrained_styling:
            color = constrained_styling.get('color')
            if enforcer:
                constrained_styling['color'] = enforcer.validate_color(color)
            else:
                # Fallback validation - basic hex format
                if isinstance(color, str) and color.startswith('#') and len(color) == 7:
                    constrained_styling['color'] = color
                elif isinstance(color, str) and color.lower() in ['none', 'transparent']:
                    constrained_styling['color'] = color
                else:
                    constrained_styling['color'] = '#000000'

        return constrained_styling

    def _normalize_table_data(self, table_data: List[Any], rows: int, columns: int,
                             has_header: bool, widget_id: str, page_num: int, total_pages: int) -> List[List[str]]:
        """Ensure table data matches declared shape, padding or trimming as needed."""
        normalized: List[List[str]] = []

        for idx, row in enumerate(table_data):
            if not isinstance(row, (list, tuple)):
                raise RenderingError(
                    f"Table widget '{widget_id}' row {idx} is not a list/tuple."
                )
            # Trim extra columns and pad missing ones with blanks
            row_values = list(row[:columns])
            if len(row_values) < columns:
                row_values.extend([''] * (columns - len(row_values)))

            # Apply token replacement to cell values
            processed_row = []
            for cell_value in row_values:
                cell_text = str(cell_value) if cell_value is not None else ""

                # Token substitution for dynamic fields (like text_block widgets)
                try:
                    render_context = RenderingTokenContext(
                        page_num=page_num,
                        total_pages=total_pages
                    )
                    cell_text = TokenProcessor.replace_rendering_tokens(cell_text, render_context)
                except Exception as e:
                    if self.strict_mode:
                        raise RenderingError(f"Table widget '{widget_id}': token processing failed in cell: {e}") from e
                    logger.warning(f"Token processing failed for table cell in widget {widget_id}: {e}")

                processed_row.append(cell_text)

            normalized.append(processed_row)

        # Ensure we have the right number of rows
        actual_rows = rows + (1 if has_header else 0)
        if len(normalized) < actual_rows:
            # Pad with empty rows
            for _ in range(actual_rows - len(normalized)):
                normalized.append([''] * columns)
        elif len(normalized) > actual_rows:
            # Trim excess rows
            normalized = normalized[:actual_rows]

        return normalized

    def _build_table_style(self, font_name: str, font_size: float, text_color: str,
                          cell_padding: float, props: dict, has_header: bool,
                          num_rows: int, text_wrap: bool = False) -> List:
        """Build ReportLab TableStyle commands."""
        table_style_commands = []

        # Set font for all cells (only applies to plain string cells, not Paragraphs)
        table_style_commands.append(('FONT', (0, 0), (-1, -1), font_name, font_size))
        table_style_commands.append(('TEXTCOLOR', (0, 0), (-1, -1), HexColor(text_color)))
        table_style_commands.append(('VALIGN', (0, 0), (-1, -1), 'MIDDLE'))

        # Text alignment - only apply if NOT using Paragraphs (Paragraphs handle their own alignment)
        if not text_wrap:
            text_align = props.get('text_align', 'left').upper()
            if text_align in ['LEFT', 'CENTER', 'RIGHT']:
                table_style_commands.append(('ALIGN', (0, 0), (-1, -1), text_align))

        # Cell padding
        table_style_commands.append(('LEFTPADDING', (0, 0), (-1, -1), cell_padding))
        table_style_commands.append(('RIGHTPADDING', (0, 0), (-1, -1), cell_padding))
        table_style_commands.append(('TOPPADDING', (0, 0), (-1, -1), cell_padding))
        table_style_commands.append(('BOTTOMPADDING', (0, 0), (-1, -1), cell_padding))

        # Header styling
        if has_header:
            header_bg = props.get('header_background', '#F0F0F0')
            header_color = props.get('header_color', '#000000')

            try:
                table_style_commands.append(('BACKGROUND', (0, 0), (-1, 0), HexColor(header_bg)))
                table_style_commands.append(('TEXTCOLOR', (0, 0), (-1, 0), HexColor(header_color)))
            except Exception as e:
                logger.warning(f"Invalid header colors, using defaults: {e}")

        if props.get('zebra_rows'):
            even_bg = props.get('even_row_bg', '#FFFFFF')
            odd_bg = props.get('odd_row_bg', '#F8F8F8')
            start_row = 1 if has_header else 0

            for row in range(start_row, num_rows):
                try:
                    bg_color = even_bg if ((row - start_row) % 2 == 0) else odd_bg
                    if isinstance(bg_color, str) and bg_color.lower() in ['transparent', 'none']:
                        continue
                    table_style_commands.append(('BACKGROUND', (0, row), (-1, row), HexColor(bg_color)))
                except Exception as e:
                    logger.warning(f"Invalid zebra row color on row {row}: {e}")
                    break

        return table_style_commands

    def _apply_border_style(self, table_style_commands: List, border_style: str,
                           stroke_color: str, stroke_width: float, num_rows: int, num_cols: int) -> None:
        """Apply border styling to table style commands."""
        if border_style == 'none':
            return
        elif border_style == 'outer':
            table_style_commands.append(('BOX', (0, 0), (-1, -1), stroke_width, HexColor(stroke_color)))
        elif border_style == 'all':
            table_style_commands.append(('GRID', (0, 0), (-1, -1), stroke_width, HexColor(stroke_color)))
        elif border_style == 'horizontal':
            for row in range(num_rows):
                if row > 0:  # Skip top border, only internal horizontal lines
                    table_style_commands.append(
                        ('LINEABOVE', (0, row), (-1, row), stroke_width, HexColor(stroke_color))
                    )
        elif border_style == 'vertical':
            for col in range(num_cols):
                if col > 0:  # Skip left border, only internal vertical lines
                    table_style_commands.append(
                        ('LINEAFTER', (col-1, 0), (col-1, -1), stroke_width, HexColor(stroke_color))
                    )

    def _add_table_cell_links(self, pdf_canvas: canvas.Canvas, widget: Widget, table_data: List[List[str]],
                             table_pos: Dict[str, float], col_widths: List[float], row_height: float,
                             link_template: str, link_columns: List[int], has_header: bool,
                             page_num: int = 1, total_pages: int = 1) -> None:
        """Add PDF link annotations to table cells.

        Following CLAUDE.md rule #1: No dummy implementations - actual PDF link creation.

        Note: link_columns is 0-based internally (received from frontend after conversion),
        but {row} and {col} tokens are 1-based for user-friendliness.

        Link templates support:
        - Per-cell tokens: {row}, {col}, {value} (replaced first via .format())
        - Global tokens: {date}, {page}, custom variables (replaced via TokenProcessor)
        """
        start_row = 1 if has_header else 0

        for row_idx in range(start_row, len(table_data)):
            data_row_idx = row_idx - start_row  # Index in actual data (excluding header)

            for col_idx in link_columns:
                if col_idx < 0 or col_idx >= len(col_widths):
                    continue

                # Calculate cell position
                cell_x = table_pos['x'] + sum(col_widths[:col_idx])
                cell_y = table_pos['y'] + (len(table_data) - row_idx - 1) * row_height
                cell_width = col_widths[col_idx]

                # Step 1: Replace per-cell dynamic tokens using Python .format()
                # Use 1-based indices for user-friendly tokens (Row 1, Col 1 instead of Row 0, Col 0)
                try:
                    cell_value = table_data[row_idx][col_idx] if col_idx < len(table_data[row_idx]) else ""
                    link_dest = link_template.format(
                        row=data_row_idx + 1,  # 1-based for users
                        col=col_idx + 1,        # 1-based for users
                        value=cell_value
                    )
                except KeyError as e:
                    # Unknown placeholder - might be a global token, proceed
                    link_dest = link_template

                # Step 2: Replace global tokens (like {date}, {car_index}, etc.) via TokenProcessor
                # This allows variables with hyphens/underscores (following CLAUDE.md rule #3: explicit support)
                try:
                    render_context = RenderingTokenContext(
                        widget_id=widget.id,
                        page_num=page_num,
                        total_pages=total_pages
                    )
                    link_dest = TokenProcessor.replace_rendering_tokens(link_dest, render_context)
                except Exception as e:
                    logger.warning(f"Table link template token processing failed for widget {widget.id}: {e}")

                # Add link annotation
                try:
                    pdf_canvas.linkRect("", link_dest,
                                      (cell_x, cell_y, cell_x + cell_width, cell_y + row_height),
                                      relative=0)
                except Exception as e:
                    logger.warning(f"Failed to create table cell link for {widget.id}: {str(e)}")
                    continue

    def validate_table_properties(self, widget: Widget) -> None:
        """
        Validate table widget properties.

        Args:
            widget: Widget to validate

        Raises:
            RenderingError: If properties are invalid
        """
        props = getattr(widget, 'properties', {}) or {}

        # Check required properties
        if 'rows' not in props or 'columns' not in props:
            raise RenderingError(f"Table widget '{widget.id}': missing required 'rows' or 'columns' properties")

        # Validate data structure
        table_data = props.get('table_data')
        if table_data and not isinstance(table_data, list):
            raise RenderingError(f"Table widget '{widget.id}': table_data must be a list")

