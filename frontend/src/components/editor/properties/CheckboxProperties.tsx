/**
 * Checkbox widget properties component.
 *
 * Handles checkbox widget-specific properties.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import NumberInput from './shared/NumberInput';

interface CheckboxPropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const CheckboxProperties: React.FC<CheckboxPropertiesProps> = ({ widget, onUpdate }) => {
  const properties = widget.properties || {};

  const updateProperty = (key: string, value: any) => {
    onUpdate({
      properties: {
        ...properties,
        [key]: value
      }
    });
  };

  return (
    <div className="space-y-3">
      <NumberInput
        label="Checkbox Size"
        value={properties.box_size ?? properties.checkbox_size ?? 12}
        onChange={(value) => updateProperty('box_size', value)}
        min={8}
        max={24}
        unit="pt"
        helpText="Size of the checkbox square"
      />
    </div>
  );
};

export default CheckboxProperties;
