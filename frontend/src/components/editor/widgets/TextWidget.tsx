/**
 * Text widget rendering component.
 *
 * Handles text_block widget rendering on the canvas.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import { mapJustify } from './utils';
import { getFontCSS } from '@/lib/fonts';
import { normalizeOrientation, isVerticalOrientation } from './textUtils';

interface TextWidgetProps {
  widget: Widget;
}

const TextWidget: React.FC<TextWidgetProps> = ({ widget }) => {
  const fontCSS = getFontCSS(widget.styling?.font);
  const orientation = normalizeOrientation(widget.properties?.orientation);
  const vertical = isVerticalOrientation(orientation);

  return (
    <div
      className="h-full w-full flex"
      style={{
        fontFamily: fontCSS.fontFamily,
        fontWeight: fontCSS.fontWeight,
        fontStyle: fontCSS.fontStyle,
        fontSize: (widget.styling?.size || 12),
        color: widget.styling?.color || '#000000',
        textAlign: (widget.styling?.text_align as any) || 'left',
        justifyContent: mapJustify(widget.styling?.text_align),
        alignItems: vertical ? 'stretch' : 'center',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        overflow: 'hidden'
      }}
    >
      {widget.content || 'Text Block'}
    </div>
  );
};

export default TextWidget;
