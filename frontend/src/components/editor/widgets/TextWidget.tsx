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

interface TextWidgetProps {
  widget: Widget;
}

const TextWidget: React.FC<TextWidgetProps> = ({ widget }) => {
  const textOrientation = widget.properties?.orientation || 'horizontal';
  const isVertical = textOrientation === 'vertical';
  const fontCSS = getFontCSS(widget.styling?.font);

  if (isVertical) {
    // For vertical text, use height as the wrapping constraint
    return (
      <div
        className="h-full w-full flex items-center justify-center"
        style={{
          fontFamily: fontCSS.fontFamily,
          fontWeight: fontCSS.fontWeight,
          fontStyle: fontCSS.fontStyle,
          fontSize: (widget.styling?.size || 12),
          color: widget.styling?.color || '#000000',
          writingMode: 'vertical-rl' as any,
          textOrientation: 'mixed',
          textAlign: (widget.styling?.text_align as any) || 'left',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          // Height becomes the width constraint for vertical text
          width: '100%',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        {widget.content || 'Text Block'}
      </div>
    );
  }

  return (
    <div
      className="h-full w-full flex items-center justify-center"
      style={{
        fontFamily: fontCSS.fontFamily,
        fontWeight: fontCSS.fontWeight,
        fontStyle: fontCSS.fontStyle,
        fontSize: (widget.styling?.size || 12),
        color: widget.styling?.color || '#000000',
        textAlign: (widget.styling?.text_align as any) || 'left',
        justifyContent: mapJustify(widget.styling?.text_align),
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere'
      }}
    >
      {widget.content || 'Text Block'}
    </div>
  );
};

export default TextWidget;