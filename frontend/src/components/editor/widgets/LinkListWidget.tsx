/**
 * Link list widget rendering component.
 *
 * Handles link_list widget rendering on the canvas using labels/destinations arrays.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import { getFontCSS } from '@/lib/fonts';

interface LinkListWidgetProps {
  widget: Widget;
}

const LinkListWidget: React.FC<LinkListWidgetProps> = ({ widget }) => {
  const lp = widget.properties || {} as any;
  const lSty = widget.styling || {} as any;

  // Get labels and destinations arrays
  const labels = Array.isArray(lp.labels) ? lp.labels : [];
  const destinations = Array.isArray(lp.destinations) ? lp.destinations : [];

  // If no labels, show placeholder
  if (labels.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300">
        <div className="text-center text-gray-500 text-sm">
          <div className="font-medium">Link List</div>
          <div className="text-xs mt-1">Click "Edit Links" to add items</div>
        </div>
      </div>
    );
  }

  // Helper functions for safe parsing
  const toInt = (v: any, d: number) => {
    const n = parseInt(String(v ?? '').trim(), 10);
    return Number.isFinite(n) ? n : d;
  };

  const toFloat = (v: any, d: number) => {
    if (v === null || v === undefined) return d;
    const s = String(v).trim();
    if (s === '') return d;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : d;
  };

  // Parse properties
  const lCols = Math.max(1, toInt(lp.columns, 1));
  const lGapX = toFloat(lp.gap_x, 0);
  const lGapY = toFloat(lp.gap_y, 6);
  const rawItemH = lp.item_height;
  const lItemH = (rawItemH === null || rawItemH === undefined || String(rawItemH).trim() === '') ? null : toFloat(rawItemH, 24);
  const listOrientation = lp.orientation || 'horizontal';

  // Calculate layout
  const lCount = labels.length;
  const rows = Math.ceil(lCount / lCols);
  const boxW = widget.position.width;
  const boxH = widget.position.height;

  // Typography
  const fontSize = Math.max(8, (lSty.size || 12));
  const fontCSS = getFontCSS(lSty.font);
  const textColor = lSty.color || '#0066CC';

  // Calculate base cell sizes from container box
  const baseCellW = (boxW - (lCols - 1) * lGapX) / Math.max(1, lCols);
  const baseCellH = (boxH - (rows - 1) * lGapY) / Math.max(1, rows);

  // Calculate cell dimensions
  const cellW = baseCellW;
  const cellH = lItemH != null ? lItemH : baseCellH;

  // Text alignment helper
  const getJustifyClass = (textAlign: string) => {
    switch (textAlign) {
      case 'left': return 'justify-start';
      case 'center': return 'justify-center';
      case 'right': return 'justify-end';
      default: return 'justify-start';
    }
  };

  // Highlight functionality (1-based index)
  // Support both static numbers and tokens (show token pattern in preview)
  const highlightIndexRaw = lp.highlight_index;
  let highlightIndex: number | null = null;
  let isTokenHighlight = false;

  if (highlightIndexRaw) {
    if (typeof highlightIndexRaw === 'string') {
      // Check if it's a token pattern like {month} or {index}
      if (highlightIndexRaw.includes('{') || highlightIndexRaw.includes('@')) {
        isTokenHighlight = true;
        // In editor preview, don't highlight anything (will be resolved at compile time)
        highlightIndex = null;
      } else {
        // Try to parse as number
        const parsed = parseInt(highlightIndexRaw);
        highlightIndex = isNaN(parsed) ? null : parsed;
      }
    } else {
      highlightIndex = parseInt(String(highlightIndexRaw)) || null;
    }
  }

  const highlightColor = lp.highlight_color || '#dbeafe';
  const backgroundColor = lp.background_color || 'transparent';
  const isHighlightedItem = (itemIndex: number) => {
    return highlightIndex !== null && (itemIndex + 1) === highlightIndex;
  };

  return (
    <div className="h-full w-full bg-white relative">
      {/* Show token indicator if using dynamic highlighting */}
      {isTokenHighlight && (
        <div className="absolute top-1 right-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded z-10">
          Dynamic: {highlightIndexRaw}
        </div>
      )}
      <div className="relative" style={{
        width: '100%',
        height: '100%',
        fontSize,
        fontFamily: fontCSS.fontFamily,
        fontWeight: fontCSS.fontWeight,
        fontStyle: fontCSS.fontStyle,
        color: textColor
      }}>
        {labels.map((label: string, i: number) => {
          const row = Math.floor(i / lCols);
          const col = i % lCols;
          const left = col * (cellW + lGapX);
          const top = row * (cellH + lGapY);
          const isHighlighted = isHighlightedItem(i);
          const destination = destinations[i] || '';

          return (
            <div
              key={i}
              className={`absolute px-2 py-1 rounded cursor-pointer flex items-center ${getJustifyClass((lSty.text_align as any) || 'left')}`}
              style={{
                left,
                top,
                width: cellW,
                height: cellH,
                overflow: 'hidden',
                border: isHighlighted ? `2px solid ${highlightColor}` : '1px dashed #e5e7eb',
                backgroundColor: isHighlighted ? highlightColor : backgroundColor,
                textAlign: (lSty.text_align as any) || 'left'
              }}
              title={destination ? `→ ${destination}` : undefined}
            >
              <span
                style={{
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  width: '100%',
                  fontWeight: isHighlighted ? 'bold' : 'normal'
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LinkListWidget;
