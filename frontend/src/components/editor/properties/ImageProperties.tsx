/**
 * Image widget properties component.
 *
 * Handles image widget properties with file upload and URL input.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useState, useRef } from 'react';
import { Widget } from '@/types';
import SelectInput from './shared/SelectInput';
import NumberInput from './shared/NumberInput';
import CheckboxInput from './shared/CheckboxInput';
import { Upload, X, AlertCircle } from 'lucide-react';

interface ImagePropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const MAX_IMAGE_SIZE = 0.5 * 1024 * 1024; // 0.5MB in bytes
const SUPPORTED_FORMATS = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];

const ImageProperties: React.FC<ImagePropertiesProps> = ({ widget, onUpdate }) => {
  const properties = widget.properties || {};
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateProperty = (key: string, value: any) => {
    onUpdate({
      properties: {
        ...properties,
        [key]: value
      }
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);

    try {
      // Validate file type
      if (!SUPPORTED_FORMATS.includes(file.type)) {
        throw new Error(`Unsupported file type. Please use PNG, JPEG, or SVG.`);
      }

      // Validate file size (0.5MB limit)
      if (file.size > MAX_IMAGE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        throw new Error(`Image too large (${sizeMB}MB). Maximum size is 0.5MB. Please compress or resize the image.`);
      }

      // Read file and convert to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target?.result as string;

        // Store in image_data property, clear image_src
        onUpdate({
          properties: {
            ...properties,
            image_data: base64Data,
            image_src: '' // Clear URL when uploading file
          }
        });

        setIsUploading(false);
      };

      reader.onerror = () => {
        throw new Error('Failed to read file');
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
      setIsUploading(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    onUpdate({
      properties: {
        ...properties,
        image_data: undefined,
        image_src: ''
      }
    });
    setError(null);
  };

  const hasImage = !!(properties.image_data || properties.image_src);

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
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Upload Image File
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Upload size={16} />
                {isUploading ? 'Uploading...' : 'Choose File'}
              </button>
              {hasImage && (
                <button
                  onClick={handleRemoveImage}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Remove image"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <p className="text-xs text-eink-light-gray mt-1">
              PNG, JPEG, SVG • Max 0.5MB
            </p>
            {properties.image_data && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Image uploaded ({(properties.image_data.length / 1024).toFixed(1)}KB)
              </p>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* URL Input (Alternative) */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 bg-white text-xs text-gray-500">OR</span>
            </div>
          </div>

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