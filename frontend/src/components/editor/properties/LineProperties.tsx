/**
 * Line-based widget properties component.
 *
 * Handles divider, vertical_line, and lines widget properties.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import ColorPicker from './shared/ColorPicker';
import NumberInput from './shared/NumberInput';
import SelectInput from './shared/SelectInput';

interface LinePropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const LineProperties: React.FC<LinePropertiesProps> = ({ widget, onUpdate }) => {
  const properties = widget.properties || {};

  const updateProperty = (key: string, value: any) => {
    onUpdate({
      properties: {
        ...properties,
        [key]: value
      }
    });
  };

  const lineStyleOptions = [
    { value: 'solid', label: 'Solid' },
    { value: 'dotted', label: 'Dotted' },
    { value: 'dashed', label: 'Dashed' },
    { value: 'grid', label: 'Grid' }
  ];

  const lineCapOptions = [
    { value: 'butt', label: 'Butt' },
    { value: 'round', label: 'Round' }
  ];

  const isLinesWidget = widget.type === 'lines';
  const isDividerWidget = widget.type === 'divider';

  return (
    <div className="space-y-6">
      {/* Line */}
      <div>
        <h4 className="font-medium mb-3">Line</h4>
        <div className="space-y-3">
          <NumberInput
            label="Line Thickness"
            value={properties.line_thickness || (isDividerWidget ? 1 : 0.75)}
            onChange={(value) => updateProperty('line_thickness', value)}
            min={0.1}
            max={10}
            step={0.25}
            unit="pt"
          />

          <ColorPicker
            label="Stroke Color"
            value={properties.stroke_color || '#000000'}
            onChange={(value) => updateProperty('stroke_color', value)}
          />

          {(isLinesWidget || isDividerWidget) && (
            <SelectInput
              label="Line Cap"
              value={properties.line_cap || 'butt'}
              onChange={(value) => updateProperty('line_cap', value)}
              options={lineCapOptions}
            />
          )}
        </div>
      </div>

      {/* Lines Widget Specific */}
      {isLinesWidget && (
        <>
          <div>
            <h4 className="font-medium mb-3">Pattern</h4>
            <div className="space-y-3">
              <SelectInput
                label="Line Style"
                value={properties.line_style || 'solid'}
                onChange={(value) => updateProperty('line_style', value)}
                options={lineStyleOptions}
              />

              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Line Spacing"
                  value={properties.line_spacing || 20}
                  onChange={(value) => updateProperty('line_spacing', value)}
                  min={5}
                  max={100}
                  unit="pt"
                />
                <NumberInput
                  label="Line Count"
                  value={properties.line_count || 10}
                  onChange={(value) => updateProperty('line_count', value)}
                  min={1}
                  max={50}
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Spacing</h4>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Margin Left"
                  value={properties.margin_left || 0}
                  onChange={(value) => updateProperty('margin_left', value)}
                  min={0}
                  unit="pt"
                />
                <NumberInput
                  label="Margin Right"
                  value={properties.margin_right || 0}
                  onChange={(value) => updateProperty('margin_right', value)}
                  min={0}
                  unit="pt"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Margin Top"
                  value={properties.top_padding || 0}
                  onChange={(value) => updateProperty('top_padding', value)}
                  min={0}
                  unit="pt"
                />
                <NumberInput
                  label="Margin Bottom"
                  value={properties.bottom_padding || 0}
                  onChange={(value) => updateProperty('bottom_padding', value)}
                  min={0}
                  unit="pt"
                />
              </div>

              {properties.line_style === 'grid' && (
                <NumberInput
                  label="Grid Spacing"
                  value={properties.grid_spacing || 20}
                  onChange={(value) => updateProperty('grid_spacing', value)}
                  min={5}
                  max={100}
                  unit="pt"
                />
              )}

              <NumberInput
                label="Columns"
                value={properties.columns || 1}
                onChange={(value) => updateProperty('columns', value)}
                min={1}
                max={10}
                helpText="Number of equal columns for guides"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LineProperties;