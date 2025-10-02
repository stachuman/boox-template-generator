/**
 * Tap zone widget rendering component.
 *
 * Handles tap_zone widget rendering on the canvas.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import clsx from 'clsx';

interface TapZoneWidgetProps {
  widget: Widget;
}

const TapZoneWidget: React.FC<TapZoneWidgetProps> = ({ widget }) => {
  // Visualize tap zone with dashed outline in editor (if enabled)
  const showOutline = widget.properties?.outline !== false; // default true

  return (
    <div
      className={clsx(
        'w-full h-full flex items-center justify-center text-xs text-eink-gray',
        showOutline ? 'border-2 border-dashed border-blue-400 bg-blue-50 bg-opacity-10' : ''
      )}
      style={{ minHeight: 44 }}
    >
      {showOutline && 'Tap Zone'}
    </div>
  );
};

export default TapZoneWidget;