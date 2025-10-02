/**
 * Link list widget properties component.
 *
 * Handles link_list widget properties (composite list of internal links).
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import NumberInput from './shared/NumberInput';
import SelectInput from './shared/SelectInput';
import ColorPicker from './shared/ColorPicker';

interface LinkListPropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const LinkListProperties: React.FC<LinkListPropertiesProps> = ({ widget, onUpdate }) => {
  const properties = widget.properties || {};

  const updateProperty = (key: string, value: any) => {
    onUpdate({
      properties: {
        ...properties,
        [key]: value
      }
    });
  };

  const orientationOptions = [
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'vertical', label: 'Vertical' }
  ];

  return (
    <div className="space-y-6">
      {/* List Structure */}
      <div>
        <h4 className="font-medium mb-3">List Structure</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Item Count"
              value={properties.count || 10}
              onChange={(value) => updateProperty('count', value)}
              min={1}
              max={100}
              helpText="Number of list items"
            />
            <NumberInput
              label="Start Index"
              value={properties.start_index || 1}
              onChange={(value) => updateProperty('start_index', value)}
              min={1}
              helpText="Starting number for items"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Index Padding"
              value={properties.index_pad || 3}
              onChange={(value) => updateProperty('index_pad', value)}
              min={1}
              max={10}
              helpText="Zero-padding for numbers (e.g., 001, 002)"
            />
            <NumberInput
              label="Columns"
              value={properties.columns || 2}
              onChange={(value) => updateProperty('columns', value)}
              min={1}
              max={10}
              helpText="Number of columns in layout"
            />
          </div>
        </div>
      </div>

      {/* Layout & Spacing */}
      <div>
        <h4 className="font-medium mb-3">Layout & Spacing</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Vertical Gap"
              value={properties.gap_y || 6}
              onChange={(value) => updateProperty('gap_y', value)}
              min={0}
              max={50}
              unit="pt"
              helpText="Space between rows"
            />
            <NumberInput
              label="Item Height"
              value={properties.item_height || 24}
              onChange={(value) => updateProperty('item_height', value)}
              min={12}
              max={100}
              unit="pt"
              helpText="Height of each list item"
            />
          </div>

          <SelectInput
            label="Orientation"
            value={properties.orientation || 'horizontal'}
            onChange={(value) => updateProperty('orientation', value)}
            options={orientationOptions}
            helpText="Text direction for list items"
          />
        </div>
      </div>

      {/* Content Templates */}
      <div>
        <h4 className="font-medium mb-3">Content Templates</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              Label Template
            </label>
            <input
              type="text"
              value={properties.label_template || 'Note {index_padded}'}
              onChange={(e) => updateProperty('label_template', e.target.value)}
              placeholder="e.g., Note {index_padded}, Day {index}"
              className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
            />
            <p className="text-xs text-eink-light-gray mt-1">
              Use {'{index}'} or {'{index_padded}'} tokens
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Link Template
            </label>
            <input
              type="text"
              value={properties.bind || 'notes(@index)'}
              onChange={(e) => updateProperty('bind', e.target.value)}
              placeholder="e.g., notes(@index), month(@year-@index_padded)"
              className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
            />
            <p className="text-xs text-eink-light-gray mt-1">
              Destination pattern using @index, @index_padded, @year tokens
            </p>
          </div>

          {/* Destination Preview */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Destination Preview
            </label>
            <div className="bg-eink-off-white rounded border p-3 text-xs space-y-1">
              {(() => {
                const bindExpr = properties.bind || 'notes(@index)';
                const count = Math.min(5, Math.max(1, properties.count || 10)); // Show max 5 examples
                const startIndex = properties.start_index || 1;
                const indexPad = properties.index_pad || 3;
                const previews = [];

                for (let i = 0; i < count; i++) {
                  const idx = startIndex + i;
                  const idxPadded = String(idx).padStart(indexPad, '0');

                  // Handle both numeric and token highlighting
                  let isHighlighted = false;
                  if (properties.highlight_index) {
                    const highlightValue = properties.highlight_index;
                    if (typeof highlightValue === 'number') {
                      isHighlighted = idx === highlightValue;
                    } else if (typeof highlightValue === 'string') {
                      // For string tokens, try parsing as number first
                      const numValue = parseInt(highlightValue);
                      if (!isNaN(numValue)) {
                        isHighlighted = idx === numValue;
                      } else {
                        // For tokens like {page}, show a preview indicator
                        isHighlighted = i === 0; // Highlight first item as example for tokens
                      }
                    }
                  }

                  // Simple preview generation (basic token replacement)
                  let preview = bindExpr
                    .replace(/@index_padded/g, idxPadded)
                    .replace(/@index/g, String(idx))
                    .replace(/@year/g, '2025'); // Example year

                  const highlightIndicator = isHighlighted ? (
                    typeof properties.highlight_index === 'string' && isNaN(parseInt(properties.highlight_index))
                      ? ` ★ (${properties.highlight_index} example)`
                      : ' ★'
                  ) : '';

                  previews.push(
                    <div key={i} className={`text-eink-gray ${isHighlighted ? 'font-semibold' : ''}`}>
                      Item {idx}{highlightIndicator}: <span className={`font-mono ${isHighlighted ? 'text-blue-800' : 'text-blue-600'}`}>{preview}</span>
                    </div>
                  );
                }

                return previews.length > 0 ? previews : (
                  <div className="text-eink-light-gray italic">No preview available</div>
                );
              })()}
              {properties.count > 5 && (
                <div className="text-eink-light-gray italic pt-1 border-t">
                  ... and {properties.count - 5} more items
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Highlight & Colors */}
      <div>
        <h4 className="font-medium mb-3">Highlight & Colors</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              Index or token
            </label>
            <input
              type="text"
              value={properties.highlight_index || ''}
              onChange={(e) => updateProperty('highlight_index', e.target.value || null)}
              placeholder="e.g., 3, {page}, {month}"
              className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
            />
            <p className="text-xs text-eink-light-gray mt-1">
              Index or token to highlight (number, {'{page}'}, {'{month}'}, etc.)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ColorPicker
              label="Highlight Color"
              value={properties.highlight_color || '#dbeafe'}
              onChange={(value) => updateProperty('highlight_color', value)}
              helpText="Background color for highlighted item"
            />
            <ColorPicker
              label="Background Color"
              value={properties.background_color || 'transparent'}
              onChange={(value) => updateProperty('background_color', value)}
              helpText="Background color for all items"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkListProperties;