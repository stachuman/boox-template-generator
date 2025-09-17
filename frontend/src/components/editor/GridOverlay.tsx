/**
 * Grid overlay component for the canvas.
 * 
 * Provides visual grid lines to help with widget alignment.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { useEditorStore } from '@/stores/editorStore';

const GridOverlay: React.FC = () => {
  const { currentTemplate } = useEditorStore();

  if (!currentTemplate) return null;

  const gridSize = currentTemplate.canvas.grid_size || 10;
  const canvasWidth = currentTemplate.canvas.dimensions.width;
  const canvasHeight = currentTemplate.canvas.dimensions.height;

  const verticalLines = [];
  const horizontalLines = [];

  // Generate vertical lines
  for (let x = gridSize; x < canvasWidth; x += gridSize) {
    verticalLines.push(
      <line
        key={`v-${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={canvasHeight}
        stroke="#e5e7eb"
        strokeWidth={0.5}
        opacity={0.5}
      />
    );
  }

  // Generate horizontal lines
  for (let y = gridSize; y < canvasHeight; y += gridSize) {
    horizontalLines.push(
      <line
        key={`h-${y}`}
        x1={0}
        y1={y}
        x2={canvasWidth}
        y2={y}
        stroke="#e5e7eb"
        strokeWidth={0.5}
        opacity={0.5}
      />
    );
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={canvasWidth}
      height={canvasHeight}
    >
      {verticalLines}
      {horizontalLines}
    </svg>
  );
};

export default GridOverlay;