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
  onSelect: (widget: Widget) => void;
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
      onSelect(widget);
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
        
        const elements = [];
        
        // Horizontal lines
        for (let i = 0; i < lineCount; i++) {
          const yPosition = (i * lineSpacing) / zoom;
          
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
        if (lineStyle === 'grid') {
          const gridSpacing = 20; // pts
          const availableWidth = widget.position.width - marginLeft - marginRight;
          const verticalLineCount = Math.floor(availableWidth / gridSpacing);
          
          for (let i = 0; i <= verticalLineCount; i++) {
            const xPosition = (marginLeft + i * gridSpacing) / zoom;
            elements.push(
              <div
                key={`v-${i}`}
                className="absolute bg-eink-black"
                style={{
                  left: xPosition,
                  top: 0,
                  width: lineThickness / zoom,
                  height: '100%',
                }}
              />
            );
          }
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
          const gridWidth = widget.position.width / zoom;
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
                <div 
                  className="flex"
                  style={{ height: weekdayHeight }}
                >
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
                {weekDays.map((day, index) => {
                  const isClickable = calendarProps.link_strategy !== 'no_links';
                  const dayNumber = day.getDate();
                  
                  return (
                    <div
                      key={index}
                      className={`flex flex-col items-center justify-start pt-2 ${isClickable ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                      style={{
                        width: cellWidth,
                        height: cellHeight,
                        border: showGridLines ? '1px solid #ccc' : 'none',
                        backgroundColor: 'transparent'
                      }}
                    >
                      <span 
                        className={`font-semibold ${isClickable ? 'underline text-blue-600' : ''}`}
                        style={{ fontSize: calendarFontSize }}
                      >
                        {dayNumber}
                      </span>
                      <div className="flex-1 w-full mt-1" style={{ fontSize: calendarFontSize * 0.8 }}>
                        {/* Space for events/content */}
                      </div>
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
            const gridWidth = widget.position.width / zoom;
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
            const weekdays = weekStartDay === 'monday' 
              ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']  // European
              : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // US
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
                  <div 
                    className="flex"
                    style={{ height: weekdayHeight }}
                  >
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
                
                {/* Calendar Days Grid */}
                <div 
                  className="grid grid-cols-7"
                  style={{ 
                    height: availableHeight,
                    gridTemplateRows: `repeat(${actualWeeks}, ${cellHeight}px)`
                  }}
                >
                  {/* Generate calendar cells */}
                  {Array.from({ length: actualWeeks * 7 }, (_, index) => {
                    const dayNumber = index - firstDayOfWeek + 1;
                    const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;
                    const isClickable = isCurrentMonth && calendarProps.link_strategy !== 'no_links';
                    
                    return (
                      <div
                        key={index}
                        className={`flex items-center justify-center ${isClickable ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                        style={{
                          width: cellWidth,
                          height: cellHeight,
                          minHeight: isClickable ? cellMinSize : 'auto',
                          border: showGridLines ? '1px solid #ccc' : 'none',
                          backgroundColor: isCurrentMonth ? 'transparent' : '#f9f9f9',
                          color: isCurrentMonth ? (calendarStyling.color || '#000000') : '#ccc'
                        }}
                      >
                        {isCurrentMonth && (
                          <span 
                            className={isClickable ? 'underline text-blue-600' : ''}
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
