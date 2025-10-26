/**
 * Widget component registry.
 *
 * Central registry for all widget rendering components.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';

// Import all widget components
import TableWidget from './TableWidget';
import CalendarWidget from './CalendarWidget';
import DayListWidget from './DayListWidget';
import LineWidget from './LineWidget';
import DotGridWidget from './DotGridWidget';
import TextWidget from './TextWidget';
import CheckboxWidget from './CheckboxWidget';
import BoxWidget from './BoxWidget';
import ImageWidget from './ImageWidget';
import AnchorWidget from './AnchorWidget';
import LinkWidget from './LinkWidget';
import TapZoneWidget from './TapZoneWidget';
import LinkListWidget from './LinkListWidget';

// Widget component type
export type WidgetComponent = React.FC<{ widget: Widget }>;

// Widget registry mapping widget types to components
export const widgetRegistry: Record<string, WidgetComponent> = {
  // Complex widgets
  table: TableWidget,
  calendar: CalendarWidget,
  day_list: DayListWidget,
  link_list: LinkListWidget,

  // Line and grid widgets
  divider: LineWidget,
  vertical_line: LineWidget,
  lines: LineWidget,
  dot_grid: DotGridWidget,

  // Simple widgets
  text_block: TextWidget,
  checkbox: CheckboxWidget,
  box: BoxWidget,
  image: ImageWidget,
  anchor: AnchorWidget,
  internal_link: LinkWidget,
  tap_zone: TapZoneWidget,
};

/**
 * Get the widget component for a given widget type
 */
export const getWidgetComponent = (widgetType: string): WidgetComponent | null => {
  return widgetRegistry[widgetType] || null;
};

/**
 * Check if a widget type is supported
 */
export const isWidgetTypeSupported = (widgetType: string): boolean => {
  return widgetType in widgetRegistry;
};

/**
 * Get all supported widget types
 */
export const getSupportedWidgetTypes = (): string[] => {
  return Object.keys(widgetRegistry);
};

// Export individual components for direct use if needed
export {
  TableWidget,
  CalendarWidget,
  DayListWidget,
  LineWidget,
  DotGridWidget,
  TextWidget,
  CheckboxWidget,
  BoxWidget,
  ImageWidget,
  AnchorWidget,
  LinkWidget,
  TapZoneWidget,
  LinkListWidget,
};