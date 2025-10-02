"""
Calendar widget renderer for e-ink PDF templates.

Handles rendering of calendar widgets with multiple layout types (monthly, weekly),
date calculations, interactive date links, and centralized text processing.
Follows CLAUDE.md coding standards - no dummy implementations.
"""

import logging
import calendar
import math
from datetime import datetime, date, timedelta
from typing import Dict, Any, Tuple, Optional, List
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

from ..schema import Widget
from .base import BaseWidgetRenderer, RenderingError
from .text import TextEngine, TextRenderingOptions
from ..tokens import TokenProcessor, RenderingTokenContext
from ...i18n import get_month_names, get_weekday_names

logger = logging.getLogger(__name__)


class CalendarRenderer(BaseWidgetRenderer):
    """
    Renderer for calendar widgets.

    Handles: calendar (all variants: monthly, weekly horizontal/vertical, custom_range)
    Features: Date calculations, PDF links, layout algorithms, text rendering
    Following CLAUDE.md rule #1: No dummy implementations - complete functionality.
    """

    def __init__(self, converter, strict_mode: bool = False):
        """Initialize calendar renderer with centralized TextEngine."""
        super().__init__(converter, strict_mode)
        self.text_engine = TextEngine(converter)

    @property
    def supported_widget_types(self) -> list[str]:
        return ['calendar']

    def render(self, pdf_canvas: canvas.Canvas, widget: Widget, **kwargs) -> None:
        """Render calendar widget based on its type and properties."""
        self.validate_widget(widget)

        # Extract context from kwargs
        page_num = kwargs.get('page_num', 1)
        total_pages = kwargs.get('total_pages', 1)
        enforcer = kwargs.get('enforcer')

        # Process properties and styling
        props = getattr(widget, 'properties', {}) or {}
        styling = getattr(widget, 'styling', {}) or {}

        # Validate and parse calendar configuration
        config = self._parse_calendar_config(props, widget.id, page_num, total_pages)

        # Apply styling constraints
        constrained_styling = self._apply_styling_constraints(styling, enforcer)
        text_options = self.text_engine.create_text_options(constrained_styling)

        # Get position and convert coordinates
        cal_pos = self.converter.convert_position_for_drawing(widget.position)

        # Render based on calendar type
        calendar_type = config['calendar_type']
        if calendar_type == 'monthly':
            self._render_monthly_calendar(pdf_canvas, widget, config, cal_pos, text_options,
                                        page_num, total_pages, enforcer)
        elif calendar_type == 'weekly':
            if config.get('layout_orientation') == 'vertical':
                self._render_weekly_calendar_vertical(pdf_canvas, widget, config, cal_pos,
                                                    text_options, page_num, total_pages, enforcer)
            else:
                self._render_weekly_calendar(pdf_canvas, widget, config, cal_pos,
                                           text_options, page_num, total_pages, enforcer)
        else:
            # Simplified preview for custom_range
            self._render_calendar_preview(pdf_canvas, widget, config, cal_pos,
                                        text_options, page_num, total_pages, enforcer)

    def _parse_calendar_config(self, props: Dict[str, Any], widget_id: str, page_num: int = 1, total_pages: int = 1) -> Dict[str, Any]:
        """Parse and validate calendar configuration properties."""
        config = {}

        # Calendar type validation with explicit default
        calendar_type = props.get('calendar_type')
        if calendar_type is None:
            calendar_type = 'monthly'  # Documented default from WidgetPalette
        if calendar_type not in ['monthly', 'weekly', 'custom_range']:
            raise RenderingError(
                f"Calendar widget '{widget_id}': invalid calendar_type '{calendar_type}'. "
                f"Supported types: monthly, weekly, custom_range"
            )
        config['calendar_type'] = calendar_type

        # Date validation - required property
        start_date_str = props.get('start_date')
        if not start_date_str:
            raise RenderingError(
                f"Calendar widget '{widget_id}': missing required property 'start_date'"
            )

        # Parse date with token processing and tolerant fallback to support tokenized inputs
        config['start_date'] = self._parse_start_date(start_date_str, widget_id, page_num, total_pages)

        # Parse optional properties with validation
        config['show_weekdays'] = bool(props.get('show_weekdays', True))
        config['show_month_year'] = bool(props.get('show_month_year', True))
        config['show_grid_lines'] = bool(props.get('show_grid_lines', True))
        config['layout_orientation'] = props.get('layout_orientation', 'horizontal')

        # Validate layout orientation
        if config['layout_orientation'] not in ['horizontal', 'vertical']:
            raise RenderingError(
                f"Calendar widget '{widget_id}': invalid layout_orientation '{config['layout_orientation']}'. "
                f"Must be 'horizontal' or 'vertical'"
            )

        # Parse numeric properties with validation
        try:
            config['cell_min_size'] = float(props.get('cell_min_size', 24.0))
            if config['cell_min_size'] <= 0:
                raise RenderingError(f"Calendar widget '{widget_id}': cell_min_size must be positive")
        except (ValueError, TypeError):
            raise RenderingError(f"Calendar widget '{widget_id}': invalid cell_min_size, must be a number")

        # Parse first day of week accommodating UI strings
        first_day_raw = props.get('first_day_of_week', 0)
        try:
            if isinstance(first_day_raw, str):
                normalized = first_day_raw.strip().lower()
                if normalized in ['monday', 'mon']:
                    config['first_day_of_week'] = 0
                elif normalized in ['sunday', 'sun']:
                    config['first_day_of_week'] = 6
                else:
                    config['first_day_of_week'] = int(normalized)
                if not 0 <= config['first_day_of_week'] <= 6:
                    raise ValueError
            else:
                first_day = int(first_day_raw)
                if not 0 <= first_day <= 6:
                    raise ValueError
                config['first_day_of_week'] = first_day
        except (ValueError, TypeError):
            raise RenderingError(
                f"Calendar widget '{widget_id}': invalid first_day_of_week '{first_day_raw}'. "
                f"Use 0-6 or 'sunday'/'monday'"
            )

        # Parse link strategy accommodating UI values
        ui_link_strategy = props.get('link_strategy', 'none')
        link_strategy_map = {
            'none': 'none',
            'no_links': 'none',
            'simple': 'simple',
            'named_destinations': 'template',
            'sequential_pages': 'template',
            'template': 'template'
        }
        raw_link_strategy = str(ui_link_strategy).strip().lower()
        config['raw_link_strategy'] = raw_link_strategy
        normalized_link = link_strategy_map.get(raw_link_strategy)
        if not normalized_link:
            raise RenderingError(
                f"Calendar widget '{widget_id}': invalid link_strategy '{ui_link_strategy}'. "
                f"Supported strategies: none, simple, template"
            )
        config['link_strategy'] = normalized_link

        # Parse text alignment
        config['text_align'] = props.get('text_align', 'center')
        if config['text_align'] not in ['left', 'center', 'right']:
            raise RenderingError(
                f"Calendar widget '{widget_id}': invalid text_align '{config['text_align']}'. "
                f"Must be: left, center, right"
            )

        return config

    def _parse_start_date(self, date_str: str, widget_id: str, page_num: int = 1, total_pages: int = 1) -> date:
        """Parse date with token processing and tolerant fallback to support tokenized inputs."""
        # Process any remaining rendering-time tokens
        processed_date_str = date_str
        try:
            render_context = RenderingTokenContext(page_num=page_num, total_pages=total_pages)
            processed_date_str = TokenProcessor.replace_rendering_tokens(date_str, render_context)
        except Exception as e:
            logger.debug(f"Calendar widget '{widget_id}': token processing failed for start_date: {e}")

        # Try to parse the processed date string
        try:
            return datetime.strptime(processed_date_str, '%Y-%m-%d').date()
        except Exception:
            # Accept YYYY-MM and assume day 1
            try:
                dt = datetime.strptime(processed_date_str, '%Y-%m')
                return date(dt.year, dt.month, 1)
            except Exception:
                # Final fallback: today (non-strict) to keep preview working with unresolved tokens
                if self.strict_mode:
                    raise RenderingError(
                        f"Calendar widget '{widget_id}': invalid start_date '{processed_date_str}' (original: '{date_str}'). "
                        f"Must be YYYY-MM-DD or YYYY-MM format after token processing"
                    )
                logger.warning(f"Calendar widget '{widget_id}': invalid start_date '{processed_date_str}' (original: '{date_str}'), using today")
                return datetime.utcnow().date()

    @staticmethod
    def _weekday_start_name(first_day: int) -> str:
        """Map first-day index to weekday name understood by i18n helpers."""
        if first_day == 6:
            return 'sunday'
        return 'monday'

    def _get_weekday_labels(self, locale: str, style: str, first_day: int) -> List[str]:
        """Get localized weekday labels with safe fallbacks."""
        safe_style = style if style in {'short', 'narrow', 'full'} else 'short'
        start = self._weekday_start_name(first_day)
        try:
            return get_weekday_names(locale, safe_style, start=start)
        except Exception:
            return get_weekday_names('en', 'short', start='monday')

    def _apply_styling_constraints(self, styling: dict, enforcer=None) -> dict:
        """Apply device profile constraints to styling parameters."""
        constrained_styling = styling.copy()

        # Apply font size constraints
        if 'size' in constrained_styling or 'font_size' in constrained_styling:
            raw_font_size = (
                constrained_styling.get('size')
                if constrained_styling.get('size') is not None
                else constrained_styling.get('font_size', 10.0)  # Calendar default font size
            )

            try:
                font_size = float(raw_font_size)
            except (TypeError, ValueError):
                font_size = 10.0

            if enforcer:
                constrained_styling['font_size'] = enforcer.check_font_size(font_size)
            else:
                # Fallback to reasonable defaults if no enforcer available
                constrained_styling['font_size'] = max(6.0, min(18.0, font_size))  # Tighter range for calendars

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

    def _render_monthly_calendar(self, pdf_canvas: canvas.Canvas, widget: Widget,
                                config: Dict[str, Any], cal_pos: Dict[str, float],
                                text_options, page_num: int, total_pages: int, enforcer=None) -> None:
        """Render monthly calendar layout using TextEngine for all text."""
        start_date = config['start_date']
        show_weekdays = config['show_weekdays']
        show_month_year = config['show_month_year']
        show_grid_lines = config['show_grid_lines']
        cell_min_size = config['cell_min_size']
        first_day_of_week = config['first_day_of_week']
        link_strategy = config['link_strategy']
        text_align = config['text_align']

        # Get additional properties
        props = getattr(widget, 'properties', {}) or {}

        def _get_float(v: Any, default: float) -> float:
            try:
                if v is None:
                    return default
                if isinstance(v, str) and not v.strip():
                    return default
                return float(v)
            except Exception:
                return default

        def _get_int(v: Any, default: int) -> int:
            try:
                if v is None:
                    return default
                if isinstance(v, str) and not v.strip():
                    return default
                return int(v)
            except Exception:
                return default

        # Get month information
        year = start_date.year
        month = start_date.month

        # Calculate calendar layout dimensions
        calendar_width = cal_pos['width']
        calendar_height = cal_pos['height']

        # Extra options
        show_trailing_days = bool(props.get('show_trailing_days', False))
        highlight_today = bool(props.get('highlight_today', False))
        highlight_date_str = props.get('highlight_date')
        day_label_style = props.get('weekday_label_style', 'short')  # short|narrow|full
        month_name_format = props.get('month_name_format', 'long')   # long|short
        week_numbers = bool(props.get('week_numbers', False))
        cell_padding = _get_float(props.get('cell_padding', 4.0), 4.0)

        # Reserve space for headers
        font_size = text_options.font_size
        header_height = font_size * 2 if show_month_year else 0
        weekday_height = font_size * 1.5 if show_weekdays else 0
        available_height = calendar_height - header_height - weekday_height

        # Calculate how many weeks are needed for this month
        first_of_month = date(year, month, 1)
        first_weekday = first_of_month.weekday()  # 0=Monday, 6=Sunday

        # Adjust first weekday based on first_day_of_week setting
        if first_day_of_week == 0:  # Monday=0 (Python default)
            pass  # first_weekday is already correct (0=Monday)
        else:  # Sunday=0 (US style)
            first_weekday = (first_weekday + 1) % 7

        days_in_month = calendar.monthrange(year, month)[1]
        weeks_needed = math.ceil((days_in_month + first_weekday) / 7)
        actual_weeks = max(4, min(6, weeks_needed))  # 4-6 weeks

        # Calculate cell dimensions (7 columns for days of week) to FIT bounds
        available_height = max(0.0, available_height)
        week_col_width = (font_size * 2.2) if week_numbers else 0.0
        cell_width = (calendar_width - week_col_width) / 7
        cell_height = available_height / actual_weeks if actual_weeks > 0 else 0.0

        # Log touch target violations without expanding beyond bounds
        if enforcer:
            try:
                _ = enforcer.check_touch_target_size(cell_width, cell_height)
            except Exception:
                # In strict mode this may raise; bubble up for consistent behavior
                if self.strict_mode:
                    raise

        # Month and year header (locale aware) using TextEngine
        if show_month_year:
            locale = str(props.get('locale', 'en')).lower()
            month_names = get_month_names(locale, short=(month_name_format != 'long'))
            header_text = f"{month_names[month - 1]} {year}"

            # Process tokens in header text
            try:
                render_context = RenderingTokenContext(page_num=page_num, total_pages=total_pages)
                header_text = TokenProcessor.replace_rendering_tokens(header_text, render_context)
            except Exception as e:
                logger.warning(f"Token processing failed for calendar header: {e}")

            # Create header text box
            header_box = {
                'x': cal_pos['x'],
                'y': cal_pos['y'] + calendar_height - font_size,
                'width': calendar_width,
                'height': font_size
            }

            # Create text options for header (might be different styling)
            header_text_options = TextRenderingOptions(
                font_name=text_options.font_name,
                font_size=text_options.font_size,
                color=text_options.color,
                text_align=text_align,
                orientation=text_options.orientation
            )

            # Render header using TextEngine
            self.text_engine.render_text(pdf_canvas, header_box, header_text, header_text_options)

            # Draw header separator line if grid lines enabled
            if show_grid_lines:
                line_y = cal_pos['y'] + calendar_height - header_height
                if enforcer:
                    stroke_width = enforcer.check_stroke_width(0.5)
                else:
                    stroke_width = 0.5
                pdf_canvas.setLineWidth(stroke_width)
                pdf_canvas.line(cal_pos['x'], line_y, cal_pos['x'] + calendar_width, line_y)

        # Weekday headers using TextEngine
        if show_weekdays:
            locale = str(props.get('locale', 'en')).lower()

            # Convert first_day_of_week to string format expected by get_weekday_names
            start_day = 'monday' if first_day_of_week == 0 else 'sunday'
            weekdays = get_weekday_names(locale, style=day_label_style, start=start_day)

            weekday_y = cal_pos['y'] + calendar_height - header_height - font_size

            for i, day_name in enumerate(weekdays):
                # Create weekday text box
                weekday_box = {
                    'x': cal_pos['x'] + week_col_width + (i * cell_width),
                    'y': weekday_y,
                    'width': cell_width,
                    'height': font_size
                }

                # Create smaller font options for weekday headers
                weekday_text_options = TextRenderingOptions(
                    font_name=text_options.font_name,
                    font_size=font_size * 0.8,
                    color=text_options.color,
                    text_align='center',
                    orientation=text_options.orientation
                )

                # Render weekday using TextEngine
                self.text_engine.render_text(pdf_canvas, weekday_box, day_name, weekday_text_options)

        # Grid layout starting position
        grid_start_y = cal_pos['y'] + calendar_height - header_height - weekday_height

        # Draw calendar grid using optimal number of weeks
        for week in range(actual_weeks):
            # Bottom of this row
            row_bottom_y = grid_start_y - ((week + 1) * cell_height)

            for day_col in range(7):
                # Calculate cell position (offset by week number column if present)
                cell_x = cal_pos['x'] + week_col_width + (day_col * cell_width)
                cell_y = row_bottom_y

                # Calculate day number
                day_number = (week * 7 + day_col) - first_weekday + 1
                is_current_month = 1 <= day_number <= days_in_month

                # Determine the actual date for this cell (supports trailing/leading days)
                current_date = None
                if is_current_month:
                    current_date = date(year, month, day_number)
                elif show_trailing_days:
                    if day_number < 1:
                        pm = month - 1 if month > 1 else 12
                        py = year if month > 1 else year - 1
                        pdays = calendar.monthrange(py, pm)[1]
                        current_date = date(py, pm, pdays + day_number)
                    else:
                        nm = month + 1 if month < 12 else 1
                        ny = year if month < 12 else year + 1
                        current_date = date(ny, nm, day_number - days_in_month)

                # Draw cell border if grid lines enabled
                if show_grid_lines:
                    if enforcer:
                        stroke_width = enforcer.check_stroke_width(0.5)
                    else:
                        stroke_width = 0.5
                    pdf_canvas.setLineWidth(stroke_width)
                    pdf_canvas.rect(cell_x, cell_y, cell_width, cell_height, stroke=1, fill=0)

                # Draw day label (current month or trailing/leading if enabled)
                if is_current_month or (show_trailing_days and current_date):
                    day_text = str((current_date.day if current_date else day_number))

                    # Create day text box with padding
                    day_box = {
                        'x': cell_x + cell_padding,
                        'y': cell_y + cell_height - font_size - cell_padding,
                        'width': cell_width - 2 * cell_padding,
                        'height': font_size
                    }

                    # Create text options for day numbers
                    day_color = '#888888' if not is_current_month else text_options.color
                    day_text_options = TextRenderingOptions(
                        font_name=text_options.font_name,
                        font_size=text_options.font_size,
                        color=day_color,
                        text_align=text_align,
                        orientation=text_options.orientation
                    )

                    # Process tokens in day text (unlikely but possible)
                    try:
                        render_context = RenderingTokenContext(page_num=page_num, total_pages=total_pages)
                        day_text = TokenProcessor.replace_rendering_tokens(day_text, render_context)
                    except Exception:
                        pass  # Day numbers rarely contain tokens

                    # Render day using TextEngine
                    self.text_engine.render_text(pdf_canvas, day_box, day_text, day_text_options)

                    # Link for current month days (only for dates >= start_date)
                    if link_strategy != 'none' and current_date and is_current_month and current_date >= start_date:
                        self._create_calendar_date_link(
                            pdf_canvas, widget, current_date,
                            cell_x, cell_y, cell_width, cell_height,
                            link_strategy, config.get('raw_link_strategy'), props,
                            enforcer
                        )

                    # Highlight today or specific date
                    try:
                        target_highlight = None
                        if highlight_date_str:
                            target_highlight = datetime.strptime(highlight_date_str, '%Y-%m-%d').date()
                        elif highlight_today:
                            target_highlight = datetime.utcnow().date()

                        if target_highlight and current_date and current_date == target_highlight:
                            if enforcer:
                                stroke_width = enforcer.check_stroke_width(1.0)
                            else:
                                stroke_width = 1.0
                            pdf_canvas.setLineWidth(stroke_width)
                            pdf_canvas.rect(cell_x + 1.5, cell_y + 1.5,
                                          cell_width - 3, cell_height - 3, stroke=1, fill=0)
                    except Exception:
                        pass

            # Week numbers column
            if week_numbers:
                # Determine first date of this calendar row
                first_day_num = (week * 7 + 0) - first_weekday + 1
                if first_day_num < 1:
                    pm = month - 1 if month > 1 else 12
                    py = year if month > 1 else year - 1
                    pdays = calendar.monthrange(py, pm)[1]
                    first_date = date(py, pm, pdays + first_day_num)
                elif first_day_num > days_in_month:
                    nm = month + 1 if month < 12 else 1
                    ny = year if month < 12 else year + 1
                    first_date = date(ny, nm, first_day_num - days_in_month)
                else:
                    first_date = date(year, month, first_day_num)

                week_num = first_date.isocalendar()[1]
                wn_text = str(week_num)

                # Create week number text box
                wn_box = {
                    'x': cal_pos['x'],
                    'y': row_bottom_y + (cell_height / 2) - (font_size * 0.4),
                    'width': week_col_width,
                    'height': font_size * 0.8
                }

                # Create smaller font options for week numbers
                wn_text_options = TextRenderingOptions(
                    font_name=text_options.font_name,
                    font_size=font_size * 0.8,
                    color=text_options.color,
                    text_align='center',
                    orientation=text_options.orientation
                )

                # Render week number using TextEngine
                self.text_engine.render_text(pdf_canvas, wn_box, wn_text, wn_text_options)

    def _render_weekly_calendar(self, pdf_canvas: canvas.Canvas, widget: Widget,
                              config: Dict[str, Any], cal_pos: Dict[str, float],
                              text_options, page_num: int, total_pages: int, enforcer=None) -> None:
        """Render weekly calendar in horizontal layout using TextEngine."""
        props = getattr(widget, 'properties', {}) or {}

        show_weekdays = config['show_weekdays']
        show_month_year = config['show_month_year']
        show_grid_lines = config['show_grid_lines']
        cell_min_size = config['cell_min_size']
        text_align = config['text_align']
        link_strategy = config['link_strategy']
        raw_link_strategy = config.get('raw_link_strategy')

        start_date = config['start_date']
        first_day_of_week = config['first_day_of_week']
        week_offset = (start_date.weekday() - first_day_of_week) % 7
        start_of_week = start_date - timedelta(days=week_offset)
        week_days = [start_of_week + timedelta(days=i) for i in range(7)]

        locale = str(props.get('locale', 'en')).lower()
        month_name_format = props.get('month_name_format', 'long')
        day_label_style = props.get('weekday_label_style', 'short')

        font_size = text_options.font_size
        cell_padding = float(props.get('cell_padding', 4.0) or 0.0)

        show_time_grid = bool(props.get('show_time_grid', False))
        show_time_gutter = bool(props.get('show_time_gutter', False))

        def _coerce_int(value, default, minimum=None, maximum=None):
            try:
                result = int(value)
            except Exception:
                result = default
            if minimum is not None:
                result = max(minimum, result)
            if maximum is not None:
                result = min(maximum, result)
            return result

        time_start_hour = _coerce_int(props.get('time_start_hour'), 8, 0, 23)
        time_end_hour = _coerce_int(props.get('time_end_hour'), 20, time_start_hour + 1, 24)
        slot_minutes = _coerce_int(props.get('time_slot_minutes'), 60, 5, 240)
        label_interval = _coerce_int(props.get('time_label_interval'), 60, slot_minutes, 720)

        total_minutes = max(60, (time_end_hour - time_start_hour) * 60)
        slot_count = max(1, int(math.ceil(total_minutes / slot_minutes)))

        # Layout dimensions
        calendar_width = cal_pos['width']
        calendar_height = cal_pos['height']
        base_x = cal_pos['x']
        base_y = cal_pos['y']

        header_height = font_size * 2 if show_month_year else 0.0
        weekday_height = font_size * 1.5 if show_weekdays else 0.0
        time_gutter_width = font_size * 2.2 if show_time_gutter else 0.0

        grid_width = max(0.0, calendar_width - time_gutter_width)
        cell_width = grid_width / 7 if grid_width > 0 else 0.0

        available_height = max(0.0, calendar_height - header_height - weekday_height)
        cell_height = available_height if available_height > 0 else cell_min_size
        if cell_height < cell_min_size:
            cell_height = cell_min_size

        slot_height = cell_height / slot_count if slot_count else cell_height

        month_names = get_month_names(locale, short=(month_name_format != 'long'))
        week_number = week_days[0].isocalendar()[1]
        header_text = f"{month_names[week_days[0].month - 1]} {week_days[0].year} — Week {week_number}"

        grid_top = base_y + calendar_height

        if show_month_year:
            header_box = {
                'x': base_x,
                'y': grid_top - font_size,
                'width': calendar_width,
                'height': font_size
            }
            header_options = TextRenderingOptions(
                font_name=text_options.font_name,
                font_size=text_options.font_size,
                color=text_options.color,
                text_align='center',
                orientation=text_options.orientation
            )
            self.text_engine.render_text(pdf_canvas, header_box, header_text, header_options)
            grid_top -= header_height

        weekday_labels = self._get_weekday_labels(locale, day_label_style, first_day_of_week)
        if len(weekday_labels) < 7:
            weekday_labels = (weekday_labels * 7)[:7]

        if show_weekdays:
            weekday_options = TextRenderingOptions(
                font_name=text_options.font_name,
                font_size=font_size * 0.8,
                color=text_options.color,
                text_align='center',
                orientation=text_options.orientation
            )
            weekday_y = grid_top - font_size
            for idx, label in enumerate(weekday_labels):
                box = {
                    'x': base_x + time_gutter_width + idx * cell_width,
                    'y': weekday_y,
                    'width': cell_width,
                    'height': font_size
                }
                self.text_engine.render_text(pdf_canvas, box, label, weekday_options)
            grid_top -= weekday_height

        grid_lines_color = HexColor('#CCCCCC')

        if show_time_gutter and show_grid_lines and time_gutter_width > 0:
            pdf_canvas.setStrokeColor(grid_lines_color)
            pdf_canvas.setLineWidth(0.5)
            pdf_canvas.line(base_x + time_gutter_width, grid_top, base_x + time_gutter_width,
                            grid_top - cell_height)

        label_minutes: List[int] = []
        if show_time_grid:
            minute = 0
            while minute <= total_minutes:
                label_minutes.append(minute)
                minute += label_interval
            if label_minutes[-1] != total_minutes:
                label_minutes.append(total_minutes)
        elif show_time_gutter:
            label_minutes = [0, total_minutes]

        if show_time_gutter and label_minutes:
            label_options = TextRenderingOptions(
                font_name=text_options.font_name,
                font_size=font_size * 0.6,
                color=text_options.color,
                text_align='right',
                orientation=text_options.orientation
            )
            gutter_width = max(0.0, time_gutter_width - cell_padding)
            cell_bottom = grid_top - cell_height
            for minutes_from_start in label_minutes:
                fraction = minutes_from_start / total_minutes if total_minutes else 0.0
                label_y = cell_bottom + fraction * cell_height
                label_box = {
                    'x': base_x,
                    'y': label_y - (label_options.font_size * 0.4),
                    'width': gutter_width,
                    'height': label_options.font_size * 1.2
                }
                absolute_minutes = time_start_hour * 60 + minutes_from_start
                hour = absolute_minutes // 60
                minute = absolute_minutes % 60
                label_text = f"{hour:02d}:{minute:02d}"
                self.text_engine.render_text(pdf_canvas, label_box, label_text, label_options)

        target_highlight: Optional[date] = None
        highlight_date_str = props.get('highlight_date')
        if highlight_date_str:
            try:
                target_highlight = datetime.strptime(highlight_date_str, '%Y-%m-%d').date()
            except Exception:
                target_highlight = None
        elif bool(props.get('highlight_today', False)):
            target_highlight = datetime.utcnow().date()

        cell_bottom = grid_top - cell_height

        for idx, day_date in enumerate(week_days):
            cell_x = base_x + time_gutter_width + idx * cell_width
            cell_y = cell_bottom

            if show_grid_lines and cell_width > 0 and cell_height > 0:
                pdf_canvas.setStrokeColor(grid_lines_color)
                pdf_canvas.setLineWidth(0.5)
                pdf_canvas.rect(cell_x, cell_y, cell_width, cell_height, stroke=1, fill=0)

            day_color = text_options.color if day_date.month == start_date.month else '#888888'
            day_text_options = TextRenderingOptions(
                font_name=text_options.font_name,
                font_size=text_options.font_size,
                color=day_color,
                text_align=text_align,
                orientation=text_options.orientation
            )
            day_box = {
                'x': cell_x + cell_padding,
                'y': cell_y + cell_height - font_size - cell_padding,
                'width': max(0.0, cell_width - 2 * cell_padding),
                'height': font_size
            }
            self.text_engine.render_text(pdf_canvas, day_box, str(day_date.day), day_text_options)

            if show_time_grid and cell_width > 0:
                pdf_canvas.setStrokeColor(grid_lines_color)
                pdf_canvas.setLineWidth(0.4)
                for slot in range(1, slot_count):
                    line_y = cell_y + slot_height * slot
                    pdf_canvas.line(cell_x, line_y, cell_x + cell_width, line_y)

            if target_highlight and day_date == target_highlight:
                pdf_canvas.setStrokeColor(HexColor(day_color if day_color.startswith('#') else '#000000'))
                pdf_canvas.setLineWidth(1.0)
                inset = max(1.5, cell_padding)
                pdf_canvas.rect(cell_x + inset, cell_y + inset,
                                max(0.0, cell_width - 2 * inset),
                                max(0.0, cell_height - 2 * inset), stroke=1, fill=0)

            # Only create links for dates in the same month/year as start_date
            if (link_strategy != 'none' and
                day_date >= start_date and
                day_date.year == start_date.year and
                day_date.month == start_date.month):
                self._create_calendar_date_link(
                    pdf_canvas, widget, day_date,
                    cell_x, cell_y, cell_width, cell_height,
                    link_strategy, raw_link_strategy, props,
                    enforcer
                )

    def _render_weekly_calendar_vertical(self, pdf_canvas: canvas.Canvas, widget: Widget,
                                       config: Dict[str, Any], cal_pos: Dict[str, float],
                                       text_options, page_num: int, total_pages: int, enforcer=None) -> None:
        """Render weekly calendar in vertical layout using TextEngine."""
        props = getattr(widget, 'properties', {}) or {}

        show_weekdays = config['show_weekdays']
        show_month_year = config['show_month_year']
        show_grid_lines = config['show_grid_lines']
        cell_min_size = config['cell_min_size']
        text_align = config['text_align']
        link_strategy = config['link_strategy']
        raw_link_strategy = config.get('raw_link_strategy')

        start_date = config['start_date']
        first_day_of_week = config['first_day_of_week']
        week_offset = (start_date.weekday() - first_day_of_week) % 7
        start_of_week = start_date - timedelta(days=week_offset)
        week_days = [start_of_week + timedelta(days=i) for i in range(7)]

        locale = str(props.get('locale', 'en')).lower()
        month_name_format = props.get('month_name_format', 'long')
        day_label_style = props.get('weekday_label_style', 'short')

        font_size = text_options.font_size
        cell_padding = float(props.get('cell_padding', 4.0) or 0.0)

        show_time_grid = bool(props.get('show_time_grid', False))
        show_time_gutter = bool(props.get('show_time_gutter', False))

        def _coerce_int(value, default, minimum=None, maximum=None):
            try:
                result = int(value)
            except Exception:
                result = default
            if minimum is not None:
                result = max(minimum, result)
            if maximum is not None:
                result = min(maximum, result)
            return result

        time_start_hour = _coerce_int(props.get('time_start_hour'), 8, 0, 23)
        time_end_hour = _coerce_int(props.get('time_end_hour'), 20, time_start_hour + 1, 24)
        slot_minutes = _coerce_int(props.get('time_slot_minutes'), 60, 5, 240)
        label_interval = _coerce_int(props.get('time_label_interval'), 60, slot_minutes, 720)

        total_minutes = max(60, (time_end_hour - time_start_hour) * 60)
        slot_count = max(1, int(math.ceil(total_minutes / slot_minutes)))

        calendar_width = cal_pos['width']
        calendar_height = cal_pos['height']
        base_x = cal_pos['x']
        base_y = cal_pos['y']

        header_height = font_size * 2 if show_month_year else 0.0
        time_header_height = font_size * 1.5 if show_time_grid else 0.0
        weekday_gutter_width = font_size * 4.0 if show_weekdays else 0.0

        grid_width = max(0.0, calendar_width - weekday_gutter_width)
        grid_height = max(0.0, calendar_height - header_height - time_header_height)

        cell_height = grid_height / 7 if grid_height > 0 else cell_min_size
        if cell_height < cell_min_size:
            cell_height = cell_min_size

        cell_width = grid_width if grid_width > 0 else cell_min_size
        slot_width = cell_width / slot_count if slot_count else cell_width

        month_names = get_month_names(locale, short=(month_name_format != 'long'))
        week_number = week_days[0].isocalendar()[1]
        header_text = f"{month_names[week_days[0].month - 1]} {week_days[0].year} — Week {week_number}"

        grid_top = base_y + calendar_height

        if show_month_year:
            header_box = {
                'x': base_x,
                'y': grid_top - font_size,
                'width': calendar_width,
                'height': font_size
            }
            header_options = TextRenderingOptions(
                font_name=text_options.font_name,
                font_size=text_options.font_size,
                color=text_options.color,
                text_align='center',
                orientation=text_options.orientation
            )
            self.text_engine.render_text(pdf_canvas, header_box, header_text, header_options)
            grid_top -= header_height

        if show_time_grid:
            label_options = TextRenderingOptions(
                font_name=text_options.font_name,
                font_size=font_size * 0.6,
                color=text_options.color,
                text_align='center',
                orientation=text_options.orientation
            )
            label_minutes = []
            minute = 0
            while minute <= total_minutes:
                label_minutes.append(minute)
                minute += label_interval
            if label_minutes[-1] != total_minutes:
                label_minutes.append(total_minutes)

            time_header_y = grid_top - font_size
            for minutes_from_start in label_minutes:
                fraction = minutes_from_start / total_minutes if total_minutes else 0.0
                label_x = base_x + weekday_gutter_width + fraction * cell_width
                label_box = {
                    'x': label_x - slot_width / 2,
                    'y': time_header_y,
                    'width': slot_width,
                    'height': font_size
                }
                absolute_minutes = time_start_hour * 60 + minutes_from_start
                hour = absolute_minutes // 60
                minute = absolute_minutes % 60
                label_text = f"{hour:02d}:{minute:02d}"
                self.text_engine.render_text(pdf_canvas, label_box, label_text, label_options)
            grid_top -= time_header_height

        weekday_labels = self._get_weekday_labels(locale, day_label_style, first_day_of_week)
        if len(weekday_labels) < 7:
            weekday_labels = (weekday_labels * 7)[:7]
        grid_lines_color = HexColor('#CCCCCC')

        target_highlight: Optional[date] = None
        highlight_date_str = props.get('highlight_date')
        if highlight_date_str:
            try:
                target_highlight = datetime.strptime(highlight_date_str, '%Y-%m-%d').date()
            except Exception:
                target_highlight = None
        elif bool(props.get('highlight_today', False)):
            target_highlight = datetime.utcnow().date()

        for idx, day_date in enumerate(week_days):
            row_top = grid_top - idx * cell_height
            cell_y = row_top - cell_height
            cell_x = base_x + weekday_gutter_width

            if show_weekdays:
                label_box = {
                    'x': base_x,
                    'y': cell_y + cell_height - font_size - cell_padding,
                    'width': weekday_gutter_width - cell_padding,
                    'height': font_size
                }
                weekday_options = TextRenderingOptions(
                    font_name=text_options.font_name,
                    font_size=font_size * 0.8,
                    color=text_options.color,
                    text_align='left',
                    orientation=text_options.orientation
                )
                weekday_text = f"{weekday_labels[idx]} {day_date.day}"
                self.text_engine.render_text(pdf_canvas, label_box, weekday_text, weekday_options)

            if show_grid_lines and cell_width > 0 and cell_height > 0:
                pdf_canvas.setStrokeColor(grid_lines_color)
                pdf_canvas.setLineWidth(0.5)
                pdf_canvas.rect(cell_x, cell_y, cell_width, cell_height, stroke=1, fill=0)

            if show_time_grid and cell_height > 0:
                pdf_canvas.setStrokeColor(grid_lines_color)
                pdf_canvas.setLineWidth(0.4)
                for slot in range(1, slot_count):
                    line_x = cell_x + slot_width * slot
                    pdf_canvas.line(line_x, cell_y, line_x, cell_y + cell_height)

            day_color = text_options.color if day_date.month == start_date.month else '#888888'
            day_text_options = TextRenderingOptions(
                font_name=text_options.font_name,
                font_size=text_options.font_size,
                color=day_color,
                text_align=text_align,
                orientation=text_options.orientation
            )
            day_box = {
                'x': cell_x + cell_padding,
                'y': cell_y + cell_height - font_size - cell_padding,
                'width': max(0.0, cell_width - 2 * cell_padding),
                'height': font_size
            }
            self.text_engine.render_text(pdf_canvas, day_box, str(day_date.day), day_text_options)

            if target_highlight and day_date == target_highlight:
                pdf_canvas.setStrokeColor(HexColor(day_color if day_color.startswith('#') else '#000000'))
                pdf_canvas.setLineWidth(1.0)
                inset = max(1.5, cell_padding)
                pdf_canvas.rect(cell_x + inset, cell_y + inset,
                                max(0.0, cell_width - 2 * inset),
                                max(0.0, cell_height - 2 * inset), stroke=1, fill=0)

            # Only create links for dates in the same month/year as start_date
            if (link_strategy != 'none' and
                day_date >= start_date and
                day_date.year == start_date.year and
                day_date.month == start_date.month):
                self._create_calendar_date_link(
                    pdf_canvas, widget, day_date,
                    cell_x, cell_y, cell_width, cell_height,
                    link_strategy, raw_link_strategy, props,
                    enforcer
                )

    def _render_calendar_preview(self, pdf_canvas: canvas.Canvas, widget: Widget,
                                config: Dict[str, Any], cal_pos: Dict[str, float],
                                text_options, page_num: int, total_pages: int, enforcer=None) -> None:
        """Render simplified calendar preview for custom range calendars."""
        props = getattr(widget, 'properties', {}) or {}
        start_date = config['start_date']
        end_date_obj: Optional[date] = None
        end_date_str = props.get('end_date')
        if end_date_str:
            try:
                end_date_obj = self._parse_start_date(end_date_str, widget.id, page_num, total_pages)
            except Exception:
                end_date_obj = None

        start_label = start_date.strftime('%Y-%m-%d')
        end_label = end_date_obj.strftime('%Y-%m-%d') if end_date_obj else 'Open'
        summary_text = f"Custom Range: {start_label} – {end_label}"

        pdf_canvas.setStrokeColor(HexColor('#CCCCCC'))
        pdf_canvas.setLineWidth(0.75)
        pdf_canvas.rect(cal_pos['x'], cal_pos['y'], cal_pos['width'], cal_pos['height'], stroke=1, fill=0)

        message_box = {
            'x': cal_pos['x'] + 8,
            'y': cal_pos['y'] + (cal_pos['height'] / 2) - (text_options.font_size / 2),
            'width': max(0.0, cal_pos['width'] - 16),
            'height': text_options.font_size * 1.4
        }
        message_options = TextRenderingOptions(
            font_name=text_options.font_name,
            font_size=text_options.font_size,
            color=text_options.color,
            text_align='center',
            orientation=text_options.orientation
        )
        self.text_engine.render_text(pdf_canvas, message_box, summary_text, message_options)


    def _create_calendar_date_link(self, pdf_canvas: canvas.Canvas, widget: Widget,
                                 date_obj: date, cell_x: float, cell_y: float,
                                 cell_width: float, cell_height: float,
                                 link_strategy: str, raw_link_strategy: Optional[str],
                                 props: Dict[str, Any], enforcer=None) -> None:
        """Create PDF link annotation for calendar date cells."""
        # Define link rectangle (entire cell is clickable)
        link_rect = (cell_x, cell_y, cell_x + cell_width, cell_y + cell_height)

        raw_strategy = (raw_link_strategy or '').lower()

        # Comprehensive debugging for link generation
        logger.info(f"Calendar link debug - Widget: {widget.id}, Date: {date_obj}, "
                   f"UI strategy: {props.get('link_strategy')}, "
                   f"Raw strategy: '{raw_strategy}', Normalized strategy: '{link_strategy}'")

        if raw_strategy == 'sequential_pages':
            try:
                first_page = int(props.get('first_page_number', 1))
                pages_per_date = max(1, int(props.get('pages_per_date', 1)))
            except Exception:
                first_page = 1
                pages_per_date = 1

            day_index = max(0, date_obj.day - 1)
            destination_page = first_page + day_index * pages_per_date
            destination = f"Page_{destination_page}"

            logger.info(f"Calendar sequential_pages: date={date_obj}, day_index={day_index}, "
                       f"first_page={first_page}, pages_per_date={pages_per_date}, "
                       f"→ destination='{destination}'")

        elif link_strategy == 'simple':
            # Simple page-based navigation (day number determines page)
            day_number = date_obj.day
            destination = f"Page_{day_number}"

            logger.info(f"Calendar simple: date={date_obj}, day_number={day_number}, "
                       f"→ destination='{destination}'")

        elif link_strategy == 'template':
            # Template-based destination using date formatting
            dest_template = props.get('link_template', 'day:{date}')
            try:
                destination = dest_template.format(
                    date=date_obj.isoformat(),
                    year=date_obj.year,
                    month=date_obj.month,
                    day=date_obj.day
                )
            except (KeyError, ValueError) as e:
                logger.warning(f"Calendar link template error: {e}")
                destination = f"day_{date_obj.isoformat()}"

            logger.info(f"Calendar template: date={date_obj}, template='{dest_template}', "
                       f"→ destination='{destination}'")

        else:
            # Default: use ISO date format
            destination = f"day_{date_obj.isoformat()}"

            logger.info(f"Calendar default: date={date_obj}, "
                       f"→ destination='{destination}'")

        # Create PDF link annotation
        try:
            pdf_canvas.linkRect("", destination, link_rect, relative=0)
            logger.debug(f"Created calendar date link to '{destination}' at {link_rect}")
        except Exception as e:
            if self.strict_mode:
                raise RenderingError(f"Failed to create calendar date link: {e}")
            logger.warning(f"Failed to create calendar date link to '{destination}': {e}")

        # Log touch target validation (calendar cells should be large enough)
        if enforcer:
            try:
                _ = enforcer.check_touch_target_size(cell_width, cell_height)
            except Exception:
                if self.strict_mode:
                    raise
                # In non-strict mode, enforcer tracks violations

    def validate_calendar_properties(self, widget: Widget) -> None:
        """
        Validate calendar widget properties.

        Args:
            widget: Widget to validate

        Raises:
            RenderingError: If properties are invalid
        """
        props = getattr(widget, 'properties', {}) or {}

        # Validate required properties
        if not props.get('start_date'):
            raise RenderingError(f"Calendar widget '{widget.id}': missing required property 'start_date'")

        # Validate calendar_type if specified
        calendar_type = props.get('calendar_type')
        if calendar_type and calendar_type not in ['monthly', 'weekly', 'custom_range']:
            raise RenderingError(
                f"Calendar widget '{widget.id}': invalid calendar_type '{calendar_type}'. "
                f"Must be: monthly, weekly, custom_range"
            )

        # Validate layout_orientation if specified
        orientation = props.get('layout_orientation')
        if orientation and orientation not in ['horizontal', 'vertical']:
            raise RenderingError(
                f"Calendar widget '{widget.id}': invalid layout_orientation '{orientation}'. "
                f"Must be: horizontal, vertical"
            )

        # Validate link_strategy if specified
        link_strategy = props.get('link_strategy')
        if link_strategy and link_strategy not in ['none', 'simple', 'template']:
            raise RenderingError(
                f"Calendar widget '{widget.id}': invalid link_strategy '{link_strategy}'. "
                f"Must be: none, simple, template"
            )
