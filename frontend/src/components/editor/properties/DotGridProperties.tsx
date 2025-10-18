/**
 * Dot grid widget properties component.
 *
 * Handles property editing for dot_grid widgets.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import ColorPicker from './shared/ColorPicker';
import NumberInput from './shared/NumberInput';
import SelectInput from './shared/SelectInput';

interface DotGridPropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const DotGridProperties: React.FC<DotGridPropertiesProps> = ({ widget, onUpdate }) => {
  const properties = widget.properties || {};

  const updateProperty = (key: string, value: any) => {
    onUpdate({
      properties: {
        ...properties,
        [key]: value
      }
    });
  };

  const dotShapeOptions = [
    { value: 'round', label: 'Round' },
    { value: 'square', label: 'Square' }
  ];

  return (
    <div className="space-y-6">
      {/* Grid Configuration */}
      <div>
        <h4 className="font-medium mb-3">Grid Configuration</h4>
        <div className="space-y-3">
          <NumberInput
            label="Grid Cell Size"
            value={properties.grid_cell_size || 10}
            onChange={(value) => updateProperty('grid_cell_size', value)}
            min={5}
            max={100}
            step={1}
            unit="pt"
            helpText="Distance between dots"
          />

          <NumberInput
            label="Dot Size"
            value={properties.dot_size || 1.5}
            onChange={(value) => updateProperty('dot_size', value)}
            min={0.5}
            max={10}
            step={0.5}
            unit="pt"
            helpText="Diameter or width of each dot"
          />

          <SelectInput
            label="Dot Shape"
            value={properties.dot_shape || 'round'}
            onChange={(value) => updateProperty('dot_shape', value)}
            options={dotShapeOptions}
          />

          <ColorPicker
            label="Dot Color"
            value={properties.dot_color || '#CCCCCC'}
            onChange={(value) => updateProperty('dot_color', value)}
          />
        </div>
      </div>

      {/* Margins */}
      <div>
        <h4 className="font-medium mb-3">Margins</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Left Margin"
              value={properties.margin_left || 0}
              onChange={(value) => updateProperty('margin_left', value)}
              min={0}
              max={200}
              unit="pt"
            />
            <NumberInput
              label="Right Margin"
              value={properties.margin_right || 0}
              onChange={(value) => updateProperty('margin_right', value)}
              min={0}
              max={200}
              unit="pt"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Top Margin"
              value={properties.margin_top || 0}
              onChange={(value) => updateProperty('margin_top', value)}
              min={0}
              max={200}
              unit="pt"
            />
            <NumberInput
              label="Bottom Margin"
              value={properties.margin_bottom || 0}
              onChange={(value) => updateProperty('margin_bottom', value)}
              min={0}
              max={200}
              unit="pt"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DotGridProperties;
