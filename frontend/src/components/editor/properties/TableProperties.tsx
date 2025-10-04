/**
 * Table widget properties component.
 *
 * Handles all table-specific property editing including structure, styling, and colors.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useState } from 'react';
import { Widget } from '@/types';
import ColorPicker from './shared/ColorPicker';
import NumberInput from './shared/NumberInput';
import SelectInput from './shared/SelectInput';
import CheckboxInput from './shared/CheckboxInput';
import { Edit3 } from 'lucide-react';

interface TablePropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const TableProperties: React.FC<TablePropertiesProps> = ({ widget, onUpdate }) => {
  const properties = widget.properties || {};
  const [isEditingContent, setIsEditingContent] = useState(false);

  // Helper to generate table data structure
  const generateTableData = (rows: number, columns: number, hasHeader: boolean, existingData?: any[][]) => {
    const totalRows = rows + (hasHeader ? 1 : 0);
    const newData = [];

    for (let r = 0; r < totalRows; r++) {
      const row = [];
      for (let c = 0; c < columns; c++) {
        // Preserve existing data if available
        if (existingData && existingData[r] && existingData[r][c] !== undefined) {
          row.push(existingData[r][c]);
        } else {
          
          row.push(``);
        }
      }
      newData.push(row);
    }
    return newData;
  };

  const [tableData, setTableData] = useState(() => {
    // Initialize table data from widget or create default
    const rows = properties.rows || 4;
    const columns = properties.columns || 3;
    const hasHeader = properties.has_header !== false;

    if (properties.table_data && Array.isArray(properties.table_data)) {
      // Regenerate to match current dimensions, preserving existing content
      return generateTableData(rows, columns, hasHeader, properties.table_data);
    }

    return generateTableData(rows, columns, hasHeader);
  });

  const updateProperty = (key: string, value: any) => {
    onUpdate({
      properties: {
        ...properties,
        [key]: value
      }
    });

    // Update tableData dimensions when rows/columns/has_header changes
    if (key === 'rows' || key === 'columns' || key === 'has_header') {
      const rows = key === 'rows' ? value : (properties.rows || 4);
      const columns = key === 'columns' ? value : (properties.columns || 3);
      const hasHeader = key === 'has_header' ? value : (properties.has_header !== false);

      // Regenerate table data with new dimensions, preserving existing content
      const newTableData = generateTableData(rows, columns, hasHeader, tableData);
      setTableData(newTableData);

      // Also update the stored table_data
      onUpdate({
        properties: {
          ...properties,
          [key]: value,
          table_data: newTableData
        }
      });
    }
  };

  const handleSaveTableData = () => {
    updateProperty('table_data', tableData);
    setIsEditingContent(false);
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newData = [...tableData];
    newData[rowIndex] = [...newData[rowIndex]];
    newData[rowIndex][colIndex] = value;
    setTableData(newData);
  };

  const borderStyleOptions = [
    { value: 'none', label: 'None' },
    { value: 'outer', label: 'Outer Only' },
    { value: 'all', label: 'All Borders' },
    { value: 'horizontal', label: 'Horizontal Only' },
    { value: 'vertical', label: 'Vertical Only' }
  ];

  const textAlignOptions = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' }
  ];

  return (
    <div className="space-y-6">
      {/* Table Structure */}
      <div>
        <h4 className="font-medium mb-3">Table Structure</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Rows"
              value={properties.rows || 4}
              onChange={(value) => updateProperty('rows', value)}
              min={1}
              max={100}
              helpText="Number of data rows"
            />
            <NumberInput
              label="Columns"
              value={properties.columns || 3}
              onChange={(value) => updateProperty('columns', value)}
              min={1}
              max={100}
              helpText="Number of columns"
            />
          </div>

          <CheckboxInput
            label="Has Header Row"
            checked={properties.has_header !== false}
            onChange={(checked) => updateProperty('has_header', checked)}
            helpText="Whether first row is a header"
          />

          <button
            onClick={() => setIsEditingContent(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Edit3 size={16} />
            Edit Table Content
          </button>
          <p className="text-xs text-eink-light-gray">
            Tokens like {'{test1}'}, {'{page}'}, {'{date}'} are automatically processed
          </p>
        </div>
      </div>

      {/* Table Styling */}
      <div>
        <h4 className="font-medium mb-3">Table Styling</h4>
        <div className="space-y-3">
          <SelectInput
            label="Border Style"
            value={properties.border_style || 'all'}
            onChange={(value) => updateProperty('border_style', value)}
            options={borderStyleOptions}
          />

          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Cell Padding"
              value={properties.cell_padding || 4}
              onChange={(value) => updateProperty('cell_padding', value)}
              min={0}
              max={20}
              unit="pt"
            />
            <NumberInput
              label="Row Height"
              value={properties.row_height || 24}
              onChange={(value) => updateProperty('row_height', value)}
              min={12}
              max={100}
              unit="pt"
            />
          </div>

          <SelectInput
            label="Text Alignment"
            value={properties.text_align || 'left'}
            onChange={(value) => updateProperty('text_align', value)}
            options={textAlignOptions}
          />

          <div className="grid grid-cols-2 gap-3">
            <CheckboxInput
              label="Text Wrap"
              checked={properties.text_wrap !== false}
              onChange={(checked) => updateProperty('text_wrap', checked)}
            />
            <NumberInput
              label="Max Lines"
              value={properties.max_lines || 2}
              onChange={(value) => updateProperty('max_lines', value)}
              min={1}
              max={10}
            />
          </div>
        </div>
      </div>

      {/* Header & Row Colors */}
      <div>
        <h4 className="font-medium mb-3">Header & Row Colors</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ColorPicker
              label="Header Background"
              value={properties.header_background || '#F0F0F0'}
              onChange={(value) => updateProperty('header_background', value)}
            />
            <ColorPicker
              label="Header Text"
              value={properties.header_color || '#000000'}
              onChange={(value) => updateProperty('header_color', value)}
            />
          </div>

          <CheckboxInput
            label="Zebra Rows"
            checked={properties.zebra_rows || false}
            onChange={(checked) => updateProperty('zebra_rows', checked)}
            helpText=""
          />

          {properties.zebra_rows && (
            <div className="grid grid-cols-2 gap-3">
              <ColorPicker
                label="Even Row Background"
                value={properties.even_row_bg || '#FFFFFF'}
                onChange={(value) => updateProperty('even_row_bg', value)}
              />
              <ColorPicker
                label="Odd Row Background"
                value={properties.odd_row_bg || '#F8F8F8'}
                onChange={(value) => updateProperty('odd_row_bg', value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Interactivity */}
      <div>
        <h4 className="font-medium mb-3">Interactivity (PDF Links)</h4>
        <div className="space-y-3">
          <CheckboxInput
            label="Enable Cell Links"
            checked={properties.cell_links || false}
            onChange={(checked) => updateProperty('cell_links', checked)}
            helpText="Make table cells clickable links in PDF"
          />

          {properties.cell_links && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Link Template
                </label>
                <input
                  type="text"
                  value={properties.link_template || ''}
                  onChange={(e) => updateProperty('link_template', e.target.value)}
                  placeholder="e.g., page:{row}, notes:{value}"
                  className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
                />
                <p className="text-xs text-eink-light-gray mt-1">
                  Use {'{row}'}, {'{col}'}, {'{value}'} tokens
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Link Columns (comma-separated)
                </label>
                <input
                  type="text"
                  value={properties.link_columns?.join(',') || ''}
                  onChange={(e) => {
                    const cols = e.target.value.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c));
                    updateProperty('link_columns', cols);
                  }}
                  placeholder="e.g., 1,3,5"
                  className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
                />
                <p className="text-xs text-eink-light-gray mt-1">
                  Which columns should be clickable (1-based)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table Content Editor Modal */}
      {isEditingContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Table Content</h3>
              <button
                onClick={() => setIsEditingContent(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                You can use tokens like <code className="bg-gray-100 px-1 rounded">{'{page}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{date}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{year}'}</code> in cells for dynamic content.
              </p>
              <div className="overflow-auto border rounded">
                <table className="w-full border-collapse">
                  <tbody>
                    {tableData.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, colIndex) => (
                          <td key={colIndex} className="border p-1">
                            <input
                              type="text"
                              value={cell}
                              onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                              className="w-full px-2 py-1 text-sm border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                              placeholder={`Cell ${rowIndex + 1}-${colIndex + 1}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditingContent(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTableData}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableProperties;