/**
 * Table widget rendering component.
 *
 * Handles table widget preview rendering on the canvas.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import { replaceTokensForPreview, getSamplePreviewContext } from '@/lib/tokens';

interface TableWidgetProps {
  widget: Widget;
}

const TableWidget: React.FC<TableWidgetProps> = ({ widget }) => {
  const tableProps = widget.properties || {};
  const rows = tableProps.rows || 4;
  const columns = tableProps.columns || 3;
  const hasHeader = tableProps.has_header !== false;
  const tableData = tableProps.table_data || [];

  // Memoize expensive calculations to prevent re-render thrashing
  const tableConfig = React.useMemo(() => {
    const expectedRows = Math.max(1, hasHeader ? rows + 1 : rows);

    // Get preview context for token replacement
    const previewContext = getSamplePreviewContext({
      page: 1, // Current page preview
      total_pages: 10 // Sample total pages for preview
    });

    const sampleCell = (rowIndex: number, colIndex: number) => {
      if (hasHeader && rowIndex === 0) {
        return `Header ${colIndex + 1}`;
      }
      const dataRow = hasHeader ? rowIndex : rowIndex + 1;
      return `R${dataRow}C${colIndex + 1}`;
    };

    const normalizedData: string[][] = Array.from({ length: expectedRows }, (_, rowIndex) => {
      const sourceRow = Array.isArray(tableData[rowIndex]) ? tableData[rowIndex] : [];
      return Array.from({ length: columns }, (_, colIndex) => {
        const cell = sourceRow[colIndex];
        if (cell === undefined || cell === null) {
          return sampleCell(rowIndex, colIndex);
        }
        // Apply token replacement for preview
        const cellText = String(cell);
        return replaceTokensForPreview(cellText, previewContext);
      });
    });

    const cellPadding = Math.max(1, tableProps.cell_padding ?? 4);
    const borderStyle = tableProps.border_style || 'all';
    const headerBg = tableProps.header_background || '#F0F0F0';
    const zebraRows = tableProps.zebra_rows || false;
    const evenRowBg = tableProps.even_row_bg || '#FFFFFF';
    const oddRowBg = tableProps.odd_row_bg || '#F8F8F8';
    const textAlign = (tableProps.text_align || 'left').toLowerCase();
    const justifyContent = textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start';

    const totalRows = Math.max(1, normalizedData.length);
    const explicitRowHeight = Number(tableProps.row_height);
    const rowHeight = Number.isFinite(explicitRowHeight) && explicitRowHeight > 0
      ? explicitRowHeight
      : widget.position.height / totalRows;

    const columnWidthRatios = Array.isArray(tableProps.column_widths) && tableProps.column_widths.length === columns
      ? tableProps.column_widths
      : null;

    const columnWidths = columnWidthRatios && columnWidthRatios.some((v) => typeof v === 'number')
      ? (() => {
          const sanitized = columnWidthRatios.map((v) => (typeof v === 'number' && v > 0 ? v : 1));
          const total = sanitized.reduce((acc, v) => acc + v, 0) || columns;
          return sanitized.map((v) => (v / total) * widget.position.width);
        })()
      : Array.from({ length: columns }, () => widget.position.width / Math.max(1, columns));

    const borderColor = tableProps.stroke_color || '#000000';

    return {
      displayData: normalizedData,
      cellPadding,
      borderStyle,
      headerBg,
      zebraRows,
      evenRowBg,
      oddRowBg,
      rowHeight,
      columnWidths,
      borderColor,
      textAlign,
      justifyContent
    };
  }, [
    widget.position.width,
    widget.position.height,
    rows,
    columns,
    hasHeader,
    JSON.stringify(tableData), // Stringify for deep comparison
    tableProps.stroke_color,
    tableProps.cell_padding,
    tableProps.border_style,
    tableProps.header_background,
    tableProps.zebra_rows,
    tableProps.even_row_bg,
    tableProps.odd_row_bg,
    tableProps.row_height,
    tableProps.column_widths,
    tableProps.text_align
  ]);

  const {
    displayData,
    cellPadding,
    borderStyle,
    headerBg,
    zebraRows,
    evenRowBg,
    oddRowBg,
    rowHeight,
    columnWidths,
    borderColor,
    textAlign,
    justifyContent
  } = tableConfig;

  // Helper function to resolve font family
  const resolveFontFamily = (font?: string) => {
    switch (font) {
      case 'Courier-Prime':
        return '"Courier Prime", monospace';
      case 'Patrick-Hand':
        return '"Patrick Hand", cursive';
      case 'DejaVu Sans':
        return '"DejaVu Sans", sans-serif';
      case 'DejaVu Sans Bold':
        return '"DejaVu Sans", sans-serif';
      case 'DejaVu Serif':
        return '"DejaVu Serif", serif';
      case 'DejaVu Serif Bold':
        return '"DejaVu Serif", serif';
      case 'DejaVu Sans Mono':
        return '"DejaVu Sans Mono", monospace';
      default:
        return font || 'Helvetica, Arial, sans-serif';
    }
  };

  // Memoize the table JSX to prevent DOM regeneration
  const tableJSX = React.useMemo(() => (
    <div
      className="h-full w-full overflow-hidden"
      style={{
        border: ['outer', 'all'].includes(borderStyle) ? `1px solid ${borderColor}` : 'none',
        fontSize: widget.styling?.size || 10,
        fontFamily: resolveFontFamily(widget.styling?.font),
        boxSizing: 'border-box'
      }}
    >
      {displayData.map((row, rowIndex) => {
        const isHeader = hasHeader && rowIndex === 0;
        const dataRowIndex = hasHeader ? rowIndex - 1 : rowIndex;
        const isEven = dataRowIndex % 2 === 0;
        let rowBg = 'transparent';

        if (isHeader) {
          rowBg = headerBg;
        } else if (zebraRows) {
          rowBg = isEven ? evenRowBg : oddRowBg;
        }

        return (
          <div
            key={rowIndex}
            className="flex w-full"
            style={{
              backgroundColor: rowBg,
              height: rowHeight,
              borderBottom: (borderStyle === 'all' || borderStyle === 'horizontal') && rowIndex < displayData.length - 1
                ? `1px solid ${borderColor}`
                : 'none'
            }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => {
              const cell = row[colIndex] ?? '';
              const width = columnWidths[colIndex] ?? (widget.position.width / Math.max(1, columns));
              return (
                <div
                  key={colIndex}
                  className="flex items-center overflow-hidden"
                  style={{
                    width,
                    padding: `${cellPadding}px`,
                    fontWeight: isHeader ? 'bold' : 'normal',
                    borderRight: (borderStyle === 'all' || borderStyle === 'vertical') && colIndex < columns - 1
                      ? `1px solid ${borderColor}`
                      : 'none',
                    boxSizing: 'border-box',
                    minWidth: 0,
                    justifyContent,
                    textAlign: textAlign as any
                  }}
                >
                  <div
                    className="w-full"
                    style={{
                      whiteSpace: tableProps.text_wrap ? 'normal' : 'nowrap',
                      overflow: 'hidden',
                      textOverflow: tableProps.text_wrap ? 'clip' : 'ellipsis'
                    }}
                  >
                    {String(cell)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  ), [
    displayData,
    hasHeader,
    headerBg,
    zebraRows,
    evenRowBg,
    oddRowBg,
    rowHeight,
    columnWidths,
    cellPadding,
    borderStyle,
    columns,
    widget.styling?.size,
    widget.styling?.font,
    textAlign,
    justifyContent,
    borderColor,
    tableProps.text_wrap,
    widget.position.width
  ]);

  return tableJSX;
};

export default TableWidget;
