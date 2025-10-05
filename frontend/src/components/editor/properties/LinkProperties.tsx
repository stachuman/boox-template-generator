/**
 * Internal link widget properties component.
 *
 * Handles internal_link widget properties.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import SelectInput from './shared/SelectInput';
import { normalizeOrientation } from '../widgets/textUtils';

interface LinkPropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const LinkProperties: React.FC<LinkPropertiesProps> = ({ widget, onUpdate }) => {
  const properties = widget.properties || {};

  const updateProperty = (key: string, value: any) => {
    onUpdate({
      properties: {
        ...properties,
        [key]: value
      }
    });
  };

  const updateContent = (value: string) => {
    onUpdate({ content: value });
  };

  const orientationOptions = [
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'vertical_cw', label: 'Vertical ↻ (+90°)' },
    { value: 'vertical_ccw', label: 'Vertical ↺ (-90°)' }
  ];

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">
          Link Text
        </label>
        <input
          type="text"
          value={widget.content || ''}
          onChange={(e) => updateContent(e.target.value)}
          placeholder="e.g., Next Day →, ← Previous"
          className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
        />
        <p className="text-xs text-eink-light-gray mt-1">
          Text that will be displayed and clickable
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Target Destination
        </label>
        <input
          type="text"
          value={properties.to_dest || ''}
          onChange={(e) => updateProperty('to_dest', e.target.value)}
          placeholder="e.g., day({date} + 1 day), notes({index})"
          className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
        />
        <p className="text-xs text-eink-light-gray mt-1">
          Link template using {'{variables}'} and date math
        </p>
      </div>

      <SelectInput
        label="Orientation"
        value={normalizeOrientation(properties.orientation)}
        onChange={(value) => updateProperty('orientation', value)}
        options={orientationOptions}
        helpText="Text direction on the page"
      />
    </div>
  );
};

export default LinkProperties;
