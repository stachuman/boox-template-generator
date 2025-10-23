/**
 * Internal link widget properties component.
 *
 * Handles internal_link widget properties.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import SelectInput from './shared/SelectInput';
import TokenInput from './shared/TokenInput';
import { normalizeOrientation } from '../widgets/textUtils';
import { TokenRegistry } from '@/services/tokenRegistry';

interface LinkPropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const LinkProperties: React.FC<LinkPropertiesProps> = ({ widget, onUpdate }) => {
  const properties = widget.properties || {};

  // Get available tokens for autocomplete and validation
  // TODO: Get section-specific counters and context from project plan
  // For now, provide base tokens (will be enhanced when section context is available)
  const availableTokens = TokenRegistry.getAvailableTokens({}, {});

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

      <TokenInput
        label="Target Destination"
        value={properties.to_dest || ''}
        onChange={(value) => updateProperty('to_dest', value)}
        placeholder="e.g., day:{date_next}, month:{month}"
        helpText="Destination ID or pattern using {tokens}"
        availableTokens={availableTokens}
      />

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
