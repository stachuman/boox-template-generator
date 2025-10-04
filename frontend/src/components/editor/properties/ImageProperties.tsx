/**
 * Image widget properties component.
 *
 * Handles image widget properties with URL input.
 * File upload temporarily disabled during multi-user migration.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import SelectInput from './shared/SelectInput';
import NumberInput from './shared/NumberInput';
import CheckboxInput from './shared/CheckboxInput';
import { AlertCircle } from 'lucide-react';

interface ImagePropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const ImageProperties: React.FC<ImagePropertiesProps> = ({ widget, onUpdate }) => {
  const properties = widget.properties || {};

  const updateProperty = (key: string, value: any) => {
    onUpdate({
      properties: {
        ...properties,
        [key]: value
      }
    });
  };

  const imageFitOptions = [
    { value: 'fit', label: 'Fit (maintain aspect ratio)' },
    { value: 'stretch', label: 'Stretch (fill area)' },
    { value: 'actual', label: 'Actual Size' }
  ];

  return (
    <div className="space-y-6">
      {/* Image Source */}
      <div>
        <h4 className="font-medium mb-3">Image Source</h4>
        <div className="space-y-3">
          {/* File Upload - TEMPORARILY DISABLED */}
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-yellow-800 font-medium">Image Upload Temporarily Disabled</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Image file uploads are currently disabled during multi-user system migration. Please use image URLs instead.
                </p>
              </div>
            </div>
          </div>

          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Image URL
            </label>
            <input
              type="text"
              value={properties.image_src || ''}
              onChange={(e) => {
                updateProperty('image_src', e.target.value);
                if (e.target.value) {
                  // Clear image_data when entering URL
                  updateProperty('image_data', undefined);
                }
              }}
              placeholder="https://example.com/image.png"
              className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
            />
            <p className="text-xs text-eink-light-gray mt-1">
              Direct URL to PNG, JPEG, or SVG image
            </p>
          </div>

          <SelectInput
            label="Image Fit"
            value={properties.image_fit || 'fit'}
            onChange={(value) => updateProperty('image_fit', value)}
            options={imageFitOptions}
            helpText="How image should be sized within the widget area"
          />

          <CheckboxInput
            label="Convert to Grayscale in PDF"
            checked={properties.convert_to_grayscale || false}
            onChange={(checked) => updateProperty('convert_to_grayscale', checked)}
            helpText="Render image as grayscale in PDF output (useful for e-ink)"
          />
        </div>
      </div>

      {/* Optimization */}
      <div>
        <h4 className="font-medium mb-3">Image Optimization</h4>
        <div className="space-y-3">
          <CheckboxInput
            label="Optimize on Import"
            checked={properties.optimize_on_import || false}
            onChange={(checked) => updateProperty('optimize_on_import', checked)}
            helpText="Automatically downscale and compress large images"
          />

          {properties.optimize_on_import && (
            <>
              <NumberInput
                label="Max Image Size"
                value={properties.max_image_px || 1200}
                onChange={(value) => updateProperty('max_image_px', value)}
                min={100}
                max={4000}
                unit="px"
                helpText="Maximum width or height in pixels"
              />

              <CheckboxInput
                label="Convert to Grayscale"
                checked={properties.grayscale_on_import || false}
                onChange={(checked) => updateProperty('grayscale_on_import', checked)}
                helpText="Convert color images to grayscale for e-ink"
              />

              <NumberInput
                label="JPEG Quality"
                value={properties.image_quality || 0.8}
                onChange={(value) => updateProperty('image_quality', value)}
                min={0.1}
                max={1.0}
                step={0.1}
                helpText="Compression quality (0.1=low, 1.0=high)"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageProperties;