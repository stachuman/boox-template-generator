/**
 * Link widget rendering component.
 *
 * Handles internal_link widget rendering on the canvas.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import { resolveFontFamily, mapJustify } from './utils';

interface LinkWidgetProps {
  widget: Widget;
}

const LinkWidget: React.FC<LinkWidgetProps> = ({ widget }) => {
  const linkContent = widget.content || 'Internal Link';
  const linkStyling = widget.styling || {};
  const linkFontSize = (linkStyling.size || 12);
  const linkFontFamily = resolveFontFamily(linkStyling.font);
  const linkColor = linkStyling.color || '#0066CC';
  const linkOrientation = widget.properties?.orientation || 'horizontal';
  const isLinkVertical = linkOrientation === 'vertical';

  if (isLinkVertical) {
    // For vertical links, use height as the wrapping constraint
    return (
      <div
        className="h-full w-full flex items-center justify-center px-1 cursor-pointer hover:bg-blue-50 transition-colors"
        style={{
          fontSize: linkFontSize,
          fontFamily: linkFontFamily,
          color: linkColor,
          textDecoration: 'underline',
          minHeight: '44px',
          writingMode: 'vertical-rl' as any,
          textOrientation: 'mixed',
          textAlign: (widget.styling?.text_align as any) || 'left',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          overflow: 'hidden'
        }}
      >
        <span>{linkContent}</span>
      </div>
    );
  }

  return (
    <div
      className="h-full flex items-center justify-center px-1 cursor-pointer hover:bg-blue-50 transition-colors"
      style={{
        fontSize: linkFontSize,
        fontFamily: linkFontFamily,
        color: linkColor,
        textAlign: (widget.styling?.text_align as any) || 'left',
        justifyContent: mapJustify(widget.styling?.text_align),
        textDecoration: 'underline',
        minHeight: '44px'
      }}
    >
      <span className="truncate">{linkContent}</span>
    </div>
  );
};

export default LinkWidget;