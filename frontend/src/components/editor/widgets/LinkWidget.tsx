/**
 * Link widget rendering component.
 *
 * Handles internal_link widget rendering on the canvas.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import { resolveFontFamily, mapJustify } from './utils';
import { normalizeOrientation, isVerticalOrientation } from './textUtils';

interface LinkWidgetProps {
  widget: Widget;
}

const LinkWidget: React.FC<LinkWidgetProps> = ({ widget }) => {
  const linkContent = widget.content || 'Internal Link';
  const linkStyling = widget.styling || {};
  const linkFontSize = linkStyling.size || 12;
  const linkFontFamily = resolveFontFamily(linkStyling.font);
  const linkColor = linkStyling.color || '#0066CC';
  const backgroundColor = widget.background_color || 'transparent';
  const orientation = normalizeOrientation(widget.properties?.orientation);
  const vertical = isVerticalOrientation(orientation);

  return (
    <div
      className="h-full w-full flex px-1 cursor-pointer hover:bg-blue-50 transition-colors"
      style={{
        fontSize: linkFontSize,
        fontFamily: linkFontFamily,
        color: linkColor,
        backgroundColor: backgroundColor,
        textAlign: (widget.styling?.text_align as any) || 'left',
        justifyContent: mapJustify(widget.styling?.text_align),
        alignItems: vertical ? 'stretch' : 'center',
        textDecoration: 'underline',
        minHeight: '44px',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        overflow: 'hidden'
      }}
    >
      {linkContent}
    </div>
  );
};

export default LinkWidget;
