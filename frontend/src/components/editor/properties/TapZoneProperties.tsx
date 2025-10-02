/**
 * Tap zone widget properties component.
 *
 * Handles tap_zone widget properties.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import SelectInput from './shared/SelectInput';
import NumberInput from './shared/NumberInput';
import CheckboxInput from './shared/CheckboxInput';

interface TapZonePropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const TapZoneProperties: React.FC<TapZonePropertiesProps> = ({ widget, onUpdate }) => {
  const properties = widget.properties || {};

  const updateProperty = (key: string, value: any) => {
    onUpdate({
      properties: {
        ...properties,
        [key]: value
      }
    });
  };

  const tapActionOptions = [
    { value: 'page_link', label: 'Go to Page' },
    { value: 'prev_page', label: 'Previous Page' },
    { value: 'next_page', label: 'Next Page' }
  ];

  const showTargetPage = properties.tap_action === 'page_link';

  return (
    <div className="space-y-3">
      <SelectInput
        label="Tap Action"
        value={properties.tap_action || 'page_link'}
        onChange={(value) => updateProperty('tap_action', value)}
        options={tapActionOptions}
        helpText="What happens when this area is tapped"
      />

      {showTargetPage && (
        <NumberInput
          label="Target Page"
          value={properties.target_page || 2}
          onChange={(value) => updateProperty('target_page', value)}
          min={1}
          helpText="Page number to navigate to"
        />
      )}

      <CheckboxInput
        label="Show Outline (Editor Only)"
        checked={properties.outline !== false}
        onChange={(checked) => updateProperty('outline', checked)}
        helpText="Visual aid in editor - invisible in PDF"
      />
    </div>
  );
};

export default TapZoneProperties;