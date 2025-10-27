/**
 * Drag overlay component showing real-time coordinates and dimensions.
 *
 * Uses useDragLayer to track drag state globally and display coordinates.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { useDragLayer } from 'react-dnd';
import { useEditorStore } from '@/stores/editorStore';

const DragOverlay: React.FC = () => {
  const dragInfo = useEditorStore((state) => state.dragInfo);

  const { isDragging, currentOffset } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    currentOffset: monitor.getClientOffset(),
  }));

  // Don't render if not dragging or missing data
  if (!isDragging || !currentOffset || !dragInfo) {
    return null;
  }

  // Validate dragInfo has required properties (fail fast per CLAUDE.md)
  if (typeof dragInfo.x !== 'number' || typeof dragInfo.y !== 'number' ||
      typeof dragInfo.width !== 'number' || typeof dragInfo.height !== 'number') {
    console.error('DragOverlay: Invalid dragInfo structure', dragInfo);
    return null;
  }

  // Use widget position from dragInfo (already snapped)
  const canvasX = dragInfo.x;
  const canvasY = dragInfo.y;
  const width = dragInfo.width;
  const height = dragInfo.height;

  // Offset from cursor to avoid obscuring the widget being dragged
  // 20px right keeps overlay away from cursor, -40px up keeps it visible above cursor
  const OVERLAY_OFFSET_X = 20;
  const OVERLAY_OFFSET_Y = -40;

  return (
    <div
      className="fixed pointer-events-none z-50 bg-gray-900 text-white px-3 py-2 rounded-md shadow-lg text-sm font-mono whitespace-nowrap"
      style={{
        left: currentOffset.x + OVERLAY_OFFSET_X,
        top: currentOffset.y + OVERLAY_OFFSET_Y,
      }}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-gray-400">X:</span>
          <span className="font-semibold">{Math.round(canvasX)}</span>
          <span className="text-gray-400">Y:</span>
          <span className="font-semibold">{Math.round(canvasY)}</span>
        </div>
        <div className="flex items-center gap-3 border-t border-gray-700 pt-1">
          <span className="text-gray-400">W:</span>
          <span className="font-semibold">{Math.round(width)}</span>
          <span className="text-gray-400">H:</span>
          <span className="font-semibold">{Math.round(height)}</span>
        </div>
      </div>
    </div>
  );
};

export default DragOverlay;
