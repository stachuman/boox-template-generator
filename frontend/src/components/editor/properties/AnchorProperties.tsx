/**
 * Anchor widget properties component.
 *
 * Handles anchor (destination marker) widget properties.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';

interface AnchorPropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const AnchorProperties: React.FC<AnchorPropertiesProps> = ({ widget, onUpdate }) => {
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
      <div>
        <label className="block text-sm font-medium mb-1">
          Destination ID
        </label>
        <input
          type="text"
          value={properties.dest_id || ''}
          onChange={(e) => updateProperty('dest_id', e.target.value)}
          placeholder="e.g., day:2026-01-01, notes:index"
          className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
        />
        <p className="text-xs text-eink-light-gray mt-1">
          Named destination for PDF navigation links
        </p>
      </div>
    </div>
  );
};

export default AnchorProperties;