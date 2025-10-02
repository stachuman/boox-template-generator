/**
 * Link list widget rendering component.
 *
 * Handles link_list widget rendering on the canvas.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import { getMonthNames } from '@/lib/i18n';
import { getFontCSS } from '@/lib/fonts';

interface LinkListWidgetProps {
  widget: Widget;
}

const LinkListWidget: React.FC<LinkListWidgetProps> = ({ widget }) => {
  const lp = widget.properties || {} as any;
  const lSty = widget.styling || {} as any;

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
  const lCount = Math.max(1, toInt(lp.count, 1));
  const lStart = Math.max(1, toInt(lp.start_index, 1));
  const lPad = Math.max(1, toInt(lp.index_pad, 3));
  const lCols = Math.max(1, toInt(lp.columns, 1));
  const lGapX = toFloat(lp.gap_x, 0);
  const lGapY = toFloat(lp.gap_y, 0);
  const rawItemH = lp.item_height;
  const lItemH = (rawItemH === null || rawItemH === undefined || String(rawItemH).trim() === '') ? null : toFloat(rawItemH, 0);
  const labelTpl = lp.label_template || 'Note {index_padded}';
  const listOrientation = lp.orientation || 'horizontal';
  const isTextVertical = listOrientation === 'vertical';

  // Calculate layout
  const rows = Math.ceil(lCount / lCols);
  const boxW = widget.position.width;
  const boxH = widget.position.height;
  const gapXz = lGapX;
  const gapYz = lGapY;

  // Typography
  const fontSize = Math.max(8, (lSty.size || 12));
  const fontCSS = getFontCSS(lSty.font);
  const textColor = lSty.color || '#0066CC';

  // Calculate base cell sizes from container box
  const baseCellW = (boxW - (lCols - 1) * gapXz) / Math.max(1, lCols);
  const baseCellH = (boxH - (rows - 1) * gapYz) / Math.max(1, rows);

  // Calculate cell dimensions based on orientation
  let cellW: number, cellH: number;
  if (isTextVertical) {
    // Vertical: swap base dimensions; fixed width comes from row height (or item_height)
    cellH = baseCellH;
    cellW = lItemH != null ? (lItemH) : baseCellH;
  } else {
    // Horizontal: standard
    cellW = baseCellW;
    cellH = lItemH != null ? (lItemH) : baseCellH;
  }

  // Label formatting function
  const formatLabel = (idx: number) => {
    const padded = String(idx).padStart(2, '0');
    const padded3 = String(idx).padStart(3, '0');
    const locale = (lp.locale as string) || 'en';
    const monthLong = getMonthNames(locale, false);
    const monthShort = getMonthNames(locale, true);
    const monthIdx = Math.max(1, Math.min(12, idx));
    return labelTpl
      .replace('{index_padded}', padded)
      .replace('{index}', String(idx))
      .replace('{month_padded}', padded)
      .replace('{month_padded3}', padded3)
      .replace('{month_name}', monthLong[monthIdx - 1])
      .replace('{month_abbr}', monthShort[monthIdx - 1]);
  };

  // Generate items array
  const items = Array.from({ length: lCount }, (_, i) => lStart + i);

  // Text alignment helper
  const getJustifyClass = (textAlign: string) => {
    switch (textAlign) {
      case 'left': return 'justify-start';
      case 'center': return 'justify-center';
      case 'right': return 'justify-end';
      default: return 'justify-start';
    }
  };

  // Highlight functionality
  const highlightIndex = lp.highlight_index ? parseInt(lp.highlight_index) : null;
  const highlightColor = lp.highlight_color || '#dbeafe';
  const backgroundColor = lp.background_color || 'transparent';
  const isHighlightedItem = (itemIndex: number) => {
    return highlightIndex !== null && itemIndex === highlightIndex;
  };

  return (
    <div className="h-full w-full bg-white">
      <div className="relative" style={{ width: '100%', height: '100%', fontSize, fontFamily: fontCSS.fontFamily, fontWeight: fontCSS.fontWeight, fontStyle: fontCSS.fontStyle, color: textColor }}>
        {items.map((idx, i) => {
          const row = Math.floor(i / lCols);
          const col = i % lCols;
          const left = col * (cellW + gapXz);
          const top = row * (cellH + gapYz);
          const isHighlighted = isHighlightedItem(idx);
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
            >
              <span style={{
                display: 'inline-block',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                transform: isTextVertical ? 'rotate(-90deg)' : 'none',
                transformOrigin: 'center',
                fontWeight: isHighlighted ? 'bold' : 'normal'
              }}>
                {formatLabel(idx)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LinkListWidget;