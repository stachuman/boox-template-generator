/**
 * Line widget rendering component.
 *
 * Handles divider, vertical_line, and lines widget rendering on the canvas.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';

interface LineWidgetProps {
  widget: Widget;
}

const LineWidget: React.FC<LineWidgetProps> = ({ widget }) => {
  const properties = widget.properties || {};

  // Handle divider widgets (horizontal lines)
  if (widget.type === 'divider') {
    const strokeColor = properties.stroke_color || '#000000';
    const thickness = properties.line_thickness ?? widget.position.height ?? 1;

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

  // Handle vertical line widgets
  if (widget.type === 'vertical_line') {
    const strokeColor = properties.stroke_color || '#000000';
    const thickness = properties.line_thickness ?? widget.position.width ?? 2;

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

  // Handle complex lines widgets (ruled paper, grids, etc.)
  if (widget.type === 'lines') {
    const lineSpacing = properties.line_spacing || 20;
    const lineCount = properties.line_count || 10;
    const lineThickness = properties.line_thickness || 0.75;
    const marginLeft = properties.margin_left || 0;
    const marginRight = properties.margin_right || 0;
    const lineStyle = properties.line_style || 'solid';
    const topPadding = properties.top_padding || 0;
    const bottomPadding = properties.bottom_padding || 0;
    const gridSpacing = properties.grid_spacing || 20;
    const columns = properties.columns || 1;
    const columnGap = properties.column_gap || 20;

    const elements = [] as JSX.Element[];

    // Calculate column layout
    const heightPt = widget.position.height;

    if (columns > 1) {
      // Multi-column layout - draw lines within each column
      const totalGapWidth = columnGap * (columns - 1);
      const availableWidth = widget.position.width - marginLeft - marginRight - totalGapWidth;
      const columnWidth = availableWidth / columns;

      for (let col = 0; col < columns; col++) {
        const xStart = marginLeft + (col * (columnWidth + columnGap));
        const xEnd = xStart + columnWidth;

        // Draw horizontal lines for this column
        for (let i = 0; i < lineCount; i++) {
          const yAbs = topPadding + i * lineSpacing;
          if (yAbs > heightPt - bottomPadding) break;
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
              key={`col-${col}-h-${i}`}
              className={lineClass}
              style={{
                left: xStart,
                width: columnWidth,
                top: yPosition,
                height: lineStyle === 'solid' ? lineThickness : 0,
                borderTop: borderStyle || undefined,
              }}
            />
          );
        }
      }
    } else {
      // Single column layout - draw full-width lines
      for (let i = 0; i < lineCount; i++) {
        const yAbs = topPadding + i * lineSpacing;
        if (yAbs > heightPt - bottomPadding) break;
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
  }

  // Fallback for unknown line widget types
  return (
    <div className="h-full w-full border border-dashed border-gray-400 flex items-center justify-center text-xs text-gray-500">
      Unknown line widget: {widget.type}
    </div>
  );
};

export default LineWidget;