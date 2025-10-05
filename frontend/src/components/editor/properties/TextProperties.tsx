/**
 * Text widget properties component.
 *
 * Handles text_block and related text widget properties.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import SelectInput from './shared/SelectInput';
import CheckboxInput from './shared/CheckboxInput';
import { normalizeOrientation } from '../widgets/textUtils';

interface TextPropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const TextProperties: React.FC<TextPropertiesProps> = ({ widget, onUpdate }) => {
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
    { value: 'vertical_cw', label: 'Vertical ↻ (+90°)' },
    { value: 'vertical_ccw', label: 'Vertical ↺ (-90°)' }
  ];

  return (
    <div className="space-y-3">
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

export default TextProperties;
