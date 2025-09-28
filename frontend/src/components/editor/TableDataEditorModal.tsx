import React from 'react';

interface TableDataEditorModalProps {
  isOpen: boolean;
  rows: number;
  columns: number;
  hasHeader: boolean;
  data: any[];
  onClose: () => void;
  onSave: (payload: { data: string[][]; rows: number; columns: number }) => void;
}

const clampNumber = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
};

const buildSampleCell = (rowIndex: number, colIndex: number, hasHeader: boolean): string => {
  if (hasHeader && rowIndex === 0) {
    return `Header ${colIndex + 1}`;
  }
  const dataRowNumber = hasHeader ? rowIndex : rowIndex + 1;
  return `R${dataRowNumber}C${colIndex + 1}`;
};

const normalizeMatrix = (
  sourceData: any[],
  targetRows: number,
  targetCols: number,
  hasHeader: boolean,
  fillWithSample: boolean
): string[][] => {
  const expectedTotalRows = hasHeader ? targetRows + 1 : targetRows;
  const useSample = fillWithSample || !Array.isArray(sourceData) || sourceData.length === 0;

  const normalized: string[][] = [];
  for (let r = 0; r < expectedTotalRows; r++) {
    const sourceRow = Array.isArray(sourceData) ? sourceData[r] : undefined;
    const row: string[] = [];
    for (let c = 0; c < targetCols; c++) {
      if (sourceRow && sourceRow[c] !== undefined && sourceRow[c] !== null) {
        row.push(String(sourceRow[c]));
      } else if (useSample) {
        row.push(buildSampleCell(r, c, hasHeader));
      } else if (hasHeader && r === 0) {
        row.push(`Header ${c + 1}`);
      } else {
        row.push('');
      }
    }
    normalized.push(row);
  }

  return normalized;
};

const TableDataEditorModal: React.FC<TableDataEditorModalProps> = ({
  isOpen,
  rows,
  columns,
  hasHeader,
  data,
  onClose,
  onSave
}) => {
  const [draftRows, setDraftRows] = React.useState(rows);
  const [draftCols, setDraftCols] = React.useState(columns);
  const [draftData, setDraftData] = React.useState<string[][]>([]);

  React.useEffect(() => {
    if (!isOpen) return;
    const safeRows = clampNumber(rows || 1, 1, 100);
    const safeCols = clampNumber(columns || 1, 1, 20);
    setDraftRows(safeRows);
    setDraftCols(safeCols);
    setDraftData(normalizeMatrix(data, safeRows, safeCols, hasHeader, true));
  }, [isOpen, rows, columns, data, hasHeader]);

  const resizeMatrix = React.useCallback((nextRows: number, nextCols: number) => {
    setDraftData(prev => normalizeMatrix(prev, nextRows, nextCols, hasHeader, false));
  }, [hasHeader]);

  const handleRowsChange = (value: number) => {
    const next = clampNumber(value, 1, 100);
    setDraftRows(next);
    resizeMatrix(next, draftCols);
  };

  const handleColsChange = (value: number) => {
    const next = clampNumber(value, 1, 20);
    setDraftCols(next);
    resizeMatrix(draftRows, next);
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    setDraftData(prev => {
      const copy = prev.map(row => row.slice());
      copy[rowIndex][colIndex] = value;
      return copy;
    });
  };

  const handleAddRow = () => {
    const next = clampNumber(draftRows + 1, 1, 100);
    setDraftRows(next);
    setDraftData(prev => normalizeMatrix(prev, next, draftCols, hasHeader, false));
  };

  const handleRemoveRow = () => {
    if (draftRows <= 1) return;
    const next = clampNumber(draftRows - 1, 1, 100);
    setDraftRows(next);
    setDraftData(prev => normalizeMatrix(prev, next, draftCols, hasHeader, false));
  };

  const handleAddColumn = () => {
    const next = clampNumber(draftCols + 1, 1, 20);
    setDraftCols(next);
    setDraftData(prev => normalizeMatrix(prev, draftRows, next, hasHeader, false));
  };

  const handleRemoveColumn = () => {
    if (draftCols <= 1) return;
    const next = clampNumber(draftCols - 1, 1, 20);
    setDraftCols(next);
    setDraftData(prev => normalizeMatrix(prev, draftRows, next, hasHeader, false));
  };

  const handleReset = () => {
    setDraftData(normalizeMatrix([], draftRows, draftCols, hasHeader, true));
  };

  const handleApply = () => {
    const totalRows = hasHeader ? draftRows + 1 : draftRows;
    const result = draftData
      .slice(0, totalRows)
      .map(row => row.slice(0, draftCols));
    onSave({ data: result, rows: draftRows, columns: draftCols });
  };

  if (!isOpen) return null;

  const totalRows = hasHeader ? draftRows + 1 : draftRows;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-[900px] max-w-[95vw] max-h-[90vh] rounded shadow-lg flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Edit Table Data</h3>
            <p className="text-xs text-eink-gray mt-1">
              Enter text or template variables (e.g., {'{page}'}, {'{@index}'}). Header row is highlighted when enabled.
            </p>
          </div>
          <button
            type="button"
            className="px-2 py-1 text-sm border rounded"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-hidden">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center space-x-3">
              <label className="text-sm flex items-center space-x-1">
                <span className="text-eink-gray">Rows</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={draftRows}
                  onChange={(e) => handleRowsChange(parseInt(e.target.value, 10))}
                  className="input-field w-20"
                />
              </label>
              <label className="text-sm flex items-center space-x-1">
                <span className="text-eink-gray">Columns</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={draftCols}
                  onChange={(e) => handleColsChange(parseInt(e.target.value, 10))}
                  className="input-field w-20"
                />
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <button type="button" className="btn-secondary text-xs" onClick={handleAddRow}>+ Row</button>
              <button type="button" className="btn-secondary text-xs" onClick={handleRemoveRow}>− Row</button>
              <button type="button" className="btn-secondary text-xs" onClick={handleAddColumn}>+ Column</button>
              <button type="button" className="btn-secondary text-xs" onClick={handleRemoveColumn}>− Column</button>
              <button type="button" className="btn-secondary text-xs" onClick={handleReset}>Reset Sample</button>
            </div>
          </div>

          <div className="flex-1 overflow-auto border rounded">
            <table className="min-w-full text-sm border-collapse">
              <tbody>
                {draftData.slice(0, totalRows).map((row, rowIndex) => (
                  <tr key={rowIndex} className={hasHeader && rowIndex === 0 ? 'bg-eink-pale-gray/60' : ''}>
                    {row.slice(0, draftCols).map((cell, colIndex) => (
                      <td
                        key={colIndex}
                        className="border border-eink-pale-gray p-0"
                        style={{ minWidth: 80 }}
                      >
                        <input
                          type="text"
                          value={cell}
                          onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                          className="w-full px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-end space-x-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  );
};

export default TableDataEditorModal;
