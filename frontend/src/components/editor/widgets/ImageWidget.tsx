/**
 * Image widget rendering component.
 *
 * Handles image widget rendering on the canvas.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';

interface ImageWidgetProps {
  widget: Widget;
}

const ImageWidget: React.FC<ImageWidgetProps> = ({ widget }) => {
  // Prioritize image_data over image_src (same as backend)
  const imageData = widget.properties?.image_data;
  const imageSrc = widget.properties?.image_src;
  const src = imageData || imageSrc || '';

  const fit = widget.properties?.image_fit || 'fit';
  const objectFit = fit === 'fit' ? 'contain' : fit === 'stretch' ? 'fill' : 'none';

  // Get opacity (default 1.0 if not specified)
  const opacity = widget.properties?.opacity !== undefined ? widget.properties.opacity : 1.0;

  return (
    <div className="w-full h-full bg-white overflow-hidden">
      {src ? (
        <img
          src={src}
          alt=""
          style={
            fit === 'actual'
              ? {
                  width: 'auto',
                  height: 'auto',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  objectFit: 'none',
                  imageRendering: 'auto',
                  opacity
                }
              : {
                  width: '100%',
                  height: '100%',
                  objectFit,
                  imageRendering: 'auto',
                  opacity
                }
          }
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs text-eink-light-gray border border-dashed border-eink-pale-gray">
          No image selected
        </div>
      )}
    </div>
  );
};

export default ImageWidget;
