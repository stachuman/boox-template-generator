/**
 * Box widget properties component.
 *
 * Handles box (rectangle) widget properties.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import ColorPicker from './shared/ColorPicker';
import NumberInput from './shared/NumberInput';

interface BoxPropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const BoxProperties: React.FC<BoxPropertiesProps> = ({ widget, onUpdate }) => {
  const properties = widget.properties || {};
  const styling = widget.styling || {};

  const updateProperty = (key: string, value: any) => {
    onUpdate({
      properties: {
        ...properties,
        [key]: value
      }
    });
  };

  const updateStyling = (key: string, value: any) => {
    onUpdate({
      styling: {
        ...styling,
        [key]: value
      }
    });
  };

  return (
    <div className="space-y-3">
      <ColorPicker
        label="Fill Color"
        value={styling.fill_color ?? properties.fill_color ?? '#FFFFFF'}
        onChange={(value) => updateStyling('fill_color', value)}
        helpText="Interior color of the box"
      />

      <ColorPicker
        label="Stroke Color"
        value={styling.stroke_color ?? properties.stroke_color ?? '#000000'}
        onChange={(value) => updateStyling('stroke_color', value)}
        helpText="Border color of the box"
      />

      <NumberInput
        label="Stroke Width"
        value={styling.line_width ?? properties.stroke_width ?? 1}
        onChange={(value) => updateStyling('line_width', value)}
        min={0}
        max={20}
        step={0.5}
        unit="pt"
        helpText="Border thickness"
      />

      <NumberInput
        label="Corner Radius"
        value={properties.corner_radius || 0}
        onChange={(value) => updateProperty('corner_radius', value)}
        min={0}
        max={50}
        unit="pt"
        helpText="Rounded corner radius"
      />

      <NumberInput
        label="Opacity"
        value={properties.opacity || 1.0}
        onChange={(value) => updateProperty('opacity', value)}
        min={0}
        max={1}
        step={0.1}
        helpText="Box transparency (0=transparent, 1=opaque)"
      />
    </div>
  );
};

export default BoxProperties;
