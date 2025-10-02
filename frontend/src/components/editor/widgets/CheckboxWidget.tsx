/**
 * Checkbox widget rendering component.
 *
 * Handles checkbox widget rendering on the canvas.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import { resolveFontFamily } from './utils';

interface CheckboxWidgetProps {
  widget: Widget;
}

const CheckboxWidget: React.FC<CheckboxWidgetProps> = ({ widget }) => {
  const checkboxSize = widget.properties?.box_size
    ?? widget.properties?.checkbox_size
    ?? 12;

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
};

export default CheckboxWidget;
