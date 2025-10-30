"""
Day list widget renderer for e-ink PDF templates.

Renders a vertical list of days in a month with space for notes.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import logging
import calendar
from datetime import date, datetime, timedelta
from typing import Dict, Any, List
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

from ..schema import Widget
from .base import BaseWidgetRenderer, RenderingError
from .text import TextEngine, TextRenderingOptions
from ..tokens import TokenProcessor, RenderingTokenContext
from ...i18n import get_weekday_names

logger = logging.getLogger(__name__)


class DayListRenderer(BaseWidgetRenderer):
    """
    Renderer for day_list widgets.

    Renders a vertical list of days in a month with optional notes lines.
    Features: Localization, token processing, link support, orientation.
    Following CLAUDE.md rule #1: No dummy implementations - complete functionality.
    """

    def __init__(self, converter, strict_mode: bool = False):
        """Initialize day list renderer with TextEngine for text rendering."""
        super().__init__(converter, strict_mode)
        self.text_engine = TextEngine(converter)

    @property
    def supported_widget_types(self) -> list[str]:
        return ['day_list']

    def render(self, pdf_canvas: canvas.Canvas, widget: Widget, **kwargs) -> None:
        """Render day_list widget."""
        self.validate_widget(widget)

        if widget.type == 'day_list':
            self._render_day_list(pdf_canvas, widget, **kwargs)
        else:
            raise RenderingError(f"Unsupported widget type: {widget.type}")

    def _render_day_list(self, pdf_canvas: canvas.Canvas, widget: Widget, **kwargs) -> None:
        """
        Render a vertical list of days for a month.

        Following CLAUDE.md Rule #1: Complete implementation with all features.
        Following CLAUDE.md Rule #3: Explicit behavior - token processing, localization.
        """
        props = getattr(widget, 'properties', {}) or {}
        styling = getattr(widget, 'styling', {}) or {}

        # Get rendering context for token processing
        page_num = kwargs.get('page_num', 1)
        total_pages = kwargs.get('total_pages', 1)
        enforcer = kwargs.get('enforcer')
        locale = kwargs.get('locale', 'en')  # Global locale from template metadata

        # Parse configuration
        config = self._parse_day_list_config(props, widget.id, page_num, total_pages, locale)

        # Apply styling constraints
        text_options = self._build_text_options(styling, enforcer)

        # Render the day list
        self._render_days(pdf_canvas, widget, config, text_options, page_num, total_pages, enforcer)

    def _parse_day_list_config(self, props: Dict[str, Any], widget_id: str,
                                page_num: int, total_pages: int, locale: str) -> Dict[str, Any]:
        """Parse and validate day_list configuration properties."""
        config = {}

        # Parse start_date with token processing
        date_str = props.get('start_date', '')
        if not date_str:
            raise RenderingError(f"day_list '{widget_id}': start_date is required")

        config['start_date'] = self._parse_start_date(date_str, widget_id, page_num, total_pages)

        # Parse display options
        config['show_day_numbers'] = bool(props.get('show_day_numbers', True))
        config['show_weekday_names'] = bool(props.get('show_weekday_names', True))
        config['show_week_numbers'] = bool(props.get('show_week_numbers', False))
        config['weekday_format'] = props.get('weekday_format', 'short')  # short, narrow, full
        if config['weekday_format'] not in ['short', 'narrow', 'full']:
            config['weekday_format'] = 'short'

        # Parse row height
        try:
            config['row_height'] = float(props.get('row_height', 20.0))
            if config['row_height'] <= 0:
                raise RenderingError(f"day_list '{widget_id}': row_height must be positive")
        except (ValueError, TypeError):
            raise RenderingError(f"day_list '{widget_id}': invalid row_height")

        # Parse notes options
        config['show_notes_lines'] = bool(props.get('show_notes_lines', True))
        try:
            config['notes_line_count'] = max(0, int(props.get('notes_line_count', 1)))
        except (ValueError, TypeError):
            config['notes_line_count'] = 1

        # Parse weekend highlighting
        config['highlight_weekends'] = bool(props.get('highlight_weekends', False))
        config['weekend_color'] = props.get('weekend_color', '#F0F0F0')

        # Parse first day of week
        first_day = props.get('first_day_of_week', 'monday')
        config['first_day_of_week'] = 0 if first_day == 'monday' else 6

        # Parse link strategy
        config['link_strategy'] = props.get('link_strategy', 'no_links')
        if config['link_strategy'] not in ['no_links', 'named_destinations', 'sequential_pages']:
            config['link_strategy'] = 'no_links'

        if config['link_strategy'] == 'sequential_pages':
            try:
                config['first_page_number'] = max(1, int(props.get('first_page_number', 2)))
            except (ValueError, TypeError):
                config['first_page_number'] = 2

        if config['link_strategy'] == 'named_destinations':
            config['link_template'] = props.get('link_template', 'day:{date}')
            # Following CLAUDE.md Rule #3: Separate templates for different link types
            config['week_link_template'] = props.get('week_link_template', 'week:{week}')

        # Parse orientation
        config['orientation'] = props.get('orientation', 'horizontal')
        if config['orientation'] not in ['horizontal', 'vertical_cw', 'vertical_ccw']:
            config['orientation'] = 'horizontal'

        # Parse header options
        config['show_month_header'] = bool(props.get('show_month_header', False))
        config['show_year_in_header'] = bool(props.get('show_year_in_header', False))
        config['month_name_format'] = props.get('month_name_format', 'long')
        if config['month_name_format'] not in ['long', 'short']:
            config['month_name_format'] = 'long'

        # Use global locale from template metadata (not widget properties)
        config['locale'] = locale

        return config

    def _parse_start_date(self, date_str: str, widget_id: str, page_num: int, total_pages: int) -> date:
        """Parse date with token processing."""
        # Process rendering-time tokens
        processed_date_str = date_str
        try:
            render_context = RenderingTokenContext(page_num=page_num, total_pages=total_pages)
            processed_date_str = TokenProcessor.replace_rendering_tokens(date_str, render_context)
        except Exception as e:
            logger.debug(f"day_list '{widget_id}': token processing failed for start_date: {e}")

        # Try to parse the date
        try:
            return datetime.strptime(processed_date_str, '%Y-%m-%d').date()
        except ValueError:
            pass

        # Try ISO format
        try:
            return datetime.fromisoformat(processed_date_str).date()
        except (ValueError, TypeError):
            pass

        raise RenderingError(
            f"day_list '{widget_id}': invalid start_date '{date_str}' "
            f"(processed as '{processed_date_str}'). Expected YYYY-MM-DD format."
        )

    def _build_text_options(self, styling: Dict[str, Any], enforcer=None) -> TextRenderingOptions:
        """Build text rendering options from widget styling with constraints."""
        font_name = styling.get('font', 'Helvetica')
        font_size = float(styling.get('size', 10))
        color = styling.get('color', '#000000')

        # Apply device profile constraints
        if enforcer:
            try:
                font_size = enforcer.check_font_size(font_size)
            except Exception:
                if self.strict_mode:
                    raise
                # In non-strict mode, enforcer logs violations

        return TextRenderingOptions(
            font_name=font_name,
            font_size=font_size,
            color=color,
            text_align='left',
            orientation='horizontal'  # Text within cells is always horizontal
        )

    def _render_days(self, pdf_canvas: canvas.Canvas, widget: Widget, config: Dict[str, Any],
                     text_options: TextRenderingOptions, page_num: int, total_pages: int,
                     enforcer=None) -> None:
        """Render the day list with all configured features."""
        start_date = config['start_date']
        year = start_date.year
        month = start_date.month
        days_in_month = calendar.monthrange(year, month)[1]

        # Get localized weekday names
        locale = config['locale']
        weekday_format = config['weekday_format']
        first_day_of_week = config['first_day_of_week']

        start_day_name = 'monday' if first_day_of_week == 0 else 'sunday'
        weekday_names = get_weekday_names(locale, style=weekday_format, start=start_day_name)
        if len(weekday_names) < 7:
            weekday_names = (weekday_names * 7)[:7]

        # Calculate layout
        row_height = config['row_height']
        show_day_numbers = config['show_day_numbers']
        show_weekday_names = config['show_weekday_names']
        show_notes_lines = config['show_notes_lines']
        notes_line_count = config['notes_line_count']
        weekday_format = config['weekday_format']

        # Widget dimensions - convert position for PDF coordinate system
        # Following CLAUDE.md Rule #3: Explicit behavior - use coordinate converter
        pos = self.converter.convert_position_for_drawing(widget.position)
        widget_width = float(pos['width'])
        widget_height = float(pos['height'])
        widget_x = float(pos['x'])
        widget_y = float(pos['y'])

        # Column widths - adjust weekday column based on format
        # Following CLAUDE.md Rule #3: Week numbers are max 3 chars ("W53"), need ~2.0 for readability
        show_week_numbers = config['show_week_numbers']
        week_col_width = (text_options.font_size * 2.0) if show_week_numbers else 0.0

        day_num_width = 30.0 if show_day_numbers else 0.0
        if show_weekday_names:
            # Following CLAUDE.md Rule #3: Explicit behavior - adapt width to format
            if weekday_format == 'full':
                weekday_width = 80.0  # Monday, Tuesday, etc.
            elif weekday_format == 'short':
                weekday_width = 40.0  # Mon, Tue, etc.
            else:  # narrow
                weekday_width = 15.0  # M, T, etc.
        else:
            weekday_width = 0.0
        notes_width = widget_width - week_col_width - day_num_width - weekday_width

        font_size = text_options.font_size

        # Calculate header space
        show_month_header = config['show_month_header']
        show_year_in_header = config['show_year_in_header']
        month_name_format = config['month_name_format']
        show_header = show_month_header or show_year_in_header
        header_height = font_size * 1.8 if show_header else 0.0

        # Render month/year header if enabled
        if show_header:
            from ...i18n import get_month_names

            # Get localized month names
            month_names = get_month_names(locale, short=(month_name_format == 'short'))

            # Build header text
            header_parts = []
            if show_month_header:
                header_parts.append(month_names[month - 1])
            if show_year_in_header:
                header_parts.append(str(year))
            header_text = ' '.join(header_parts)

            # Render header at top of widget
            header_box = {
                'x': widget_x,
                'y': widget_y + widget_height - font_size * 1.2,
                'width': widget_width,
                'height': font_size
            }
            header_options = TextRenderingOptions(
                font_name=text_options.font_name,
                font_size=font_size,
                color=text_options.color,
                text_align='center',
                orientation=text_options.orientation
            )
            self.text_engine.render_text(pdf_canvas, header_box, header_text, header_options)

        # Calculate available height for day rows
        available_height = widget_height - header_height

        # Track previous week number for change detection
        # Following CLAUDE.md Rule #3: Show week numbers only on change (standard planner convention)
        prev_week_num = None

        # Render each day
        for day in range(1, days_in_month + 1):
            current_date = date(year, month, day)
            weekday_index = (current_date.weekday() - first_day_of_week) % 7
            week_num = current_date.isocalendar()[1]  # ISO week number

            # Calculate row position (accounting for header)
            row_index = day - 1
            row_y = widget_y + available_height - (row_index + 1) * row_height

            # Skip if row would be outside available space
            if row_y < widget_y:
                logger.warning(f"day_list: Day {day} exceeds widget height, skipping")
                break

            # Weekend highlighting
            is_weekend = weekday_index >= 5  # Saturday and Sunday
            if config['highlight_weekends'] and is_weekend:
                pdf_canvas.setFillColor(HexColor(config['weekend_color']))
                pdf_canvas.rect(widget_x, row_y, widget_width, row_height, fill=1, stroke=0)

            # Render week number - only when week changes or first day
            # Following CLAUDE.md Rule #3: Show week number only on change (matches calendar behavior)
            if show_week_numbers:
                show_this_week = (prev_week_num is None) or (week_num != prev_week_num)
                if show_this_week:
                    week_padding = 4.0
                    text_top_offset = 2.0
                    week_box = {
                        'x': widget_x,
                        'y': row_y + row_height - font_size - text_top_offset,
                        'width': week_col_width - week_padding,
                        'height': font_size
                    }
                    week_text = f"W{week_num}"
                    week_text_options = TextRenderingOptions(
                        font_name=text_options.font_name,
                        font_size=font_size,
                        color=text_options.color,
                        text_align='center',
                        orientation=text_options.orientation
                    )
                    self.text_engine.render_text(pdf_canvas, week_box, week_text, week_text_options)

                    # Create clickable link for week number if link_strategy is named_destinations
                    # Following CLAUDE.md Rule #3: Only create links when template strategy is used (matches calendar)
                    if config['link_strategy'] == 'named_destinations':
                        self._create_week_link(
                            pdf_canvas, config, week_num, current_date,
                            widget_x, row_y, week_col_width, row_height
                        )

                prev_week_num = week_num

            # Render day number with padding - positioned at top of row for minimal gap with lines
            if show_day_numbers:
                day_padding = 4.0  # Right padding in points
                text_top_offset = 2.0  # Small padding from top edge
                day_box = {
                    'x': widget_x + week_col_width,  # Shift right for week column
                    'y': row_y + row_height - font_size - text_top_offset,
                    'width': day_num_width - day_padding,
                    'height': font_size
                }
                day_text_options = TextRenderingOptions(
                    font_name=text_options.font_name,
                    font_size=font_size,
                    color=text_options.color,
                    text_align='right',
                    orientation=text_options.orientation
                )
                self.text_engine.render_text(pdf_canvas, day_box, str(day), day_text_options)

            # Render weekday name with padding - positioned at top of row for minimal gap with lines
            if show_weekday_names:
                weekday_padding = 4.0  # Left padding in points
                text_top_offset = 2.0  # Small padding from top edge
                weekday_box = {
                    'x': widget_x + week_col_width + day_num_width + weekday_padding,  # Account for week column
                    'y': row_y + row_height - font_size - text_top_offset,
                    'width': weekday_width - weekday_padding,
                    'height': font_size
                }
                weekday_text = weekday_names[weekday_index]
                weekday_text_options = TextRenderingOptions(
                    font_name=text_options.font_name,
                    font_size=font_size,
                    color=text_options.color,
                    text_align='left',
                    orientation=text_options.orientation
                )
                self.text_engine.render_text(pdf_canvas, weekday_box, weekday_text, weekday_text_options)

            # Render notes lines at bottom of day cell
            # Following CLAUDE.md Rule #3: Explicit behavior - lines positioned at bottom for writing
            # Note: In PDF coordinates, row_y is the BOTTOM of the row, row_y + row_height is the TOP
            if show_notes_lines and notes_line_count > 0:
                notes_x = widget_x + week_col_width + day_num_width + weekday_width  # Account for week column
                line_spacing = 3.0  # Fixed spacing between lines in points (tight for compact layout)

                pdf_canvas.setStrokeColor(HexColor('#CCCCCC'))
                pdf_canvas.setLineWidth(0.5)

                for line_num in range(notes_line_count):
                    # Position lines from bottom up: row_y (bottom) + spacing
                    line_y = row_y + (line_num + 1) * line_spacing
                    pdf_canvas.line(notes_x, line_y, notes_x + notes_width, line_y)

            # Create clickable link for day row (exclude week column to prevent overlap)
            # Following CLAUDE.md Rule #3: Day link starts AFTER week column
            if config['link_strategy'] != 'no_links':
                day_link_x = widget_x + week_col_width
                day_link_width = widget_width - week_col_width
                self._create_day_link(
                    pdf_canvas, config, current_date, day,
                    day_link_x, row_y, day_link_width, row_height
                )

        # Validate touch targets if enforcer available
        if enforcer:
            try:
                _ = enforcer.check_touch_target_size(widget_width, row_height)
            except Exception:
                if self.strict_mode:
                    raise

    def _create_day_link(self, pdf_canvas: canvas.Canvas, config: Dict[str, Any],
                         current_date: date, day_num: int,
                         row_x: float, row_y: float, row_width: float, row_height: float) -> None:
        """Create PDF link annotation for a day row."""
        link_strategy = config['link_strategy']
        destination = None

        if link_strategy == 'named_destinations':
            link_template = config.get('link_template', 'day:{date}')
            try:
                destination = link_template.format(
                    date=current_date.isoformat(),
                    year=current_date.year,
                    month=current_date.month,
                    day=day_num
                )
            except (KeyError, ValueError) as e:
                logger.warning(f"day_list link template error: {e}")
                destination = f"day:{current_date.isoformat()}"

        elif link_strategy == 'sequential_pages':
            first_page = config.get('first_page_number', 2)
            destination = f"page_{first_page + day_num - 1}"

        # Following CLAUDE.md Rule #3: Skip malformed destinations
        if not destination or not destination.strip() or destination.endswith(':'):
            logger.debug(f"Skipping day link with empty/malformed destination '{destination}'")
            return

        # Create link rectangle
        link_rect = (row_x, row_y, row_x + row_width, row_y + row_height)

        try:
            pdf_canvas.linkRect("", destination, link_rect, relative=0)
            logger.debug(f"Created day link to '{destination}' at {link_rect}")
        except Exception as e:
            if self.strict_mode:
                raise RenderingError(f"Failed to create day link: {e}")
            logger.warning(f"Failed to create day link to '{destination}': {e}")

    def _create_week_link(self, pdf_canvas: canvas.Canvas, config: Dict[str, Any],
                         week_num: int, week_date: date,
                         cell_x: float, cell_y: float,
                         cell_width: float, cell_height: float) -> None:
        """
        Create PDF link annotation for week number cells in day_list widget.

        Following CLAUDE.md Rule #1: No dummy implementations - complete link functionality.
        Following CLAUDE.md Rule #3: Separate templates for days vs weeks.

        Args:
            pdf_canvas: ReportLab canvas to draw on
            config: Day list configuration
            week_num: ISO week number (1-52/53)
            week_date: Date in the week (for year context)
            cell_x, cell_y: Bottom-left corner of week number cell
            cell_width, cell_height: Dimensions of week number cell
        """
        # Get week link template (separate from day link template)
        link_template = config.get('week_link_template', 'week:{week}')

        # Format destination using week number and date context
        try:
            destination = link_template.format(
                week=week_num,
                year=week_date.year,
                month=week_date.month,
                date=week_date.isoformat()
            )
        except (KeyError, ValueError) as e:
            logger.warning(f"Day list week link template error: {e}, using default")
            destination = f"week:{week_num}"

        # Following CLAUDE.md Rule #3: Skip malformed destinations (empty or ending with ':')
        # This matches the boundary-aware navigation behavior where empty variables
        # create malformed destinations like "week:" which should be skipped
        if not destination or not destination.strip() or destination.endswith(':'):
            logger.debug(f"Skipping week number link with empty/malformed destination '{destination}'")
            return

        # Define link rectangle (entire week number cell is clickable)
        link_rect = (cell_x, cell_y, cell_x + cell_width, cell_y + cell_height)

        # Create PDF link annotation
        try:
            pdf_canvas.linkRect("", destination, link_rect, relative=0)
            logger.debug(f"Created day list week link to '{destination}' at {link_rect}")
        except Exception as e:
            # Following CLAUDE.md Rule #4: Fail fast with meaningful exceptions
            if self.strict_mode:
                raise RenderingError(f"Failed to create day list week link: {e}")
            logger.warning(f"Failed to create day list week link to '{destination}': {e}")
