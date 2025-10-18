/**
 * Dot grid widget rendering component.
 *
 * Renders evenly-spaced dot grid patterns for e-ink notebooks.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';

interface DotGridWidgetProps {
  widget: Widget;
}

const DotGridWidget: React.FC<DotGridWidgetProps> = ({ widget }) => {
  const properties = widget.properties || {};

  // Get dot grid properties with validation
  const gridCellSize = Math.max(5, properties.grid_cell_size || 10);
  const dotSize = Math.max(0.5, Math.min(gridCellSize / 2, properties.dot_size || 1.5));
  const dotShape = properties.dot_shape || 'round';
  const dotColor = properties.dot_color || '#CCCCCC';
  const marginLeft = Math.max(0, properties.margin_left || 0);
  const marginRight = Math.max(0, properties.margin_right || 0);
  const marginTop = Math.max(0, properties.margin_top || 0);
  const marginBottom = Math.max(0, properties.margin_bottom || 0);

  // Calculate available area for dots
  const availableWidth = widget.position.width - marginLeft - marginRight;
  const availableHeight = widget.position.height - marginTop - marginBottom;

  // Validate that we have space to render
  if (availableWidth <= 0 || availableHeight <= 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
        Margins too large
      </div>
    );
  }

  // Calculate number of dots that fit
  const dotsX = Math.floor(availableWidth / gridCellSize) + 1;
  const dotsY = Math.floor(availableHeight / gridCellSize) + 1;

  // Generate dot elements
  const dots: JSX.Element[] = [];

  for (let row = 0; row < dotsY; row++) {
    for (let col = 0; col < dotsX; col++) {
      const x = marginLeft + (col * gridCellSize);
      const y = marginTop + (row * gridCellSize);

      const key = `dot-${row}-${col}`;

      if (dotShape === 'square') {
        // Square dots
        dots.push(
          <div
            key={key}
            className="absolute"
            style={{
              left: x - dotSize / 2,
              top: y - dotSize / 2,
              width: dotSize,
              height: dotSize,
              backgroundColor: dotColor,
            }}
          />
        );
      } else {
        // Round dots (default)
        dots.push(
          <div
            key={key}
            className="absolute"
            style={{
              left: x - dotSize / 2,
              top: y - dotSize / 2,
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              backgroundColor: dotColor,
            }}
          />
        );
      }
    }
  }

  return (
    <div className="h-full w-full relative">
      {dots}
    </div>
  );
};

export default DotGridWidget;
