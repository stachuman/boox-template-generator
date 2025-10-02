/**
 * Refactored Properties panel with modular widget-specific components.
 *
 * This is the new modular version that will replace the original PropertiesPanel.tsx
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { Widget } from '@/types';
import BasePropertyPanel from './properties/BasePropertyPanel';
import TableProperties from './properties/TableProperties';
import TextProperties from './properties/TextProperties';
import CheckboxProperties from './properties/CheckboxProperties';
import LineProperties from './properties/LineProperties';
import AnchorProperties from './properties/AnchorProperties';
import LinkProperties from './properties/LinkProperties';
import TapZoneProperties from './properties/TapZoneProperties';
import BoxProperties from './properties/BoxProperties';
import ImageProperties from './properties/ImageProperties';
import CalendarProperties from './properties/CalendarProperties';
import LinkListProperties from './properties/LinkListProperties';

const PropertiesPanel: React.FC = () => {
  const {
    selectedWidget,
    updateWidget,
    removeWidget,
    setSelectedWidget
  } = useEditorStore() as any;

  // Font options loaded from backend assets
  const [fontOptions, setFontOptions] = React.useState<string[]>([
    'Helvetica', 'Times-Roman', 'Courier'
  ]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await fetch('/api/assets/fonts');
        if (!response.ok) {
          console.warn('Failed to load font list from backend, using fallback fonts');
          return;
        }
        const fonts = await response.json();
        if (mounted && Array.isArray(fonts)) {
          setFontOptions(fonts);
        }
      } catch (error) {
        console.warn('Error loading fonts:', error);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (!selectedWidget) {
    return (
      <div className="h-full flex items-center justify-center text-eink-gray">
        <p>Select a widget to edit its properties</p>
      </div>
    );
  }

  const handleUpdate = (updates: Partial<Widget>) => {
    updateWidget(selectedWidget.id, updates);
  };

  const handleRemove = () => {
    removeWidget(selectedWidget.id);
    setSelectedWidget(null);
  };

  const renderWidgetSpecificProperties = () => {
    switch (selectedWidget.type) {
      case 'table':
        return (
          <TableProperties
            widget={selectedWidget}
            onUpdate={handleUpdate}
          />
        );

      case 'text_block':
        return (
          <TextProperties
            widget={selectedWidget}
            onUpdate={handleUpdate}
          />
        );

      case 'checkbox':
        return (
          <CheckboxProperties
            widget={selectedWidget}
            onUpdate={handleUpdate}
          />
        );

      case 'divider':
      case 'vertical_line':
      case 'lines':
        return (
          <LineProperties
            widget={selectedWidget}
            onUpdate={handleUpdate}
          />
        );

      case 'anchor':
        return (
          <AnchorProperties
            widget={selectedWidget}
            onUpdate={handleUpdate}
          />
        );

      case 'internal_link':
        return (
          <LinkProperties
            widget={selectedWidget}
            onUpdate={handleUpdate}
          />
        );

      case 'tap_zone':
        return (
          <TapZoneProperties
            widget={selectedWidget}
            onUpdate={handleUpdate}
          />
        );

      case 'box':
        return (
          <BoxProperties
            widget={selectedWidget}
            onUpdate={handleUpdate}
          />
        );

      case 'image':
        return (
          <ImageProperties
            widget={selectedWidget}
            onUpdate={handleUpdate}
          />
        );

      case 'calendar':
        return (
          <CalendarProperties
            widget={selectedWidget}
            onUpdate={handleUpdate}
          />
        );

      case 'link_list':
        return (
          <LinkListProperties
            widget={selectedWidget}
            onUpdate={handleUpdate}
          />
        );

      default:
        return null;
    }
  };

  return (
    <BasePropertyPanel
      widget={selectedWidget}
      onUpdate={handleUpdate}
      onRemove={handleRemove}
      fontOptions={fontOptions}
    >
      {renderWidgetSpecificProperties()}
    </BasePropertyPanel>
  );
};

export default PropertiesPanel;