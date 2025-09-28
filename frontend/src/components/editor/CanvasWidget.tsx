/**
 * Individual widget component on the canvas.
 * 
 * Renders a widget with selection handles and drag behavior.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDrag } from 'react-dnd';
import clsx from 'clsx';
import { Widget } from '@/types';
import { getMonthNames } from '@/lib/i18n';
import { useEditorStore } from '@/stores/editorStore';

interface CanvasWidgetProps {
  widget: Widget;
  isSelected: boolean;
  onSelect: (widget: Widget, additive?: boolean) => void;
  zoom: number;
  onContextMenu?: (e: React.MouseEvent, widget: Widget) => void;
}

const CanvasWidget: React.FC<CanvasWidgetProps> = ({
  widget,
  isSelected,
  onSelect,
  zoom,
  onContextMenu
}) => {
  const { updateWidget, currentTemplate } = useEditorStore() as any;
  const gridSize = (currentTemplate?.canvas?.grid_size) || 10;
  const snapEnabled = currentTemplate?.canvas?.snap_enabled !== false;

  const resizeEdgeRef = useRef<null | string>(null);
  const startRef = useRef<{x:number;y:number;width:number;height:number;mouseX:number;mouseY:number}>();

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

  const snap = (v: number) => {
    if (!snapEnabled) return v;
    return Math.round(v / gridSize) * gridSize;
  };

  const onHandleMouseDown = (edge: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizeEdgeRef.current = edge;
    startRef.current = {
      x: widget.position.x,
      y: widget.position.y,
      width: widget.position.width,
      height: widget.position.height,
      mouseX: e.clientX,
      mouseY: e.clientY,
    };
    // Add listeners
    window.addEventListener('mousemove', onMouseMove as any);
    window.addEventListener('mouseup', onMouseUp as any, { once: true });
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!resizeEdgeRef.current || !startRef.current) return;
    const dx = (e.clientX - startRef.current.mouseX) / zoom;
    const dy = (e.clientY - startRef.current.mouseY) / zoom;
    let { x, y, width, height } = startRef.current;
    let newX = x, newY = y, newW = width, newH = height;
    const edge = resizeEdgeRef.current;
    if (edge.includes('e')) newW = Math.max(1, width + dx);
    if (edge.includes('s')) newH = Math.max(1, height + dy);
    if (edge.includes('w')) {
      newW = Math.max(1, width - dx);
      newX = x + dx;
    }
    if (edge.includes('n')) {
      newH = Math.max(1, height - dy);
      newY = y + dy;
    }
    // Snap
    newX = snap(newX);
    newY = snap(newY);
    newW = Math.max(1, snap(newW));
    newH = Math.max(1, snap(newH));
    updateWidget(widget.id, { position: { x: newX, y: newY, width: newW, height: newH } });
  };

  const onMouseUp = (_e: MouseEvent) => {
    resizeEdgeRef.current = null;
    window.removeEventListener('mousemove', onMouseMove as any);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onMouseMove as any);
    };
  }, []);
  const resolveFontFamily = (name?: string) => {
    switch (name) {
      case 'Courier-Prime':
        return "'Courier Prime', Courier, monospace";
      case 'Patrick-Hand':
        return "'Patrick Hand', 'Comic Sans MS', cursive";
      case 'DejaVu Sans':
        return "'DejaVu Sans', Arial, Helvetica, sans-serif";
      case 'DejaVu Sans Bold':
        return "'DejaVu Sans', Arial, Helvetica, sans-serif";
      case 'DejaVu Serif':
        return "'DejaVu Serif', 'Times New Roman', Times, serif";
      case 'DejaVu Serif Bold':
        return "'DejaVu Serif', 'Times New Roman', Times, serif";
      case 'DejaVu Sans Mono':
        return "'DejaVu Sans Mono', 'Courier New', Courier, monospace";
      default:
        return name || 'Helvetica';
    }
  };

  const mapJustify = (align?: string) => {
    switch ((align || 'left').toLowerCase()) {
      case 'center':
        return 'center';
      case 'right':
        return 'flex-end';
      default:
        return 'flex-start';
    }
  };

  const renderWidgetContent = () => {
      switch (widget.type) {
      case 'box':
        const bx = widget.properties || {} as any;
        const fill = (bx.fill_color as string) || 'transparent';
        const stroke = (bx.stroke_color as string) || '#000000';
        const bw = typeof bx.stroke_width === 'number' ? bx.stroke_width : 1;
        const radius = typeof bx.corner_radius === 'number' ? bx.corner_radius : 0;
        const alpha = (typeof bx.opacity === 'number' ? Math.max(0, Math.min(1, bx.opacity)) : 1);

        const hexToRgba = (hex: string, a: number) => {
          const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000000');
          const r = m ? parseInt(m[1], 16) : 0;
          const g = m ? parseInt(m[2], 16) : 0;
          const b = m ? parseInt(m[3], 16) : 0;
          return `rgba(${r}, ${g}, ${b}, ${a})`;
        };

        return (
          <div className="h-full w-full" style={{
            backgroundColor: fill && fill !== 'transparent' ? hexToRgba(fill, alpha) : 'transparent',
            border: `${Math.max(0, bw)}px solid ${hexToRgba(stroke, alpha)}`,
            borderRadius: `${Math.max(0, radius)}px`
          }} />
        );
      case 'text_block':
        const textOrientation = widget.properties?.orientation || 'horizontal';
        const isVertical = textOrientation === 'vertical';
        return (
          <div
            className="h-full w-full flex items-center justify-center"
            style={{
              fontFamily: resolveFontFamily(widget.styling?.font),
              fontSize: (widget.styling?.size || 12),
              color: widget.styling?.color || '#000000',
              textAlign: (widget.styling?.text_align as any) || 'left',
              justifyContent: mapJustify(widget.styling?.text_align),
              transform: isVertical ? 'rotate(-90deg)' : 'none',
              transformOrigin: 'center',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere'
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
                width: checkboxSize,
                height: checkboxSize
              }}
            />
            <span
              style={{
                fontSize: (widget.styling?.size || 10),
                fontFamily: resolveFontFamily(widget.styling?.font),
                color: widget.styling?.color || '#000000'
              }}
            >
              {widget.content || 'Checkbox'}
            </span>
          </div>
        );

      case 'divider': {
        const strokeColor = widget.properties?.stroke_color || '#000000';
        const thickness = widget.properties?.line_thickness ?? widget.position.height ?? 1;
        return (
          <div className="h-full flex items-center">
            <div
              className="w-full"
              style={{
                height: Math.max(1, thickness),
                backgroundColor: strokeColor,
              }}
            />
          </div>
        );
      }

      case 'vertical_line': {
        const strokeColor = widget.properties?.stroke_color || '#000000';
        const thickness = widget.properties?.line_thickness ?? widget.position.width ?? 2;
        return (
          <div className="w-full h-full flex justify-center">
            <div
              style={{
                width: Math.max(1, thickness),
                height: '100%',
                backgroundColor: strokeColor,
              }}
            />
          </div>
        );
      }

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
          const yPosition = yAbs;
          
          let lineClass = 'absolute bg-eink-black';
          let borderStyle = '';
          
          if (lineStyle === 'dotted') {
            lineClass = 'absolute';
            borderStyle = `${lineThickness}px dotted #000000`;
          } else if (lineStyle === 'dashed') {
            lineClass = 'absolute';
            borderStyle = `${lineThickness}px dashed #000000`;
          }
          
          elements.push(
            <div
              key={`h-${i}`}
              className={lineClass}
              style={{
                left: marginLeft,
                right: marginRight,
                top: yPosition,
                height: lineStyle === 'solid' ? lineThickness : 0,
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
            const xPosition = (marginLeft + i * gridSpacing);
            elements.push(
              <div
                key={`v-${i}`}
                className="absolute bg-eink-black"
                style={{ left: xPosition, top: 0, width: lineThickness, height: '100%' }}
              />
            );
          }
        } else if (columns && columns > 1) {
          const availableWidth = widget.position.width - marginLeft - marginRight;
          const colWidth = availableWidth / columns;
          for (let c = 1; c < columns; c++) {
            const xPosition = (marginLeft + c * colWidth);
            elements.push(
              <div
                key={`col-${c}`}
                className="absolute bg-eink-black"
                style={{ left: xPosition, top: 0, width: lineThickness, height: '100%' }}
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
            const xPosition = (marginLeft + availableWidth * r);
            elements.push(
              <div
                key={`vg-${idx}`}
                className="absolute bg-eink-black"
                style={{ left: xPosition, top: 0, width: lineThickness, height: '100%' }}
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
        // Make anchors easy to find/select in the editor (visual-only)
        const minSize = 24; // base minimum in points; scaled by canvas
        const anchorLabel = (widget.properties?.dest_id as string) || 'anchor';
        return (
          <div
            className="h-full w-full flex items-center justify-center"
            style={{ minWidth: minSize, minHeight: minSize }}
            title={anchorLabel}
          >
            <div
              className="flex items-center justify-center text-[10px] leading-none text-eink-gray bg-white/80"
              style={{
                width: '100%',
                height: '100%',
                border: '2px dashed #60a5fa', // blue-400
                borderRadius: 4,
                padding: 2,
                boxSizing: 'border-box',
              }}
            >
              ⛵
            </div>
          </div>
        );

      case 'internal_link':
        const linkContent = widget.content || 'Internal Link';
        const linkStyling = widget.styling || {};
        const linkFontSize = (linkStyling.size || 12);
        const linkFontFamily = resolveFontFamily(linkStyling.font);
        const linkColor = linkStyling.color || '#0066CC';
        const linkOrientation = widget.properties?.orientation || 'horizontal';
        const isLinkVertical = linkOrientation === 'vertical';
        return (
          <div
            className="h-full flex items-center justify-center px-1 cursor-pointer hover:bg-blue-50 transition-colors"
            style={{
              fontSize: linkFontSize,
              fontFamily: linkFontFamily,
              color: linkColor,
              textAlign: (widget.styling?.text_align as any) || 'left',
              justifyContent: mapJustify(widget.styling?.text_align),
              textDecoration: 'underline',
              minHeight: '44px',
              transform: isLinkVertical ? 'rotate(-90deg)' : 'none',
              transformOrigin: 'center'
            }}
          >
            <span className={isLinkVertical ? '' : 'truncate'}>{linkContent}</span>
          </div>
        );

      case 'tap_zone':
        // Visualize tap zone with dashed outline in editor (if enabled)
        const showOutline = widget.properties?.outline !== false; // default true
        return (
          <div
            className={clsx('w-full h-full flex items-center justify-center text-xs text-eink-gray', showOutline ? 'border-2 border-dashed border-blue-400 bg-blue-50 bg-opacity-10' : '')}
            style={{ minHeight: 44 }}
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
        const cellMinSize = Math.max(20, calendarProps.cell_min_size || 44);
        const calendarFontSize = Math.max(6, (calendarStyling.size || 10));
        const calendarFontFamily = resolveFontFamily(calendarStyling.font);
        
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
          
          const gridHeight = widget.position.height;
          const headerHeight = showMonthYear ? calendarFontSize * 2 : 0;
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
          const showTimeGutter = !!calendarProps.show_time_gutter;
          const timeStart = Math.max(0, Math.min(23, calendarProps.time_start_hour || 8));
          const timeEnd = Math.max(timeStart + 1, Math.min(24, calendarProps.time_end_hour || 20));
          const slotMinutes = Math.max(5, Math.min(120, calendarProps.time_slot_minutes || 60));
          const labelEvery = Math.max(slotMinutes, Math.min(240, calendarProps.time_label_interval || 60));

          const weekdayGutterWidth = showWeekdays ? calendarFontSize * 4.0 : 0;
          const gridWidth = widget.position.width - weekdayGutterWidth;
          const gridHeight = widget.position.height;

          const headerHeight = showMonthYear ? calendarFontSize * 2 : 0;
          const timeHeaderHeight = showTimeGrid ? calendarFontSize * 1.5 : 0;
          const availableHeight = gridHeight - headerHeight - timeHeaderHeight;

          const cellHeight = availableHeight / 7; // 7 rows for days
          const cellWidth = gridWidth;

          if (showTimeGrid) {
            const totalMinutes = (timeEnd - timeStart) * 60;
            const timeSlots = Math.max(1, Math.floor(totalMinutes / slotMinutes));
            // cellWidth will be divided by time slots when rendering grid
          }

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
                      {/* Time grid (vertical columns) */}
                      {showTimeGrid && (() => {
                        const totalMinutes = (timeEnd - timeStart) * 60;
                        const timeSlots = Math.max(1, Math.floor(totalMinutes / slotMinutes));
                        const slotWidth = cellWidth / timeSlots;
                        const timeColumns = [];

                        for (let s = 0; s < timeSlots; s++) {
                          timeColumns.push(
                            <div
                              key={s}
                              className="absolute top-0 bottom-0"
                              style={{
                                left: s * slotWidth,
                                width: slotWidth,
                                borderRight: showGridLines && s < timeSlots - 1 ? '1px solid #ccc' : 'none'
                              }}
                            />
                          );
                        }
                        return timeColumns;
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
            const gridWidth = widget.position.width - weekColWidth;
            const gridHeight = widget.position.height;
            
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
                          padding: `${Math.max(0, (calendarProps.cell_padding || 4))}px`
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

      case 'link_list':
        const lp = widget.properties || {} as any;
        const lSty = widget.styling || {} as any;
        const toInt = (v: any, d: number) => {
          const n = parseInt(String(v ?? '').trim(), 10);
          return Number.isFinite(n) ? n : d;
        };
        const toFloat = (v: any, d: number) => {
          if (v === null || v === undefined) return d;
          const s = String(v).trim();
          if (s === '') return d;
          const n = parseFloat(s);
          return Number.isFinite(n) ? n : d;
        };
        const lCount = Math.max(1, toInt(lp.count, 1));
        const lStart = Math.max(1, toInt(lp.start_index, 1));
        const lPad = Math.max(1, toInt(lp.index_pad, 3));
        const lCols = Math.max(1, toInt(lp.columns, 1));
        const lGapX = toFloat(lp.gap_x, 0);
        const lGapY = toFloat(lp.gap_y, 0);
        const rawItemH = lp.item_height;
        const lItemH = (rawItemH === null || rawItemH === undefined || String(rawItemH).trim() === '') ? null : toFloat(rawItemH, 0);
        const labelTpl = lp.label_template || 'Note {index_padded}';
        const rows = Math.ceil(lCount / lCols);
        const boxW = widget.position.width;
        const boxH = widget.position.height;
        const gapXz = lGapX;
        const gapYz = lGapY;
        const listOrientation = lp.orientation || 'horizontal';
        const isTextVertical = listOrientation === 'vertical';

        // Typography
        const fontSize = Math.max(8, (lSty.size || 12));
        const fontFamily = resolveFontFamily(lSty.font);
        const textColor = lSty.color || '#0066CC';

        // Calculate base cell sizes from container box
        const baseCellW = (boxW - (lCols - 1) * gapXz) / Math.max(1, lCols);
        const baseCellH = (boxH - (rows - 1) * gapYz) / Math.max(1, rows);

        // Calculate cell dimensions based on orientation (simplified)
        let cellW: number, cellH: number;
        if (isTextVertical) {
          // Vertical: swap base dimensions; fixed width comes from row height (or item_height)
          cellH = baseCellH;
          cellW = lItemH != null ? (lItemH) : baseCellH;
        } else {
          // Horizontal: standard
          cellW = baseCellW;
          cellH = lItemH != null ? (lItemH) : baseCellH;
        }

        const formatLabel = (idx: number) => {
          const padded = String(idx).padStart(2, '0');
          const padded3 = String(idx).padStart(3, '0');
          const locale = (lp.locale as string) || 'en';
          const monthLong = getMonthNames(locale, false);
          const monthShort = getMonthNames(locale, true);
          const monthIdx = Math.max(1, Math.min(12, idx));
          return labelTpl
            .replace('{index_padded}', padded)
            .replace('{index}', String(idx))
            .replace('{month_padded}', padded)
            .replace('{month_padded3}', padded3)
            .replace('{month_name}', monthLong[monthIdx - 1])
            .replace('{month_abbr}', monthShort[monthIdx - 1]);
        };

        const items = Array.from({ length: lCount }, (_, i) => lStart + i);

        const getJustifyClass = (textAlign: string) => {
          switch (textAlign) {
            case 'left': return 'justify-start';
            case 'center': return 'justify-center';
            case 'right': return 'justify-end';
            default: return 'justify-start';
          }
        };

        // Highlight functionality
        const highlightIndex = lp.highlight_index ? parseInt(lp.highlight_index) : null;
        const highlightColor = lp.highlight_color || '#dbeafe';
        const backgroundColor = lp.background_color || 'transparent';
        const isHighlightedItem = (itemIndex: number) => {
          return highlightIndex !== null && itemIndex === highlightIndex;
        };

        return (
          <div className="h-full w-full bg-white">
            <div className="relative" style={{ width: '100%', height: '100%', fontSize, fontFamily, color: textColor }}>
              {items.map((idx, i) => {
                const row = Math.floor(i / lCols);
                const col = i % lCols;
                const left = col * (cellW + gapXz);
                const top = row * (cellH + gapYz);
                const isHighlighted = isHighlightedItem(idx);
                return (
                  <div key={i} className={`absolute px-2 py-1 rounded cursor-pointer flex items-center ${getJustifyClass((lSty.text_align as any) || 'left')}`}
                    style={{
                      left,
                      top,
                      width: cellW,
                      height: cellH,
                      overflow: 'hidden',
                      border: isHighlighted ? `2px solid ${highlightColor}` : '1px dashed #e5e7eb',
                      backgroundColor: isHighlighted ? highlightColor : backgroundColor,
                      textAlign: (lSty.text_align as any) || 'left'
                    }}>
                    <span style={{
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      //overflow: 'hidden',
                      transform: isTextVertical ? 'rotate(-90deg)' : 'none',
                      transformOrigin: 'center',
                      fontWeight: isHighlighted ? 'bold' : 'normal'
                    }}>
                      {formatLabel(idx)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'table': {
        const tableProps = widget.properties || {};
        const rows = tableProps.rows || 4;
        const columns = tableProps.columns || 3;
        const hasHeader = tableProps.has_header !== false;
        const tableData = tableProps.table_data || [];

        // Memoize expensive calculations to prevent re-render thrashing
        const tableConfig = React.useMemo(() => {
          const expectedRows = Math.max(1, hasHeader ? rows + 1 : rows);

          const sampleCell = (rowIndex: number, colIndex: number) => {
            if (hasHeader && rowIndex === 0) {
              return `Header ${colIndex + 1}`;
            }
            const dataRow = hasHeader ? rowIndex : rowIndex + 1;
            return `R${dataRow}C${colIndex + 1}`;
          };

          const normalizedData: string[][] = Array.from({ length: expectedRows }, (_, rowIndex) => {
            const sourceRow = Array.isArray(tableData[rowIndex]) ? tableData[rowIndex] : [];
            return Array.from({ length: columns }, (_, colIndex) => {
              const cell = sourceRow[colIndex];
              return cell === undefined || cell === null
                ? sampleCell(rowIndex, colIndex)
                : String(cell);
            });
          });

          const cellPadding = Math.max(1, tableProps.cell_padding || 2);
          const borderStyle = tableProps.border_style || 'all';
          const headerBg = tableProps.header_background || '#F0F0F0';
          const zebraRows = tableProps.zebra_rows || false;
          const evenRowBg = tableProps.even_row_bg || '#FFFFFF';
          const oddRowBg = tableProps.odd_row_bg || '#F8F8F8';
          const textAlign = (tableProps.text_align || 'left').toLowerCase();
          const justifyContent = textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start';

          const visibleRowCount = Math.min(Math.max(1, normalizedData.length), 8);
          const rowHeight = Math.max(16, widget.position.height / visibleRowCount);
          const colWidth = Math.max(20, widget.position.width / columns);

          return {
            displayData: normalizedData,
            cellPadding,
            borderStyle,
            headerBg,
            zebraRows,
            evenRowBg,
            oddRowBg,
            maxDisplayRows: visibleRowCount,
            rowHeight,
            colWidth,
            textAlign,
            justifyContent
          };
        }, [
          widget.position.width,
          widget.position.height,
          rows,
          columns,
          hasHeader,
          JSON.stringify(tableData), // Stringify for deep comparison
          tableProps.cell_padding,
          tableProps.border_style,
          tableProps.header_background,
          tableProps.zebra_rows,
          tableProps.even_row_bg,
          tableProps.odd_row_bg
        ]);

        const {
          displayData,
          cellPadding,
          borderStyle,
          headerBg,
          zebraRows,
          evenRowBg,
          oddRowBg,
          maxDisplayRows,
          rowHeight,
          colWidth,
          textAlign,
          justifyContent
        } = tableConfig;

        // Memoize the table JSX to prevent DOM regeneration
        const tableJSX = React.useMemo(() => (
          <div
            className="h-full w-full overflow-hidden"
            style={{
              border: borderStyle !== 'none' ? '1px solid #d1d5db' : 'none',
              fontSize: Math.max(8, (widget.styling?.size || 10) * 0.8),
              fontFamily: resolveFontFamily(widget.styling?.font),
              boxSizing: 'border-box'
            }}
          >
            {displayData.slice(0, maxDisplayRows).map((row, rowIndex) => {
              const isHeader = hasHeader && rowIndex === 0;
              const dataRowIndex = hasHeader ? rowIndex - 1 : rowIndex;
              const isEven = dataRowIndex % 2 === 0;
              let rowBg = 'transparent';

              if (isHeader) {
                rowBg = headerBg;
              } else if (zebraRows) {
                rowBg = isEven ? evenRowBg : oddRowBg;
              }

              return (
                <div
                  key={rowIndex}
                  className="flex w-full"
                  style={{
                    backgroundColor: rowBg,
                    height: rowHeight,
                    borderBottom: (borderStyle === 'all' || borderStyle === 'horizontal') && rowIndex < maxDisplayRows - 1 ? '1px solid #d1d5db' : 'none'
                  }}
                >
                  {Array.from({ length: columns }).map((_, colIndex) => {
                    const cell = row[colIndex] ?? '';
                    return (
                      <div
                        key={colIndex}
                        className="flex items-center overflow-hidden"
                        style={{
                          width: colWidth,
                          padding: `${cellPadding}px`,
                          fontWeight: isHeader ? 'bold' : 'normal',
                          borderRight: (borderStyle === 'all' || borderStyle === 'vertical') && colIndex < columns - 1 ? '1px solid #d1d5db' : 'none',
                          boxSizing: 'border-box',
                          minWidth: 0,
                          justifyContent,
                          textAlign
                        }}
                      >
                        <div className="truncate w-full text-xs">
                          {String(cell).slice(0, 12)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ), [
          displayData,
          maxDisplayRows,
          hasHeader,
          headerBg,
          zebraRows,
          evenRowBg,
          oddRowBg,
          rowHeight,
          colWidth,
          cellPadding,
          borderStyle,
          columns,
          widget.styling?.size,
          widget.styling?.font,
          textAlign,
          justifyContent
        ]);

        return tableJSX;
      }

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
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e, widget);
        }
      }}
    >
      {/* Widget Content & Handles */}
      <div className="w-full h-full relative" style={{ backgroundColor: widget.background_color || 'transparent' }}>
        {/* Drag handle is the content layer only */}
        <div ref={drag} className="absolute inset-0">
          {renderWidgetContent()}
        </div>

        {/* Selection Handles */}
        {isSelected && (
          <>
            {/* Corner handles */}
            <div onMouseDown={onHandleMouseDown('nw')} className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 border border-white cursor-nwse-resize z-10" />
            <div onMouseDown={onHandleMouseDown('ne')} className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 border border-white cursor-nesw-resize z-10" />
            <div onMouseDown={onHandleMouseDown('sw')} className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 border border-white cursor-nesw-resize z-10" />
            <div onMouseDown={onHandleMouseDown('se')} className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 border border-white cursor-nwse-resize z-10" />
            
            {/* Edge handles */}
            <div onMouseDown={onHandleMouseDown('n')} className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-blue-500 border border-white cursor-n-resize z-10" />
            <div onMouseDown={onHandleMouseDown('s')} className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-blue-500 border border-white cursor-s-resize z-10" />
            <div onMouseDown={onHandleMouseDown('w')} className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-500 border border-white cursor-w-resize z-10" />
            <div onMouseDown={onHandleMouseDown('e')} className="absolute -right-1 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-500 border border-white cursor-e-resize z-10" />
          </>
        )}
      </div>
    </div>
  );
};

export default CanvasWidget;
