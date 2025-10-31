/**
 * Calendar widget properties component.
 *
 * Handles calendar widget properties.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Widget } from '@/types';
import SelectInput from './shared/SelectInput';
import NumberInput from './shared/NumberInput';
import CheckboxInput from './shared/CheckboxInput';

interface CalendarPropertiesProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

const CalendarProperties: React.FC<CalendarPropertiesProps> = ({ widget, onUpdate }) => {
  const properties = widget.properties || {};

  const updateProperty = (key: string, value: any) => {
    onUpdate({
      properties: {
        ...properties,
        [key]: value
      }
    });
  };

  const calendarTypeOptions = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'custom_range', label: 'Custom Range' }
  ];

  const linkStrategyOptions = [
    { value: 'named_destinations', label: 'Named Destinations day:{date}' },
    { value: 'sequential_pages', label: 'Sequential Pages' },
    { value: 'no_links', label: 'No Links' }
  ];

  const firstDayOptions = [
    { value: 'sunday', label: 'Sunday (US)' },
    { value: 'monday', label: 'Monday (Europe)' }
  ];

  const layoutOrientationOptions = [
    { value: 'horizontal', label: 'Horizontal (Columns)' },
    { value: 'vertical', label: 'Vertical (Rows)' }
  ];

  const calendarType = properties.calendar_type || 'monthly';
  const linkStrategy = properties.link_strategy || 'named_destinations';
  const showLinkSettings = linkStrategy === 'sequential_pages';
  const showLinkTemplate = linkStrategy === 'named_destinations';

  return (
    <div className="space-y-6">
      {/* Calendar Configuration */}
      <div>
        <h4 className="font-medium mb-3">Calendar</h4>
        <div className="space-y-3">
          <SelectInput
            label="Type"
            value={calendarType}
            onChange={(value) => updateProperty('calendar_type', value)}
            options={calendarTypeOptions}
          />

          <div>
            <label className="block text-sm font-medium mb-1">
              Start Date
            </label>
            <input
              type="text"
              value={properties.start_date || ''}
              onChange={(e) => updateProperty('start_date', e.target.value)}
              placeholder="YYYY-MM-DD or {year}-{month_padded}-01"
              className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
            />
            <div className="text-xs text-eink-gray mt-1">
              Date (YYYY-MM-DD) or tokens like {'{year}-{month_padded}-01'}
            </div>
          </div>

          {calendarType === 'custom_range' && (
            <div>
              <label className="block text-sm font-medium mb-1">
                End Date
              </label>
              <input
                type="text"
                value={properties.end_date || ''}
                onChange={(e) => updateProperty('end_date', e.target.value)}
                placeholder="YYYY-MM-DD or {year}-{month_padded}-{day}"
                className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
              />
              <div className="text-xs text-eink-gray mt-1">
                Date (YYYY-MM-DD) or tokens
              </div>
            </div>
          )}

          <SelectInput
            label="First Day of Week"
            value={properties.first_day_of_week || 'monday'}
            onChange={(value) => updateProperty('first_day_of_week', value)}
            options={firstDayOptions}
          />

          <div className="grid grid-cols-2 gap-3">
            <CheckboxInput
              label="Show Weekdays"
              checked={properties.show_weekdays !== false}
              onChange={(checked) => updateProperty('show_weekdays', checked)}
            />
            <CheckboxInput
              label="Show Month Name"
              checked={properties.show_month_name !== false}
              onChange={(checked) => updateProperty('show_month_name', checked)}
            />
          </div>

          <CheckboxInput
            label="Show Year"
            checked={properties.show_year !== false}
            onChange={(checked) => updateProperty('show_year', checked)}
          />

          <div className="grid grid-cols-2 gap-3">
            <CheckboxInput
              label="Show Grid Lines"
              checked={properties.show_grid_lines !== false}
              onChange={(checked) => updateProperty('show_grid_lines', checked)}
            />
            <NumberInput
              label="Min Cell Size"
              value={properties.cell_min_size || 44}
              onChange={(value) => updateProperty('cell_min_size', value)}
              min={20}
              max={100}
              unit="pt"
              helpText="Touch target minimum for e-ink"
            />
          </div>

          {calendarType === 'monthly' && (
            <>
              <CheckboxInput
                label="Show Week Numbers"
                checked={properties.week_numbers === true}
                onChange={(checked) => updateProperty('week_numbers', checked)}
                helpText="ISO week numbers with auto-links"
              />

              <NumberInput
                label="Force Weeks"
                value={properties.force_weeks || null}
                onChange={(value) => updateProperty('force_weeks', value || null)}
                min={4}
                max={6}
                helpText="Fix number of weeks (4-6) for consistent height"
              />
            </>
          )}

          {calendarType === 'weekly' && (
            <SelectInput
              label="Weekly Layout"
              value={properties.layout_orientation || 'horizontal'}
              onChange={(value) => updateProperty('layout_orientation', value)}
              options={layoutOrientationOptions}
              helpText="Calendar orientation"
            />
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Highlight Date
            </label>
            <input
              type="text"
              value={properties.highlight_date || ''}
              onChange={(e) => updateProperty('highlight_date', e.target.value)}
              placeholder="{date} for current date, or YYYY-MM-DD"
              className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
            />
            <div className="text-xs text-eink-gray mt-1">
              Use {'{date}'} for current page date, or specific like 2025-01-15
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div>
        <h4 className="font-medium mb-3">Navigation</h4>
        <div className="space-y-3">
          <SelectInput
            label="Link Strategy"
            value={linkStrategy}
            onChange={(value) => updateProperty('link_strategy', value)}
            options={linkStrategyOptions}
            helpText="How calendar dates link to pages"
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
                  Template for day cell links. Tokens: {'{date}'}, {'{year}'}, {'{month}'}, {'{day}'}
                </div>
              </div>

              {properties.week_numbers === true && (
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

          {showLinkSettings && (
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="First Page Number"
                value={properties.first_page_number || 2}
                onChange={(value) => updateProperty('first_page_number', value)}
                min={1}
                helpText="Starting page for date links"
              />
              <NumberInput
                label="Pages per Date"
                value={properties.pages_per_date || 1}
                onChange={(value) => updateProperty('pages_per_date', value)}
                min={1}
                max={10}
                helpText="How many pages per day/date"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarProperties;