/**
 * Day List widget preview component.
 *
 * Renders a vertical list of days in a month with space for notes.
 * Follows CLAUDE.md coding standards - consistent with PDF renderer.
 */

import React from 'react';
import { Widget } from '@/types';
import { getFontCSS } from '@/lib/fonts';
import { getWeekdayNames, getMonthNames, SupportedLocale } from '@/lib/i18n';

interface DayListWidgetProps {
  widget: Widget;
}

const DayListWidget: React.FC<DayListWidgetProps> = ({ widget }) => {
  const props = widget.properties || {};
  const styling = widget.styling || {};

  // Parse configuration (matching backend logic)
  // Handle token-based dates in UI preview by using sample data
  const parseDateSafely = (dateStr: string): Date => {
    if (!dateStr) {
      return new Date();
    }

    // Check if date contains tokens (e.g., {year}, {month})
    if (dateStr.includes('{') && dateStr.includes('}')) {
      // Use current date as preview sample
      return new Date();
    }

    const parsed = new Date(dateStr);
    // Check if date is valid
    if (isNaN(parsed.getTime())) {
      // Fallback to current date for preview
      return new Date();
    }

    return parsed;
  };

  const startDate = parseDateSafely(props.start_date || '');
  const showDayNumbers = props.show_day_numbers !== false;
  const showWeekdayNames = props.show_weekday_names !== false;
  const weekdayFormat = props.weekday_format || 'short';
  const rowHeight = Math.max(10, props.row_height || 20);
  const showNotesLines = props.show_notes_lines !== false;
  const notesLineCount = Math.max(0, parseInt(props.notes_line_count || '1'));
  const highlightWeekends = props.highlight_weekends === true;
  const weekendColor = props.weekend_color || '#F0F0F0';
  const firstDayOfWeek = props.first_day_of_week || 'monday';
  const locale = (props.locale as SupportedLocale) || 'en';
  const showMonthHeader = props.show_month_header === true;
  const showYearInHeader = props.show_year_in_header === true;
  const monthNameFormat = props.month_name_format || 'long';

  // Get localized weekday names
  const weekdayNames = getWeekdayNames(locale, weekdayFormat as 'short' | 'narrow' | 'full', firstDayOfWeek);

  // Get localized month names
  const monthNames = getMonthNames(locale, monthNameFormat === 'short');

  // Calculate days in month
  const year = startDate.getFullYear();
  const month = startDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Font styling
  const fontSize = Math.max(6, styling.size || 10);
  const fontColor = styling.color || '#000000';
  const fontCSS = getFontCSS(styling.font);

  // Column widths (matching backend logic) - adapt weekday width to format
  const dayNumWidth = showDayNumbers ? 30 : 0;
  let weekdayWidth = 0;
  if (showWeekdayNames) {
    if (weekdayFormat === 'full') {
      weekdayWidth = 80; // Monday, Tuesday, etc.
    } else if (weekdayFormat === 'short') {
      weekdayWidth = 40; // Mon, Tue, etc.
    } else { // narrow
      weekdayWidth = 15; // M, T, etc.
    }
  }

  // Calculate first day offset for weekday calculation
  const firstDayOffset = firstDayOfWeek === 'monday' ? 0 : 6;

  // Calculate header space
  const showHeader = showMonthHeader || showYearInHeader;
  const headerHeight = showHeader ? fontSize * 1.8 : 0;

  // Build header text
  const headerParts = [];
  if (showMonthHeader) {
    headerParts.push(monthNames[month]);
  }
  if (showYearInHeader) {
    headerParts.push(year.toString());
  }
  const headerText = headerParts.join(' ');

  // Calculate available height for day rows
  const availableHeight = widget.position.height - headerHeight;

  // Render each day
  const dayRows = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const weekdayIndex = (currentDate.getDay() - (firstDayOffset === 0 ? 1 : 0) + 7) % 7;
    const isWeekend = weekdayIndex >= 5; // Saturday and Sunday

    // Check if row would exceed available height (accounting for header)
    const rowY = headerHeight + (day - 1) * rowHeight;
    if (rowY + rowHeight > widget.position.height) {
      break; // Stop rendering if exceeds height
    }

    dayRows.push(
      <div
        key={day}
        className="absolute flex items-start w-full"
        style={{
          top: rowY,
          left: 0,
          height: rowHeight,
          backgroundColor: highlightWeekends && isWeekend ? weekendColor : 'transparent',
          fontSize: `${fontSize}px`,
          color: fontColor,
          fontFamily: fontCSS.fontFamily,
          fontWeight: fontCSS.fontWeight,
          fontStyle: fontCSS.fontStyle,
          paddingTop: '2px'
        }}
      >
        {/* Day number */}
        {showDayNumbers && (
          <div
            style={{
              width: dayNumWidth,
              textAlign: 'right',
              paddingRight: '4px'
            }}
          >
            {day}
          </div>
        )}

        {/* Weekday name */}
        {showWeekdayNames && (
          <div
            style={{
              width: weekdayWidth,
              paddingLeft: '4px'
            }}
          >
            {weekdayNames[weekdayIndex]}
          </div>
        )}

        {/* Notes area with lines */}
        {showNotesLines && notesLineCount > 0 && (
          <div
            className="flex-1"
            style={{
              position: 'relative',
              height: rowHeight
            }}
          >
            {Array.from({ length: notesLineCount }).map((_, lineIdx) => {
              const lineSpacing = 3; // Fixed spacing between lines in pixels (tight for compact layout)
              const lineY = rowHeight - (lineIdx + 1) * lineSpacing;
              return (
                <div
                  key={lineIdx}
                  style={{
                    position: 'absolute',
                    top: lineY,
                    left: 0,
                    right: 0,
                    height: '1px',
                    backgroundColor: '#CCCCCC'
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="h-full w-full relative"
      style={{
        backgroundColor: widget.background_color || 'transparent',
        overflow: 'hidden'
      }}
    >
      {/* Month/Year Header */}
      {showHeader && (
        <div
          className="absolute w-full flex items-center justify-center"
          style={{
            top: 0,
            left: 0,
            height: headerHeight,
            fontSize: `${fontSize}px`,
            color: fontColor,
            fontFamily: fontCSS.fontFamily,
            fontWeight: fontCSS.fontWeight,
            fontStyle: fontCSS.fontStyle
          }}
        >
          {headerText}
        </div>
      )}

      {/* Day Rows */}
      {dayRows}
    </div>
  );
};

export default DayListWidget;
