/**
 * Day List widget properties component.
 *
 * Handles day list widget properties.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import SelectInput from './shared/SelectInput';
import NumberInput from './shared/NumberInput';
import CheckboxInput from './shared/CheckboxInput';

interface DayListPropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const DayListProperties: React.FC<DayListPropertiesProps> = ({ widget, onUpdate }) => {
  const properties = widget.properties || {};

  const updateProperty = (key: string, value: any) => {
    onUpdate({
      properties: {
        ...properties,
        [key]: value
      }
    });
  };

  const weekdayFormatOptions = [
    { value: 'short', label: 'Short (Mon, Tue, ...)' },
    { value: 'narrow', label: 'Narrow (M, T, ...)' },
    { value: 'full', label: 'Full (Monday, Tuesday, ...)' }
  ];

  const firstDayOptions = [
    { value: 'monday', label: 'Monday (Europe)' },
    { value: 'sunday', label: 'Sunday (US)' }
  ];

  const linkStrategyOptions = [
    { value: 'no_links', label: 'No Links' },
    { value: 'named_destinations', label: 'Named Destinations' },
    { value: 'sequential_pages', label: 'Sequential Pages' }
  ];

  const orientationOptions = [
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'vertical_cw', label: 'Vertical (Clockwise)' },
    { value: 'vertical_ccw', label: 'Vertical (Counter-Clockwise)' }
  ];

  const linkStrategy = properties.link_strategy || 'no_links';
  const showLinkTemplate = linkStrategy === 'named_destinations';
  const showFirstPageNumber = linkStrategy === 'sequential_pages';

  return (
    <div className="space-y-6">
      {/* Date Settings */}
      <div>
        <h4 className="font-medium mb-3">Date Settings</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              Start Date
            </label>
            <input
              type="text"
              value={properties.start_date || ''}
              onChange={(e) => updateProperty('start_date', e.target.value)}
              placeholder="{year}-{month}-01"
              className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
            />
            <div className="text-xs text-eink-gray mt-1">
              First day of month (YYYY-MM-DD) or tokens like {'{year}-{month}-01'}
            </div>
          </div>

        </div>
      </div>

      {/* Header Options */}
      <div>
        <h4 className="font-medium mb-3">Header Options</h4>
        <div className="space-y-3">
          <CheckboxInput
            label="Show Month Header"
            checked={properties.show_month_header === true}
            onChange={(checked) => updateProperty('show_month_header', checked)}
            helpText="Display month name at top of widget"
          />

          {properties.show_month_header === true && (
            <>
              <CheckboxInput
                label="Show Year in Header"
                checked={properties.show_year_in_header === true}
                onChange={(checked) => updateProperty('show_year_in_header', checked)}
                helpText="Include year in header"
              />

              <SelectInput
                label="Month Name Format"
                value={properties.month_name_format || 'long'}
                onChange={(value) => updateProperty('month_name_format', value)}
                options={[
                  { value: 'long', label: 'Long (January, February, ...)' },
                  { value: 'short', label: 'Short (Jan, Feb, ...)' }
                ]}
              />
            </>
          )}
        </div>
      </div>

      {/* Display Options */}
      <div>
        <h4 className="font-medium mb-3">Display Options</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <CheckboxInput
              label="Show Day Numbers"
              checked={properties.show_day_numbers !== false}
              onChange={(checked) => updateProperty('show_day_numbers', checked)}
            />
            <CheckboxInput
              label="Show Weekday Names"
              checked={properties.show_weekday_names !== false}
              onChange={(checked) => updateProperty('show_weekday_names', checked)}
            />
          </div>

          <CheckboxInput
            label="Show Week Numbers"
            checked={properties.show_week_numbers === true}
            onChange={(checked) => updateProperty('show_week_numbers', checked)}
            helpText="Display ISO week numbers with automatic links (when using named destinations strategy)"
          />

          <SelectInput
            label="Weekday Format"
            value={properties.weekday_format || 'short'}
            onChange={(value) => updateProperty('weekday_format', value)}
            options={weekdayFormatOptions}
          />

          <SelectInput
            label="First Day of Week"
            value={properties.first_day_of_week || 'monday'}
            onChange={(value) => updateProperty('first_day_of_week', value)}
            options={firstDayOptions}
          />

          <NumberInput
            label="Row Height"
            value={properties.row_height || 20}
            onChange={(value) => updateProperty('row_height', value)}
            min={10}
            max={100}
            unit="pt"
            helpText="Height of each day row"
          />

          <SelectInput
            label="Orientation"
            value={properties.orientation || 'horizontal'}
            onChange={(value) => updateProperty('orientation', value)}
            options={orientationOptions}
            helpText="Text orientation for rotated displays"
          />
        </div>
      </div>

      {/* Notes Configuration */}
      <div>
        <h4 className="font-medium mb-3">Notes Configuration</h4>
        <div className="space-y-3">
          <CheckboxInput
            label="Show Notes Lines"
            checked={properties.show_notes_lines !== false}
            onChange={(checked) => updateProperty('show_notes_lines', checked)}
            helpText="Display horizontal lines for writing notes"
          />

          {properties.show_notes_lines !== false && (
            <NumberInput
              label="Notes Line Count"
              value={properties.notes_line_count || 1}
              onChange={(value) => updateProperty('notes_line_count', value)}
              min={0}
              max={5}
              helpText="Number of horizontal lines per day"
            />
          )}
        </div>
      </div>

      {/* Weekend Highlighting */}
      <div>
        <h4 className="font-medium mb-3">Weekend Highlighting</h4>
        <div className="space-y-3">
          <CheckboxInput
            label="Highlight Weekends"
            checked={properties.highlight_weekends === true}
            onChange={(checked) => updateProperty('highlight_weekends', checked)}
            helpText="Add background color to weekend rows"
          />

          {properties.highlight_weekends === true && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Weekend Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={properties.weekend_color || '#F0F0F0'}
                  onChange={(e) => updateProperty('weekend_color', e.target.value)}
                  className="h-8 w-16 border border-eink-pale-gray rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={properties.weekend_color || '#F0F0F0'}
                  onChange={(e) => updateProperty('weekend_color', e.target.value)}
                  placeholder="#F0F0F0"
                  className="flex-1 px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <div>
        <h4 className="font-medium mb-3">Navigation Links</h4>
        <div className="space-y-3">
          <SelectInput
            label="Link Strategy"
            value={linkStrategy}
            onChange={(value) => updateProperty('link_strategy', value)}
            options={linkStrategyOptions}
            helpText="How each day row links to pages"
          />

          {showLinkTemplate && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Day Link Template
                </label>
                <input
                  type="text"
                  value={properties.link_template || 'day:{date}'}
                  onChange={(e) => updateProperty('link_template', e.target.value)}
                  placeholder="day:{date}"
                  className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
                />
                <div className="text-xs text-eink-gray mt-1">
                  Template for day row links. Tokens: {'{date}'}, {'{year}'}, {'{month}'}, {'{day}'}
                </div>
              </div>

              {properties.show_week_numbers === true && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Week Link Template
                  </label>
                  <input
                    type="text"
                    value={properties.week_link_template || 'week:{week}'}
                    onChange={(e) => updateProperty('week_link_template', e.target.value)}
                    placeholder="week:{week}"
                    className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
                  />
                  <div className="text-xs text-eink-gray mt-1">
                    Template for week number links. Tokens: {'{week}'}, {'{year}'}, {'{month}'}, {'{date}'}
                  </div>
                </div>
              )}
            </>
          )}

          {showFirstPageNumber && (
            <NumberInput
              label="First Page Number"
              value={properties.first_page_number || 2}
              onChange={(value) => updateProperty('first_page_number', value)}
              min={1}
              helpText="Page number for day 1"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DayListProperties;
