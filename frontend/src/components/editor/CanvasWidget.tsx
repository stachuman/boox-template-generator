/**
 * Individual widget component on the canvas.
 * 
 * Renders a widget with selection handles and drag behavior.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useCallback } from 'react';
import { useDrag } from 'react-dnd';
import clsx from 'clsx';
import { Widget } from '@/types';

interface CanvasWidgetProps {
  widget: Widget;
  isSelected: boolean;
  onSelect: (widget: Widget, additive?: boolean) => void;
  zoom: number;
}

const CanvasWidget: React.FC<CanvasWidgetProps> = ({
  widget,
  isSelected,
  onSelect,
  zoom
}) => {
  const [{ isDragging }, drag] = useDrag<{ type: string; widget: Widget; isNew: boolean }, void, { isDragging: boolean }>({
    type: 'WIDGET',
    item: () => {
      return { 
        type: 'WIDGET', 
        widget, 
        isNew: false
      };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });

  const handleClick = useCallback((event: React.MouseEvent) => {
    // Only select if not dragging
    if (!isDragging) {
      event.stopPropagation();
      onSelect(widget, event.shiftKey || event.metaKey || event.ctrlKey);
    }
  }, [widget, onSelect, isDragging]);

  const renderWidgetContent = () => {
    switch (widget.type) {
      case 'text_block':
        return (
          <div
            className="h-full flex items-center"
            style={{
              fontFamily: widget.styling?.font || 'Helvetica',
              fontSize: (widget.styling?.size || 12) / zoom,
              color: widget.styling?.color || '#000000'
            }}
          >
            {widget.content || 'Text Block'}
          </div>
        );

      case 'checkbox':
        const checkboxSize = widget.properties?.checkbox_size || 12;

        return (
          <div className="h-full flex items-center space-x-2">
            <div
              className="border border-eink-black"
              style={{
                width: checkboxSize / zoom,
                height: checkboxSize / zoom
              }}
            />
            <span
              style={{
                fontSize: 10 / zoom,
                fontFamily: 'Helvetica'
              }}
            >
              {widget.content || 'Checkbox'}
            </span>
          </div>
        );

      case 'divider':
        return (
          <div className="h-full flex items-center">
            <div
              className="w-full bg-eink-black"
              style={{ height: 1 / zoom }}
            />
          </div>
        );

      case 'lines':
        const properties = widget.properties || {};
        const lineSpacing = properties.line_spacing || 20;
        const lineCount = properties.line_count || 10;
        const lineThickness = properties.line_thickness || 0.75;
        const marginLeft = properties.margin_left || 0;
        const marginRight = properties.margin_right || 0;
        const lineStyle = properties.line_style || 'solid';
        const topPadding = properties.top_padding || 0;
        const gridSpacing = properties.grid_spacing || 20;
        const columns = properties.columns || 0;
        
        const elements = [] as JSX.Element[];
        
        // Horizontal lines
        const heightPt = widget.position.height;
        const bottomPad = (properties.bottom_padding || 0);
        for (let i = 0; i < lineCount; i++) {
          const yAbs = topPadding + i * lineSpacing;
          if (yAbs > heightPt - bottomPad) break;
          const yPosition = yAbs / zoom;
          
          let lineClass = 'absolute bg-eink-black';
          let borderStyle = '';
          
          if (lineStyle === 'dotted') {
            lineClass = 'absolute';
            borderStyle = `${lineThickness / zoom}px dotted #000000`;
          } else if (lineStyle === 'dashed') {
            lineClass = 'absolute';
            borderStyle = `${lineThickness / zoom}px dashed #000000`;
          }
          
          elements.push(
            <div
              key={`h-${i}`}
              className={lineClass}
              style={{
                left: marginLeft / zoom,
                right: marginRight / zoom,
                top: yPosition,
                height: lineStyle === 'solid' ? lineThickness / zoom : 0,
                borderTop: borderStyle || undefined,
              }}
            />
          );
        }
        
        // Grid vertical lines (if grid style)
        if (lineStyle === 'grid' && gridSpacing > 0) {
          const availableWidth = widget.position.width - marginLeft - marginRight;
          const verticalLineCount = Math.floor(availableWidth / gridSpacing);
          for (let i = 0; i <= verticalLineCount; i++) {
            const xPosition = (marginLeft + i * gridSpacing) / zoom;
            elements.push(
              <div
                key={`v-${i}`}
                className="absolute bg-eink-black"
                style={{ left: xPosition, top: 0, width: lineThickness / zoom, height: '100%' }}
              />
            );
          }
        } else if (columns && columns > 1) {
          const availableWidth = widget.position.width - marginLeft - marginRight;
          const colWidth = availableWidth / columns;
          for (let c = 1; c < columns; c++) {
            const xPosition = (marginLeft + c * colWidth) / zoom;
            elements.push(
              <div
                key={`col-${c}`}
                className="absolute bg-eink-black"
                style={{ left: xPosition, top: 0, width: lineThickness / zoom, height: '100%' }}
              />
            );
          }
        }
        // Custom vertical guides by ratio
        if (Array.isArray(properties.vertical_guides)) {
          const availableWidth = widget.position.width - marginLeft - marginRight;
          properties.vertical_guides.forEach((ratio: number, idx: number) => {
            const r = Math.max(0, Math.min(1, ratio || 0));
            if (r <= 0 || r >= 1) return;
            const xPosition = (marginLeft + availableWidth * r) / zoom;
            elements.push(
              <div
                key={`vg-${idx}`}
                className="absolute bg-eink-black"
                style={{ left: xPosition, top: 0, width: lineThickness / zoom, height: '100%' }}
              />
            );
          });
        }
        
        return (
          <div className="h-full relative">
            {elements}
          </div>
        );

      case 'anchor':
        const anchorContent = widget.content || 'Link Text';
        const anchorStyling = widget.styling || {};
        const fontSize = (anchorStyling.size || 12) / zoom;
        const fontFamily = anchorStyling.font || 'Helvetica';
        const textColor = anchorStyling.color || '#0066CC';
        
        return (
          <div 
            className="h-full flex items-center px-1 cursor-pointer hover:bg-blue-50 transition-colors"
            style={{
              fontSize,
              fontFamily,
              color: textColor,
              textDecoration: 'underline',
              minHeight: '44px' // E-ink touch target minimum
            }}
          >
            <span className="truncate">{anchorContent}</span>
          </div>
        );

      case 'tap_zone':
        // Visualize tap zone with dashed outline in editor (if enabled)
        const showOutline = widget.properties?.outline !== false; // default true
        return (
          <div
            className={clsx('w-full h-full flex items-center justify-center text-xs text-eink-gray', showOutline ? 'border-2 border-dashed border-blue-400 bg-blue-50 bg-opacity-10' : '')}
            style={{ minHeight: 44 / zoom }}
          >
            {showOutline && 'Tap Zone'}
          </div>
        );

      case 'image':
        const src = widget.properties?.image_src || '';
        const fit = widget.properties?.image_fit || 'fit';
        const objectFit = fit === 'fit' ? 'contain' : fit === 'stretch' ? 'fill' : 'none';
        return (
          <div className="w-full h-full bg-white overflow-hidden">
            {src ? (
              <img
                src={src}
                alt=""
                style={{ width: '100%', height: '100%', objectFit, imageRendering: 'auto' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-eink-light-gray border border-dashed border-eink-pale-gray">
                Set image source
              </div>
            )}
          </div>
        );

      case 'calendar':
        const calendarProps = widget.properties || {};
        const calendarStyling = widget.styling || {};
        const calendarType = calendarProps.calendar_type || 'monthly';
        const startDate = calendarProps.start_date ? new Date(calendarProps.start_date) : new Date();
        const showWeekdays = calendarProps.show_weekdays !== false;
        const showMonthYear = calendarProps.show_month_year !== false;
        const showGridLines = calendarProps.show_grid_lines !== false;
        const weekStartDay = calendarProps.first_day_of_week || 'monday'; // European default
        const cellMinSize = Math.max(20, calendarProps.cell_min_size || 44) / zoom;
        const calendarFontSize = Math.max(6, (calendarStyling.size || 10) / zoom);
        const calendarFontFamily = calendarStyling.font || 'Helvetica';
        
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
          const actualWeeks = Math.max(4, Math.min(6, weeksNeeded));
          
          const gridHeight = widget.position.height / zoom;
          const headerHeight = showMonthYear ? calendarFontSize * 2 : 0;
          const weekdayHeight = showWeekdays ? calendarFontSize * 1.5 : 0;
          const minRequiredHeight = headerHeight + weekdayHeight + (actualWeeks * cellMinSize);
          isWidgetTooSmall = minRequiredHeight > gridHeight;
        }
        
        // Helper function to render weekly calendar
        const renderWeeklyCalendar = () => {
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
          const gridWidth = widget.position.width / zoom - gutterWidth;
          const gridHeight = widget.position.height / zoom;
          
          const headerHeight = showMonthYear ? calendarFontSize * 2 : 0;
          const weekdayHeight = showWeekdays ? calendarFontSize * 1.5 : 0;
          const availableHeight = gridHeight - headerHeight - weekdayHeight;
          
          const cellWidth = gridWidth / 7;
          const cellHeight = Math.max(cellMinSize, availableHeight);
          
          const weekdays = weekStartDay === 'monday' 
            ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          
          return (
            <div 
              className="h-full w-full"
              style={{
                fontSize: calendarFontSize,
                fontFamily: calendarFontFamily,
                color: calendarStyling.color || '#000000'
              }}
            >
              {/* Week Header */}
              {showMonthYear && (
                <div 
                  className="text-center font-semibold border-b"
                  style={{
                    height: headerHeight,
                    lineHeight: `${headerHeight}px`,
                    borderColor: showGridLines ? '#ccc' : 'transparent'
                  }}
                >
                  {weekDays[0].toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - Week {Math.ceil(weekDays[0].getDate() / 7)}
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
                      style={{ width: cellWidth, height: cellHeight, border: showGridLines ? '1px solid #ccc' : 'none', backgroundColor: 'transparent', padding: `${Math.max(0,(calendarProps.cell_padding||4)/zoom)}px` }}
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

        // Helper function to render calendar grid
        const renderCalendarGrid = () => {
          if (calendarType === 'monthly') {
            // Get month information
            const year = startDate.getFullYear();
            const month = startDate.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            // Calculate first day position based on locale
            let firstDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
            
            // Adjust for European locale (Monday = 0)
            if (weekStartDay === 'monday') {
              firstDayOfWeek = (firstDayOfWeek + 6) % 7; // Convert to Monday-first indexing
            }
            
            const daysInMonth = lastDay.getDate();
            
            // Calculate grid dimensions
            const weekNumbers = !!calendarProps.week_numbers;
            const weekColWidth = weekNumbers ? calendarFontSize * 2.2 : 0;
            const gridWidth = widget.position.width / zoom - weekColWidth;
            const gridHeight = widget.position.height / zoom;
            
            // Reserve space for headers
            const headerHeight = showMonthYear ? calendarFontSize * 2 : 0;
            const weekdayHeight = showWeekdays ? calendarFontSize * 1.5 : 0;
            const availableHeight = gridHeight - headerHeight - weekdayHeight;
            
            // Calculate how many weeks are needed for this month
            const weeksNeeded = Math.ceil((daysInMonth + firstDayOfWeek) / 7);
            const actualWeeks = Math.max(4, Math.min(6, weeksNeeded)); // 4-6 weeks
            
            const cellWidth = gridWidth / 7; // 7 days per week
            const cellHeight = Math.max(cellMinSize, availableHeight / actualWeeks);
            
            // Height validation is already done above in the outer scope
            
            // Configure weekdays based on locale
            const dayLabelStyle = calendarProps.weekday_label_style || 'short';
            const baseWeekdays = weekStartDay === 'monday'
              ? [['Mon','M','Monday'], ['Tue','T','Tuesday'], ['Wed','W','Wednesday'], ['Thu','T','Thursday'], ['Fri','F','Friday'], ['Sat','S','Saturday'], ['Sun','S','Sunday']]
              : [['Sun','S','Sunday'], ['Mon','M','Monday'], ['Tue','T','Tuesday'], ['Wed','W','Wednesday'], ['Thu','T','Thursday'], ['Fri','F','Friday'], ['Sat','S','Saturday']];
            const labelIdx = dayLabelStyle === 'narrow' ? 1 : dayLabelStyle === 'full' ? 2 : 0;
            const weekdays = baseWeekdays.map(d => d[labelIdx]);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            return (
              <div 
                className="h-full w-full"
                style={{
                  fontSize: calendarFontSize,
                  fontFamily: calendarFontFamily,
                  color: calendarStyling.color || '#000000'
                }}
              >
                {/* Month/Year Header */}
                {showMonthYear && (
                  <div 
                    className="text-center font-semibold border-b"
                    style={{
                      height: headerHeight,
                      lineHeight: `${headerHeight}px`,
                      borderColor: showGridLines ? '#ccc' : 'transparent'
                    }}
                  >
                    {monthNames[month]} {year}
                  </div>
                )}
                
                {/* Weekday Headers */}
                {showWeekdays && (
                <div className="flex" style={{ height: weekdayHeight }}>
                  {weekNumbers && (
                    <div style={{ width: weekColWidth }} />
                  )}
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
                
              {/* Calendar Days with Week Numbers */}
              <div className="flex" style={{ height: availableHeight }}>
                {weekNumbers && (
                  <div style={{ width: weekColWidth }}>
                    {Array.from({ length: actualWeeks }, (_, w) => {
                      // Compute first date of this row similar to backend
                      const firstDayNum = (w * 7 + 0) - firstDayOfWeek + 1;
                      let firstDate = new Date(year, month, 1);
                      if (firstDayNum < 1) {
                        const pm = month - 1;
                        const py = pm >= 0 ? year : year - 1;
                        const pMonth = (pm + 12) % 12;
                        const pDays = new Date(py, pMonth + 1, 0).getDate();
                        firstDate = new Date(py, pMonth, pDays + firstDayNum);
                      } else if (firstDayNum > daysInMonth) {
                        const nm = month + 1;
                        const ny = nm <= 11 ? year : year + 1;
                        const nMonth = nm % 12;
                        firstDate = new Date(ny, nMonth, firstDayNum - daysInMonth);
                      } else {
                        firstDate = new Date(year, month, firstDayNum);
                      }
                      // ISO week number
                      const temp = new Date(firstDate.getTime());
                      // Thursday in current week decides the year
                      temp.setDate(firstDate.getDate() + 3 - ((firstDate.getDay() + 6) % 7));
                      const week1 = new Date(temp.getFullYear(), 0, 4);
                      const weekNum = Math.round(1 + ((temp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
                      return (
                        <div key={w} className="flex items-center justify-center text-xs text-eink-gray" style={{ height: cellHeight }}>
                          {weekNum}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div 
                  className="grid grid-cols-7"
                  style={{ 
                    width: gridWidth,
                    height: availableHeight,
                    gridTemplateRows: `repeat(${actualWeeks}, ${cellHeight}px)`
                  }}
                >
                  {Array.from({ length: actualWeeks * 7 }, (_, index) => {
                    const dayNumber = index - firstDayOfWeek + 1;
                    const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;
                    const isClickable = isCurrentMonth && calendarProps.link_strategy !== 'no_links';
                    return (
                      <div
                        key={index}
                        className={`flex items-start justify-start ${isClickable ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                        style={{
                          width: cellWidth,
                          height: cellHeight,
                          minHeight: isClickable ? cellMinSize : 'auto',
                          border: showGridLines ? '1px solid #ccc' : 'none',
                          backgroundColor: isCurrentMonth ? 'transparent' : '#f9f9f9',
                          color: isCurrentMonth ? (calendarStyling.color || '#000000') : '#ccc',
                          padding: `${Math.max(0, (calendarProps.cell_padding || 4) / zoom)}px`
                        }}
                      >
                        {isCurrentMonth && (
                          <span 
                            className={`font-semibold ${isClickable ? 'underline text-blue-600' : ''}`}
                            style={{ fontSize: calendarFontSize }}
                          >
                            {dayNumber}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              </div>
            );
          } else if (calendarType === 'weekly') {
            // Weekly calendar view
            return renderWeeklyCalendar();
          } else {
            // Custom range view (simplified preview)
            return (
              <div 
                className="h-full w-full flex items-center justify-center text-center"
                style={{
                  fontSize: calendarFontSize,
                  fontFamily: calendarFontFamily,
                  color: calendarStyling.color || '#000000'
                }}
              >
                <div>
                  <div className="font-semibold mb-1">{calendarType.toUpperCase()} VIEW</div>
                  <div className="text-xs">
                    {startDate.toLocaleDateString()}
                    {calendarProps.end_date && ` - ${new Date(calendarProps.end_date).toLocaleDateString()}`}
                  </div>
                  <div className="text-xs mt-1">
                    Links: {calendarProps.link_strategy || 'no_links'}
                  </div>
                </div>
              </div>
            );
          }
        };
        
        return (
          <div 
            className={`h-full w-full bg-white border ${isWidgetTooSmall ? 'border-red-300 border-2' : 'border-gray-200'} overflow-hidden relative`}
            style={{
              borderColor: isWidgetTooSmall ? '#fca5a5' : (showGridLines ? '#ccc' : '#e5e5e5')
            }}
          >
            {renderCalendarGrid()}
            {isWidgetTooSmall && (
              <div className="absolute top-0 right-0 bg-red-100 text-red-800 text-xs px-1 py-0.5 rounded-bl">
                Too small
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="h-full flex items-center justify-center text-eink-light-gray">
            Unknown
          </div>
        );
    }
  };

  return (
    <div
      ref={drag}
      className={clsx(
        'absolute cursor-move select-none pointer-events-auto',
        isDragging && 'opacity-50',
        isSelected && 'ring-2 ring-blue-500 ring-offset-1'
      )}
      style={{
        left: widget.position.x,
        top: widget.position.y,
        width: widget.position.width,
        height: widget.position.height,
      }}
      onClick={handleClick}
    >
      {/* Widget Content */}
      <div
        className="w-full h-full relative"
        style={{
          backgroundColor: widget.background_color || 'transparent'
        }}
      >
        {renderWidgetContent()}
        
        {/* Selection Handles */}
        {isSelected && (
          <>
            {/* Corner handles */}
            <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 border border-white" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 border border-white" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 border border-white" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 border border-white" />
            
            {/* Edge handles */}
            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-blue-500 border border-white" />
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-blue-500 border border-white" />
            <div className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-500 border border-white" />
            <div className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-500 border border-white" />
          </>
        )}
      </div>
    </div>
  );
};

export default CanvasWidget;
