/**
 * Link list widget properties component.
 *
 * Handles link_list widget properties using explicit labels and destinations arrays.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useState } from 'react';
import { Widget } from '@/types';
import NumberInput from './shared/NumberInput';
import SelectInput from './shared/SelectInput';
import ColorPicker from './shared/ColorPicker';
import { Edit3 } from 'lucide-react';
import LinkListEditorModal from '../LinkListEditorModal';
import { normalizeOrientation } from '../widgets/textUtils';

interface LinkListPropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const LinkListProperties: React.FC<LinkListPropertiesProps> = ({ widget, onUpdate }) => {
  const properties = widget.properties || {};
  const labels = Array.isArray(properties.labels) ? properties.labels : [];
  const destinations = Array.isArray(properties.destinations) ? properties.destinations : [];
  const [isEditingContent, setIsEditingContent] = useState(false);

  const updateProperty = (key: string, value: any) => {
    onUpdate({
      properties: {
        ...properties,
        [key]: value
      }
    });
  };

  const handleSaveLinks = (newLabels: string[], newDestinations: string[]) => {
    onUpdate({
      properties: {
        ...properties,
        labels: newLabels,
        destinations: newDestinations
      }
    });
    setIsEditingContent(false);
  };

  const orientationOptions = [
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'vertical_cw', label: 'Vertical ↻ (+90°)' },
    { value: 'vertical_ccw', label: 'Vertical ↺ (-90°)' }
  ];

  return (
    <div className="space-y-6">
      {/* Links */}
      <div>
        <h4 className="font-medium mb-3">Links</h4>
        <button
          onClick={() => setIsEditingContent(true)}
          className="w-full px-4 py-3 border-2 border-eink-blue text-eink-blue rounded-lg hover:bg-eink-blue hover:text-white transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <Edit3 size={18} />
          Edit Links ({labels.length} item{labels.length !== 1 ? 's' : ''})
        </button>

        {labels.length !== destinations.length && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded p-2 text-sm text-red-800">
            ⚠️ Warning: {labels.length} labels but {destinations.length} destinations (must match!)
          </div>
        )}

        {labels.length === 0 && (
          <p className="mt-2 text-sm text-gray-500 italic">
            No links defined. Click "Edit Links" to add labels and destinations.
          </p>
        )}

        {labels.length > 0 && labels.length === destinations.length && (
          <div className="mt-2 bg-blue-50 border border-blue-200 rounded p-2 text-xs">
            <strong>Preview:</strong>
            <ul className="mt-1 space-y-1">
              {labels.slice(0, 3).map((label: string, index: number) => (
                <li key={index} className="font-mono">
                  "{label}" → {destinations[index]}
                </li>
              ))}
              {labels.length > 3 && (
                <li className="text-gray-500 italic">
                  ... and {labels.length - 3} more
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Layout */}
      <div>
        <h4 className="font-medium mb-3">Layout</h4>
        <div className="space-y-3">
          <SelectInput
            label="Orientation"
            value={normalizeOrientation(properties.orientation)}
            onChange={(value) => updateProperty('orientation', value)}
            options={orientationOptions}
            helpText="Text direction"
          />

          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Columns"
              value={properties.columns || 1}
              onChange={(value) => updateProperty('columns', value)}
              min={1}
              max={25}
            />
            <NumberInput
              label="Item Height"
              value={properties.item_height || 24}
              onChange={(value) => updateProperty('item_height', value)}
              min={12}
              max={100}
              unit="pt"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Gap X"
              value={properties.gap_x || 0}
              onChange={(value) => updateProperty('gap_x', value)}
              min={0}
              max={50}
              unit="pt"
              helpText="Space between columns"
            />
            <NumberInput
              label="Gap Y"
              value={properties.gap_y || 6}
              onChange={(value) => updateProperty('gap_y', value)}
              min={0}
              max={50}
              unit="pt"
              helpText="Space between rows"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Highlight Index
            </label>
            <input
              type="text"
              value={properties.highlight_index || ''}
              onChange={(e) => updateProperty('highlight_index', e.target.value || null)}
              placeholder="e.g., {month}, {index}, or 3"
              className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
            />
            <p className="text-xs text-eink-light-gray mt-1">
              Token like <code className="bg-eink-off-white px-1">{'{month}'}</code> or number (1-{labels.length || 1})
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ColorPicker
              label="Highlight Color"
              value={properties.highlight_color || '#dbeafe'}
              onChange={(value) => updateProperty('highlight_color', value)}
            />
            <ColorPicker
              label="Background"
              value={properties.background_color || 'transparent'}
              onChange={(value) => updateProperty('background_color', value)}
            />
          </div>
        </div>
      </div>

      {/* Modal */}
      <LinkListEditorModal
        isOpen={isEditingContent}
        labels={labels}
        destinations={destinations}
        onClose={() => setIsEditingContent(false)}
        onSave={handleSaveLinks}
      />
    </div>
  );
};

export default LinkListProperties;
