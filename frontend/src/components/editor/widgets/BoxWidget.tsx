/**
 * Box widget rendering component.
 *
 * Handles box widget rendering on the canvas.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import { hexToRgba } from './utils';

interface BoxWidgetProps {
  widget: Widget;
}

const BoxWidget: React.FC<BoxWidgetProps> = ({ widget }) => {
  const bx = widget.properties || ({} as any);
  const styling = widget.styling || {} as any;

  const fill = typeof styling.fill_color === 'string'
    ? styling.fill_color
    : (bx.fill_color as string) || 'transparent';

  const stroke = typeof styling.stroke_color === 'string'
    ? styling.stroke_color
    : (bx.stroke_color as string) || '#000000';

  const bw = typeof styling.line_width === 'number'
    ? styling.line_width
    : (typeof bx.stroke_width === 'number' ? bx.stroke_width : 1);

  const radius = typeof bx.corner_radius === 'number' ? bx.corner_radius : 0;
  const alpha = typeof bx.opacity === 'number' ? Math.max(0, Math.min(1, bx.opacity)) : 1;

  const resolvedFill = typeof fill === 'string' && fill.startsWith('#')
    ? hexToRgba(fill, alpha)
    : (fill || 'transparent');

  const resolvedStroke = typeof stroke === 'string' && stroke.startsWith('#')
    ? hexToRgba(stroke, alpha)
    : (stroke || 'transparent');

  return (
    <div
      className="h-full w-full"
      style={{
        backgroundColor: fill && fill.toLowerCase() !== 'transparent' ? resolvedFill : 'transparent',
        border: `${Math.max(0, bw)}px solid ${resolvedStroke}`,
        borderRadius: `${Math.max(0, radius)}px`
      }}
    />
  );
};

export default BoxWidget;
