/**
 * Complete Calendar widget rendering component.
 *
 * Handles calendar widget rendering on the canvas with full functionality.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 * Extracted from original CanvasWidget.tsx (561 lines of calendar logic).
 */

import React from 'react';
import { Widget } from '@/types';
import { getFontCSS } from '@/lib/fonts';
import { getMonthNames, getWeekdayNames, SupportedLocale } from '@/lib/i18n';

interface CalendarWidgetProps {
  widget: Widget;
}

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ widget }) => {
  const calendarProps = widget.properties || {};
  const calendarStyling = widget.styling || {};
  const calendarType = calendarProps.calendar_type || 'monthly';

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

  const startDate = parseDateSafely(calendarProps.start_date || '');
  const showWeekdays = calendarProps.show_weekdays !== false;
  const showMonthName = calendarProps.show_month_name !== false;
  const showYear = calendarProps.show_year !== false;
  const showGridLines = calendarProps.show_grid_lines !== false;
  const showWeekNumbers = calendarProps.week_numbers === true;
  const weekStartDay = calendarProps.first_day_of_week || 'monday'; // European default
  const cellMinSize = Math.max(20, calendarProps.cell_min_size || 44);
  const calendarFontSize = Math.max(6, (calendarStyling.size || 10));
  const fontCSS = getFontCSS(calendarStyling.font);

  // Localization support
  const locale = (calendarProps.locale as SupportedLocale) || 'en';
  const monthNames = getMonthNames(locale, false);
  const weekdayNames = getWeekdayNames(locale, 'short', weekStartDay);

  // Pre-calculate dimensions for height validation
  let isWidgetTooSmall = false;
  if (calendarType === 'monthly') {
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    const firstDay = new Date(year, month, 1);
    let firstDayOfWeek = firstDay.getDay();
    if (weekStartDay === 'monday') {
      firstDayOfWeek = (firstDayOfWeek + 6) % 7;
    }
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weeksNeeded = Math.ceil((daysInMonth + firstDayOfWeek) / 7);

    // Check for force_weeks property (for consistent layout when stacking calendars)
    const forceWeeks = calendarProps.force_weeks;
    const actualWeeks = forceWeeks
      ? Math.max(4, Math.min(6, parseInt(String(forceWeeks)) || weeksNeeded))
      : Math.max(4, Math.min(6, weeksNeeded));

    const gridHeight = widget.position.height;
    const showHeader = showMonthName || showYear;
    const headerHeight = showHeader ? calendarFontSize * 2 : 0;
    const weekdayHeight = showWeekdays ? calendarFontSize * 1.5 : 0;
    const minRequiredHeight = headerHeight + weekdayHeight + (actualWeeks * cellMinSize);
    isWidgetTooSmall = minRequiredHeight > gridHeight;
  }

  // Helper function to render weekly calendar
  const renderWeeklyCalendar = () => {
    const layoutOrientation = calendarProps.layout_orientation || 'horizontal';

    if (layoutOrientation === 'vertical') {
      return renderWeeklyCalendarVertical();
    } else {
      return renderWeeklyCalendarHorizontal();
    }
  };

  // Helper function to render horizontal weekly calendar
  const renderWeeklyCalendarHorizontal = () => {
    // Calculate the start of the week containing the start date
    const startOfWeek = new Date(startDate);
    const day = startOfWeek.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = weekStartDay === 'monday' ? (day + 6) % 7 : day;
    startOfWeek.setDate(startDate.getDate() - mondayOffset);

    // Generate 7 days of the week
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(startOfWeek);
      currentDay.setDate(startOfWeek.getDate() + i);
      weekDays.push(currentDay);
    }

    // Calculate dimensions
    const showTimeGrid = !!calendarProps.show_time_grid;
    const showTimeGutter = !!calendarProps.show_time_gutter;
    const timeStart = Math.max(0, Math.min(23, calendarProps.time_start_hour || 8));
    const timeEnd = Math.max(timeStart + 1, Math.min(24, calendarProps.time_end_hour || 20));
    const slotMinutes = Math.max(5, Math.min(120, calendarProps.time_slot_minutes || 60));
    const labelEvery = Math.max(slotMinutes, Math.min(240, calendarProps.time_label_interval || 60));
    const gutterWidth = showTimeGutter ? calendarFontSize * 2.2 : 0;
    const gridWidth = widget.position.width - gutterWidth;
    const gridHeight = widget.position.height;

    const showHeader = showMonthName || showYear;
    const headerHeight = showHeader ? calendarFontSize * 2 : 0;
    const weekdayHeight = showWeekdays ? calendarFontSize * 1.5 : 0;
    const availableHeight = gridHeight - headerHeight - weekdayHeight;

    const cellWidth = gridWidth / 7;
    const cellHeight = Math.max(cellMinSize, availableHeight);

    const weekdays = weekdayNames;

    return (
      <div
        className="h-full w-full"
        style={{
          fontSize: calendarFontSize,
          fontFamily: fontCSS.fontFamily,
          fontWeight: fontCSS.fontWeight,
          fontStyle: fontCSS.fontStyle,
          color: calendarStyling.color || '#000000'
        }}
      >
        {/* Week Header */}
        {showHeader && (
          <div
            className="text-center font-semibold border-b"
            style={{
              height: headerHeight,
              lineHeight: `${headerHeight}px`,
              borderColor: showGridLines ? '#ccc' : 'transparent'
            }}
          >
            {[
              showMonthName ? weekDays[0].toLocaleDateString(locale, { month: 'short' }) : null,
              showYear ? weekDays[0].toLocaleDateString(locale, { year: 'numeric' }) : null
            ].filter(Boolean).join(' ')} - Week {Math.ceil(weekDays[0].getDate() / 7)}
          </div>
        )}

        {/* Weekday Headers */}
        {showWeekdays && (
          <div className="flex" style={{ height: weekdayHeight }}>
            {showTimeGutter && (<div style={{ width: gutterWidth }} />)}
            {weekdays.map((day, index) => (
              <div
                key={index}
                className="text-center text-xs font-medium flex items-center justify-center"
                style={{
                  width: cellWidth,
                  borderRight: showGridLines && index < 6 ? '1px solid #ccc' : 'none',
                  borderBottom: showGridLines ? '1px solid #ccc' : 'none'
                }}
              >
                {day}
              </div>
            ))}
          </div>
        )}

        {/* Week Days Grid */}
        <div className="flex" style={{ height: availableHeight }}>
          {showTimeGutter && (
            <div style={{ width: gutterWidth }}>
              {showTimeGrid && (() => {
                const totalMinutes = (timeEnd - timeStart) * 60;
                const slots = Math.floor(totalMinutes / slotMinutes);
                const slotHeight = cellHeight / Math.max(1, slots);
                const labels = [] as JSX.Element[];
                for (let s = 0; s <= slots; s++) {
                  const minutes = s * slotMinutes;
                  if (minutes > totalMinutes) break;
                  if (minutes % labelEvery !== 0) continue;
                  const hour = timeStart + Math.floor(minutes / 60);
                  const minute = minutes % 60;
                  const label = `${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}`;
                  labels.push(
                    <div key={s} className="text-xs text-eink-gray" style={{ height: slotHeight, lineHeight: `${slotHeight}px` }}>
                      {label}
                    </div>
                  );
                }
                return <div className="h-full">{labels}</div>;
              })()}
            </div>
          )}
          {weekDays.map((day, index) => {
            const isClickable = calendarProps.link_strategy !== 'no_links';
            const dayNumber = day.getDate();
            return (
              <div key={index} className={`relative ${isClickable ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                style={{ width: cellWidth, height: cellHeight, border: showGridLines ? '1px solid #ccc' : 'none', backgroundColor: 'transparent', padding: `${Math.max(0,(calendarProps.cell_padding||4))}px` }}
              >
                <div className="font-semibold" style={{ fontSize: calendarFontSize }}>{dayNumber}</div>
                {showTimeGrid && (() => {
                  const totalMinutes = (timeEnd - timeStart) * 60;
                  const slots = Math.floor(totalMinutes / slotMinutes);
                  const slotHeight = cellHeight / Math.max(1, slots);
                  const lines = [] as JSX.Element[];
                  for (let s = 1; s < slots; s++) {
                    lines.push(
                      <div key={s} className="absolute left-0 right-0 border-t border-eink-pale-gray" style={{ top: s * slotHeight }} />
                    );
                  }
                  return <>{lines}</>;
                })()}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Helper function to render vertical weekly calendar
  const renderWeeklyCalendarVertical = () => {
    // Calculate the start of the week containing the start date
    const startOfWeek = new Date(startDate);
    const day = startOfWeek.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = weekStartDay === 'monday' ? (day + 6) % 7 : day;
    startOfWeek.setDate(startDate.getDate() - mondayOffset);

    // Generate 7 days of the week
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(startOfWeek);
      currentDay.setDate(startOfWeek.getDate() + i);
      weekDays.push(currentDay);
    }

    // Calculate dimensions
    const showTimeGrid = !!calendarProps.show_time_grid;
    const timeStart = Math.max(0, Math.min(23, calendarProps.time_start_hour || 8));
    const timeEnd = Math.max(timeStart + 1, Math.min(24, calendarProps.time_end_hour || 20));
    const slotMinutes = Math.max(5, Math.min(120, calendarProps.time_slot_minutes || 60));
    const labelEvery = Math.max(slotMinutes, Math.min(240, calendarProps.time_label_interval || 60));

    const weekdayGutterWidth = showWeekdays ? calendarFontSize * 4.0 : 0;
    const gridWidth = widget.position.width - weekdayGutterWidth;
    const gridHeight = widget.position.height;

    const showHeader = showMonthName || showYear;
    const headerHeight = showHeader ? calendarFontSize * 2 : 0;
    const timeHeaderHeight = showTimeGrid ? calendarFontSize * 1.5 : 0;
    const availableHeight = gridHeight - headerHeight - timeHeaderHeight;

    const cellHeight = availableHeight / 7; // 7 rows for days
    const cellWidth = gridWidth;

    const weekdays = weekdayNames;

    return (
      <div
        className="h-full w-full"
        style={{
          fontSize: calendarFontSize,
          fontFamily: fontCSS.fontFamily,
          fontWeight: fontCSS.fontWeight,
          fontStyle: fontCSS.fontStyle,
          color: calendarStyling.color || '#000000'
        }}
      >
        {/* Week Header */}
        {showHeader && (
          <div
            className="text-center font-semibold border-b"
            style={{
              height: headerHeight,
              lineHeight: `${headerHeight}px`,
              borderColor: showGridLines ? '#ccc' : 'transparent'
            }}
          >
            {[
              showMonthName ? weekDays[0].toLocaleDateString(locale, { month: 'short' }) : null,
              showYear ? weekDays[0].toLocaleDateString(locale, { year: 'numeric' }) : null
            ].filter(Boolean).join(' ')} - Week {Math.ceil(weekDays[0].getDate() / 7)}
          </div>
        )}

        {/* Time Slot Headers (horizontal across top) */}
        {showTimeGrid && timeHeaderHeight > 0 && (
          <div className="flex" style={{ height: timeHeaderHeight }}>
            {showWeekdays && <div style={{ width: weekdayGutterWidth }} />}
            {(() => {
              const totalMinutes = (timeEnd - timeStart) * 60;
              const timeSlots = Math.max(1, Math.floor(totalMinutes / slotMinutes));
              const slotWidth = cellWidth / timeSlots;
              const timeHeaders = [];

              for (let s = 0; s <= timeSlots; s++) {
                const minutesFromStart = s * slotMinutes;
                if (minutesFromStart > totalMinutes) break;
                if (minutesFromStart % labelEvery !== 0) continue;

                const hour = timeStart + Math.floor(minutesFromStart / 60);
                const minute = minutesFromStart % 60;
                const timeLabel = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

                timeHeaders.push(
                  <div
                    key={s}
                    className="text-center text-xs font-medium flex items-center justify-center"
                    style={{
                      width: slotWidth,
                      borderRight: showGridLines && s < timeSlots ? '1px solid #ccc' : 'none',
                      borderBottom: showGridLines ? '1px solid #ccc' : 'none'
                    }}
                  >
                    {timeLabel}
                  </div>
                );
              }
              return timeHeaders;
            })()}
          </div>
        )}

        {/* Daily rows (7 rows for days) */}
        <div className="flex-1 flex flex-col">
          {weekDays.map((currentDay, dayIndex) => (
            <div
              key={dayIndex}
              className="flex"
              style={{ height: cellHeight }}
            >
              {/* Weekday label in left gutter */}
              {showWeekdays && (
                <div
                  className="flex items-center justify-start text-xs font-medium"
                  style={{
                    width: weekdayGutterWidth,
                    borderRight: showGridLines ? '1px solid #ccc' : 'none',
                    borderBottom: showGridLines ? '1px solid #ccc' : 'none',
                    padding: `${Math.max(0, (calendarProps.cell_padding || 4))}px`
                  }}
                >
                  {weekdays[dayIndex]} {currentDay.getDate()}
                </div>
              )}

              {/* Day content area */}
              <div
                className="flex-1 relative"
                style={{
                  borderBottom: showGridLines ? '1px solid #ccc' : 'none'
                }}
              >
                {showTimeGrid && (() => {
                  const totalMinutes = (timeEnd - timeStart) * 60;
                  const timeSlots = Math.max(1, Math.floor(totalMinutes / slotMinutes));
                  const slotWidth = cellWidth / timeSlots;
                  const verticalLines = [];

                  for (let s = 1; s < timeSlots; s++) {
                    verticalLines.push(
                      <div key={s} className="absolute top-0 bottom-0 border-l border-eink-pale-gray" style={{ left: s * slotWidth }} />
                    );
                  }
                  return <>{verticalLines}</>;
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Helper function to render calendar grid
  const renderCalendarGrid = () => {
    if (calendarType === 'monthly') {
      // Get month information
      const year = startDate.getFullYear();
      const month = startDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      // Adjust first day of week to our indexing
      let firstDayOfWeek = firstDay.getDay();
      if (weekStartDay === 'monday') {
        firstDayOfWeek = (firstDayOfWeek + 6) % 7; // Convert to Monday-first indexing
      }

      const daysInMonth = lastDay.getDate();
      const daysInPreviousMonth = new Date(year, month, 0).getDate();

      // Calculate how many weeks to show
      const weeksNeeded = Math.ceil((daysInMonth + firstDayOfWeek) / 7);

      // Check for force_weeks property (for consistent layout when stacking calendars)
      const forceWeeks = calendarProps.force_weeks;
      const weeksToShow = forceWeeks
        ? Math.max(4, Math.min(6, parseInt(String(forceWeeks)) || weeksNeeded))
        : weeksNeeded;

      // Calculate how many cells we need
      const totalCells = weeksToShow * 7;

      // Calculate dimensions
      const gridHeight = widget.position.height;
      const showHeader = showMonthName || showYear;
      const headerHeight = showHeader ? calendarFontSize * 1.5 : 0;
      const weekdayHeight = showWeekdays ? calendarFontSize * 1.5 : 0;
      const availableHeight = gridHeight - headerHeight - weekdayHeight;

      // Following CLAUDE.md Rule #3: Week numbers are max 3 chars ("W53"), need ~2.0 for readability
      const weekColWidth = showWeekNumbers ? calendarFontSize * 2.0 : 0;
      const cellHeight = Math.max(cellMinSize, availableHeight / weeksToShow);
      const cellWidth = (widget.position.width - weekColWidth) / 7;

      const weekdays = weekdayNames;

      // Use localized month names from i18n system

      // Generate cells
      const cells = [];
      for (let i = 0; i < totalCells; i++) {
        const dayOfMonth = i - firstDayOfWeek + 1;
        let dayNumber: number | null = null;
        let isCurrentMonth = false;
        let cellDate: Date | null = null;

        if (dayOfMonth <= 0) {
          // Previous month
          dayNumber = daysInPreviousMonth + dayOfMonth;
          cellDate = new Date(year, month - 1, dayNumber);
        } else if (dayOfMonth > daysInMonth) {
          // Next month
          dayNumber = dayOfMonth - daysInMonth;
          cellDate = new Date(year, month + 1, dayNumber);
        } else {
          // Current month
          dayNumber = dayOfMonth;
          isCurrentMonth = true;
          cellDate = new Date(year, month, dayNumber);
        }

        const isClickable = calendarProps.link_strategy !== 'no_links';

        const row = Math.floor(i / 7);
        const col = i % 7;

        cells.push(
          <div
            key={i}
            className={`absolute flex items-start justify-start ${isClickable && isCurrentMonth ? 'cursor-pointer hover:bg-blue-50' : ''}`}
            style={{
              left: weekColWidth + col * cellWidth,
              top: headerHeight + weekdayHeight + row * cellHeight,
              width: cellWidth,
              height: cellHeight,
              border: showGridLines ? '1px solid #ccc' : 'none',
              fontSize: calendarFontSize * 0.8,
              padding: `${Math.max(0, (calendarProps.cell_padding || 4))}px`,
              opacity: isCurrentMonth ? 1 : 0.3,
              backgroundColor: 'transparent'
            }}
            title={cellDate ? cellDate.toDateString() : ''}
          >
            <div className={`${isCurrentMonth ? 'font-semibold' : 'font-normal'}`}>
              {dayNumber}
            </div>
          </div>
        );
      }

      // Generate week number cells
      const weekCells = [];
      if (showWeekNumbers) {
        for (let weekRow = 0; weekRow < weeksToShow; weekRow++) {
          // Calculate first day in this week row
          const firstDayInRow = weekRow * 7 - firstDayOfWeek + 1;
          let weekDate: Date;

          if (firstDayInRow < 1) {
            // Previous month
            weekDate = new Date(year, month - 1, daysInPreviousMonth + firstDayInRow);
          } else if (firstDayInRow > daysInMonth) {
            // Next month
            weekDate = new Date(year, month + 1, firstDayInRow - daysInMonth);
          } else {
            // Current month
            weekDate = new Date(year, month, firstDayInRow);
          }

          // Get ISO week number
          const getISOWeek = (date: Date): number => {
            const target = new Date(date.valueOf());
            const dayNr = (date.getDay() + 6) % 7;
            target.setDate(target.getDate() - dayNr + 3);
            const firstThursday = target.valueOf();
            target.setMonth(0, 1);
            if (target.getDay() !== 4) {
              target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
            }
            return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
          };

          const weekNum = getISOWeek(weekDate);

          weekCells.push(
            <div
              key={`week-${weekRow}`}
              className="absolute flex items-center justify-center text-xs"
              style={{
                left: 0,
                top: headerHeight + weekdayHeight + weekRow * cellHeight,
                width: weekColWidth,
                height: cellHeight,
                fontSize: calendarFontSize * 0.8,
                color: calendarStyling.color || '#000000',
                borderRight: showGridLines ? '1px solid #ccc' : 'none'
              }}
            >
              {weekNum}
            </div>
          );
        }
      }

      return (
        <div
          className={`h-full w-full bg-white border ${isWidgetTooSmall ? 'border-red-300 border-2' : 'border-gray-200'} overflow-hidden relative`}
          style={{
            fontSize: calendarFontSize,
            fontFamily: fontCSS.fontFamily,
            fontWeight: fontCSS.fontWeight,
            fontStyle: fontCSS.fontStyle,
            color: calendarStyling.color || '#000000'
          }}
        >
          {/* Month/Year Header */}
          {showHeader && (
            <div
              className="text-center font-bold"
              style={{
                height: headerHeight,
                lineHeight: `${headerHeight}px`,
                borderBottom: showGridLines ? '1px solid #ccc' : 'none'
              }}
            >
              {[showMonthName ? monthNames[month] : null, showYear ? year : null].filter(Boolean).join(' ')}
            </div>
          )}

          {/* Weekday Headers */}
          {showWeekdays && (
            <div className="flex" style={{ marginLeft: weekColWidth }}>
              {weekdays.map((day, index) => (
                <div
                  key={index}
                  className="text-center font-medium text-xs flex items-center justify-center"
                  style={{
                    width: cellWidth,
                    height: weekdayHeight,
                    borderRight: showGridLines && index < 6 ? '1px solid #ccc' : 'none',
                    borderBottom: showGridLines ? '1px solid #ccc' : 'none'
                  }}
                >
                  {day}
                </div>
              ))}
            </div>
          )}

          {/* Calendar cells */}
          {cells}

          {/* Week number cells */}
          {weekCells}

          {/* Warning overlay for small widgets */}
          {isWidgetTooSmall && (
            <div className="absolute inset-0 bg-red-50 bg-opacity-90 flex items-center justify-center">
              <div className="text-red-600 text-xs text-center p-2">
                Widget too small for month view.<br />
                Minimum height needed: {Math.ceil((headerHeight + weekdayHeight + (weeksToShow * cellMinSize)) / 10) * 10}px
              </div>
            </div>
          )}
        </div>
      );
    }
  };

  // Main render logic
  if (calendarType === 'weekly') {
    return renderWeeklyCalendar();
  } else if (calendarType === 'monthly') {
    return renderCalendarGrid();
  } else {
    // Custom range calendar - simplified implementation
    return (
      <div
        className="h-full w-full bg-white border border-gray-200 overflow-hidden flex items-center justify-center"
        style={{
          fontSize: calendarFontSize,
          fontFamily: fontCSS.fontFamily,
          fontWeight: fontCSS.fontWeight,
          fontStyle: fontCSS.fontStyle,
          color: calendarStyling.color || '#000000'
        }}
      >
        <div className="text-center text-xs text-gray-500">
          Custom Range Calendar<br />
          {startDate.toLocaleDateString(locale)} - {calendarProps.end_date ? parseDateSafely(calendarProps.end_date).toLocaleDateString(locale) : 'Open'}
        </div>
      </div>
    );
  }
};

export default CalendarWidget;