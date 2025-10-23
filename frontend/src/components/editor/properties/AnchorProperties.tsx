/**
 * Anchor widget properties component.
 *
 * Handles anchor (destination marker) widget properties.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import TokenInput from './shared/TokenInput';
import { TokenRegistry } from '@/services/tokenRegistry';

interface AnchorPropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const AnchorProperties: React.FC<AnchorPropertiesProps> = ({ widget, onUpdate }) => {
  const properties = widget.properties || {};

  // Get available tokens for autocomplete and validation
  // TODO: Get section-specific counters and context from project plan
  const availableTokens = TokenRegistry.getAvailableTokens({}, {});

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
      <TokenInput
        label="Destination ID"
        value={properties.dest_id || ''}
        onChange={(value) => updateProperty('dest_id', value)}
        placeholder="e.g., day:{date}, notes:{index}"
        helpText="Named destination for PDF navigation links"
        availableTokens={availableTokens}
      />
    </div>
  );
};

export default AnchorProperties;