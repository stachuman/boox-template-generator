/**
 * Anchor widget rendering component.
 *
 * Handles anchor widget rendering on the canvas.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';

interface AnchorWidgetProps {
  widget: Widget;
}

const AnchorWidget: React.FC<AnchorWidgetProps> = ({ widget }) => {
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
        ⚓ {anchorLabel}
      </div>
    </div>
  );
};

export default AnchorWidget;