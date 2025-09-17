/**
 * Properties panel for editing selected widget properties.
 * 
 * Provides form controls for modifying widget attributes.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { Settings, Type, Square, Minus, AlignJustify, Anchor, Trash2 } from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { Widget } from '@/types';

const PropertiesPanel: React.FC = () => {
  const { selectedWidget, updateWidget, removeWidget, setSelectedWidget } = useEditorStore();

  const { register, handleSubmit, reset } = useForm<Widget>();

  React.useEffect(() => {
    if (selectedWidget) {
      reset(selectedWidget);
    }
  }, [selectedWidget, reset]);

  const onSubmit = (data: Widget) => {
    if (selectedWidget) {
      updateWidget(selectedWidget.id, data);
    }
  };

  // Live update handler for immediate feedback
  const handleLiveUpdate = React.useCallback((field: string, value: any) => {
    if (!selectedWidget) return;
    
    // Parse nested field paths like 'properties.line_spacing'
    const fieldParts = field.split('.');
    let updates: any = {};
    
    if (fieldParts.length === 1) {
      updates[fieldParts[0]] = value;
    } else if (fieldParts.length === 2) {
      const currentObj = selectedWidget[fieldParts[0] as keyof Widget];
      updates[fieldParts[0]] = {
        ...(currentObj && typeof currentObj === 'object' ? currentObj : {}),
        [fieldParts[1]]: value
      };
    }
    
    updateWidget(selectedWidget.id, updates);
  }, [selectedWidget, updateWidget]);

  if (!selectedWidget) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-eink-pale-gray">
          <h3 className="font-semibold flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Properties</span>
          </h3>
        </div>
        
        <div className="flex-1 flex items-center justify-center text-center p-6">
          <div>
            <Settings className="w-8 h-8 text-eink-light-gray mx-auto mb-2" />
            <p className="text-eink-gray">Select a widget to edit its properties</p>
          </div>
        </div>
      </div>
    );
  }

  const getWidgetIcon = (type: string) => {
    switch (type) {
      case 'text_block': return Type;
      case 'checkbox': return Square;
      case 'divider': return Minus;
      case 'lines': return AlignJustify;
      case 'anchor': return Anchor;
      default: return Settings;
    }
  };

  const Icon = getWidgetIcon(selectedWidget.type);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-eink-pale-gray">
        <h3 className="font-semibold flex items-center space-x-2">
          <Icon className="w-4 h-4" />
          <span>{selectedWidget.type.replace('_', ' ')}</span>
        </h3>
        <p className="text-xs text-eink-gray">Widget ID: {selectedWidget.id}</p>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              if (!selectedWidget) return;
              const ok = confirm('Delete this widget?');
              if (!ok) return;
              removeWidget(selectedWidget.id);
              setSelectedWidget(null);
            }}
            className="btn-secondary flex items-center space-x-2 text-red-700 border-red-200 hover:bg-red-50"
            title="Delete widget"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* General Properties */}
          <div>
            <h4 className="font-medium mb-3">General</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Page</label>
                <input
                  type="number"
                  min="1"
                  {...register('page', { required: true, min: 1 })}
                  className="input-field w-full"
                />
              </div>

              {selectedWidget.type !== 'divider' && selectedWidget.type !== 'lines' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Content</label>
                  <textarea
                    {...register('content')}
                    className="input-field w-full resize-none"
                    rows={3}
                    placeholder="Enter content..."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Background Color</label>
                <div className="flex space-x-2">
                  <input
                    type="color"
                    {...register('background_color')}
                    onChange={(e) => handleLiveUpdate('background_color', e.target.value)}
                    className="w-12 h-10 border border-eink-pale-gray rounded cursor-pointer"
                    title="Choose background color"
                    value={selectedWidget.background_color || '#FFFFFF'}
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      {...register('background_color')}
                      onChange={(e) => handleLiveUpdate('background_color', e.target.value)}
                      className="input-field w-full"
                      placeholder="Leave empty for transparent background"
                      pattern="^#[0-9A-Fa-f]{6}$"
                      value={selectedWidget.background_color || ''}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLiveUpdate('background_color', '')}
                    className="px-3 py-2 text-xs border border-eink-pale-gray rounded hover:bg-eink-pale-gray"
                    title="Clear background color"
                  >
                    Clear
                  </button>
                </div>
                <p className="text-xs text-eink-light-gray mt-1">
                  Background color for the widget (optional, hex format #RRGGBB). Leave empty for transparent.
                </p>
              </div>
            </div>
          </div>

          {/* Position & Size */}
          <div>
            <h4 className="font-medium mb-3">Position & Size</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">X</label>
                <input
                  type="number"
                  {...register('position.x', { required: true, min: 0 })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Y</label>
                <input
                  type="number"
                  {...register('position.y', { required: true, min: 0 })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Width</label>
                <input
                  type="number"
                  {...register('position.width', { required: true, min: 1 })}
                  onChange={(e) => {
                    const width = parseInt(e.target.value) || 100;
                    handleLiveUpdate('position.width', width);
                    // For Lines widget, ensure margins don't exceed width
                    if (selectedWidget?.type === 'lines') {
                      const marginLeft = selectedWidget?.properties?.margin_left || 0;
                      const marginRight = selectedWidget?.properties?.margin_right || 0;
                      const totalMargins = marginLeft + marginRight;
                      
                      // If margins exceed width, proportionally reduce them
                      if (totalMargins >= width - 10) { // Leave at least 10pt for line
                        const ratio = Math.max(0.1, (width - 10) / totalMargins);
                        handleLiveUpdate('properties.margin_left', Math.floor(marginLeft * ratio));
                        handleLiveUpdate('properties.margin_right', Math.floor(marginRight * ratio));
                      }
                    }
                  }}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Height</label>
                <input
                  type="number"
                  {...register('position.height', { required: true, min: 1 })}
                  onChange={(e) => {
                    const height = parseInt(e.target.value) || 100;
                    handleLiveUpdate('position.height', height);
                    // Auto-calculate line count for Lines widget
                    if (selectedWidget?.type === 'lines') {
                      const spacing = selectedWidget?.properties?.line_spacing || 20;
                      const newLineCount = Math.max(1, Math.floor((height - 20) / spacing));
                      handleLiveUpdate('properties.line_count', newLineCount);
                    }
                  }}
                  className="input-field w-full"
                />
              </div>
            </div>
          </div>

          {/* Styling (for text_block) */}
          {selectedWidget.type === 'text_block' && (
            <div>
              <h4 className="font-medium mb-3">Styling</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Font</label>
                  <select {...register('styling.font')} className="input-field w-full">
                    <option value="Helvetica">Helvetica</option>
                    <option value="Helvetica-Bold">Helvetica Bold</option>
                    <option value="Times-Roman">Times Roman</option>
                    <option value="Times-Bold">Times Bold</option>
                    <option value="Courier">Courier</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Size (pt)</label>
                  <input
                    type="number"
                    min="6"
                    max="72"
                    {...register('styling.size', { min: 6, max: 72 })}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Color</label>
                  <input
                    type="color"
                    {...register('styling.color')}
                    className="input-field w-full h-10"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Properties (for checkbox) */}
          {selectedWidget.type === 'checkbox' && (
            <div>
              <h4 className="font-medium mb-3">Properties</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Checkbox Size (pt)</label>
                  <input
                    type="number"
                    min="4"
                    max="100"
                    {...register('properties.checkbox_size', { min: 4, max: 100 })}
                    className="input-field w-full"
                  />
                  <p className="text-xs text-eink-light-gray mt-1">
                    Checkbox size in points. Size shown in preview matches PDF output exactly.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Properties (for lines) */}
          {selectedWidget.type === 'lines' && (
            <div>
              <h4 className="font-medium mb-3">Line Properties</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Line Spacing (pt)</label>
                  <input
                    type="number"
                    min="10"
                    max="50"
                    {...register('properties.line_spacing', { min: 10, max: 50 })}
                    onChange={(e) => {
                      const spacing = parseInt(e.target.value) || 20;
                      handleLiveUpdate('properties.line_spacing', spacing);
                      // Auto-adjust height based on line count and new spacing
                      const count = selectedWidget?.properties?.line_count || 10;
                      const newHeight = Math.max(50, count * spacing + 20);
                      handleLiveUpdate('position.height', newHeight);
                    }}
                    className="input-field w-full"
                    placeholder="20"
                  />
                  <p className="text-xs text-eink-light-gray mt-1">
                    Distance between lines (default: 20pt)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Line Count</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    {...register('properties.line_count', { min: 1, max: 50 })}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 10;
                      handleLiveUpdate('properties.line_count', count);
                      // Auto-adjust height based on line count and spacing
                      const spacing = selectedWidget?.properties?.line_spacing || 20;
                      const newHeight = Math.max(50, count * spacing + 20);
                      handleLiveUpdate('position.height', newHeight);
                    }}
                    className="input-field w-full"
                    placeholder="10"
                  />
                  <p className="text-xs text-eink-light-gray mt-1">
                    Number of lines (auto-adjusts height)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Line Thickness (pt)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.5"
                    max="3.0"
                    {...register('properties.line_thickness', { min: 0.5, max: 3.0 })}
                    onChange={(e) => handleLiveUpdate('properties.line_thickness', parseFloat(e.target.value) || 0.75)}
                    className="input-field w-full"
                    placeholder="0.75"
                  />
                  <p className="text-xs text-eink-light-gray mt-1">
                    Line stroke width (default: 0.75pt, e-ink optimized)
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Left Margin (pt)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      {...register('properties.margin_left', { min: 0, max: 100 })}
                      onChange={(e) => {
                        let marginLeft = parseInt(e.target.value) || 0;
                        const marginRight = selectedWidget?.properties?.margin_right || 0;
                        const widgetWidth = selectedWidget?.position?.width || 100;
                        
                        // Ensure margins don't exceed widget width minus minimum line space
                        const maxMarginLeft = Math.max(0, widgetWidth - marginRight - 10);
                        marginLeft = Math.min(marginLeft, maxMarginLeft);
                        
                        handleLiveUpdate('properties.margin_left', marginLeft);
                      }}
                      className="input-field w-full"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Right Margin (pt)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      {...register('properties.margin_right', { min: 0, max: 100 })}
                      onChange={(e) => {
                        let marginRight = parseInt(e.target.value) || 0;
                        const marginLeft = selectedWidget?.properties?.margin_left || 0;
                        const widgetWidth = selectedWidget?.position?.width || 100;
                        
                        // Ensure margins don't exceed widget width minus minimum line space
                        const maxMarginRight = Math.max(0, widgetWidth - marginLeft - 10);
                        marginRight = Math.min(marginRight, maxMarginRight);
                        
                        handleLiveUpdate('properties.margin_right', marginRight);
                      }}
                      className="input-field w-full"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Line Style</label>
                  <select 
                    {...register('properties.line_style')} 
                    onChange={(e) => handleLiveUpdate('properties.line_style', e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="solid">Ruled Lines (solid)</option>
                    <option value="dotted">Dotted Lines</option>
                    <option value="dashed">Dashed Lines</option>
                    <option value="grid">Grid Pattern</option>
                  </select>
                  <p className="text-xs text-eink-light-gray mt-1">
                    Choose pattern type - grid adds vertical lines
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Anchor Widget Properties */}
          {selectedWidget.type === 'anchor' && (
            <div>
              <h4 className="font-medium mb-3">Anchor Properties</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Anchor Type</label>
                  <select 
                    {...register('properties.anchor_type')} 
                    onChange={(e) => handleLiveUpdate('properties.anchor_type', e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="page_link">Page Link</option>
                    <option value="named_destination">Named Destination</option>
                    <option value="outline_bookmark">Outline Bookmark</option>
                  </select>
                  <p className="text-xs text-eink-light-gray mt-1">
                    Type of navigation target
                  </p>
                </div>
                
                {selectedWidget.properties?.anchor_type === 'page_link' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Target Page</label>
                    <input
                      type="number"
                      min="1"
                      {...register('properties.target_page', { min: 1 })}
                      onChange={(e) => handleLiveUpdate('properties.target_page', parseInt(e.target.value) || 1)}
                      className="input-field w-full"
                      placeholder="1"
                    />
                    <p className="text-xs text-eink-light-gray mt-1">
                      Page number to navigate to
                    </p>
                  </div>
                )}
                
                {(selectedWidget.properties?.anchor_type === 'named_destination' || 
                  selectedWidget.properties?.anchor_type === 'outline_bookmark') && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Destination ID</label>
                    <input
                      {...register('properties.destination')}
                      onChange={(e) => handleLiveUpdate('properties.destination', e.target.value)}
                      className="input-field w-full"
                      placeholder="bookmark_id"
                    />
                    <p className="text-xs text-eink-light-gray mt-1">
                      {selectedWidget.properties?.anchor_type === 'named_destination' 
                        ? 'Named destination identifier'
                        : 'Bookmark ID to link to'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Calendar Widget Properties */}
          {/* Styling (for calendar) */}
          {selectedWidget.type === 'calendar' && (
            <div>
              <h4 className="font-medium mb-3">Calendar Styling</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Font</label>
                  <select 
                    {...register('styling.font')} 
                    onChange={(e) => handleLiveUpdate('styling.font', e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="Helvetica">Helvetica</option>
                    <option value="Helvetica-Bold">Helvetica Bold</option>
                    <option value="Times-Roman">Times Roman</option>
                    <option value="Times-Bold">Times Bold</option>
                    <option value="Courier">Courier</option>
                  </select>
                  <p className="text-xs text-eink-light-gray mt-1">
                    Font family for calendar text
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Size (pt)</label>
                  <input
                    type="number"
                    min="6"
                    max="24"
                    {...register('styling.size', { min: 6, max: 24 })}
                    onChange={(e) => handleLiveUpdate('styling.size', parseInt(e.target.value) || 10)}
                    className="input-field w-full"
                    placeholder="10"
                  />
                  <p className="text-xs text-eink-light-gray mt-1">
                    Font size for calendar text (6-24pt for readability)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Color</label>
                  <input
                    type="color"
                    {...register('styling.color')}
                    onChange={(e) => handleLiveUpdate('styling.color', e.target.value)}
                    className="w-full h-10 border border-eink-pale-gray rounded"
                  />
                  <p className="text-xs text-eink-light-gray mt-1">
                    Text color (black recommended for e-ink)
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedWidget.type === 'calendar' && (
            <div>
              <h4 className="font-medium mb-3">Calendar Properties</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Calendar Type</label>
                  <select 
                    {...register('properties.calendar_type')} 
                    onChange={(e) => handleLiveUpdate('properties.calendar_type', e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="custom_range">Custom Range</option>
                  </select>
                  <p className="text-xs text-eink-light-gray mt-1">
                    Layout and date range type
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    {...register('properties.start_date')}
                    onChange={(e) => handleLiveUpdate('properties.start_date', e.target.value)}
                    className="input-field w-full"
                    required
                  />
                  <p className="text-xs text-eink-light-gray mt-1">
                    First date to display in calendar
                  </p>
                </div>

                {selectedWidget.properties?.calendar_type === 'custom_range' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">End Date</label>
                    <input
                      type="date"
                      {...register('properties.end_date')}
                      onChange={(e) => handleLiveUpdate('properties.end_date', e.target.value)}
                      className="input-field w-full"
                    />
                    <p className="text-xs text-eink-light-gray mt-1">
                      Last date to display (for custom ranges)
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">Link Strategy</label>
                  <select 
                    {...register('properties.link_strategy')} 
                    onChange={(e) => handleLiveUpdate('properties.link_strategy', e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="no_links">No Links</option>
                    <option value="sequential_pages">Sequential Pages</option>
                    <option value="named_destinations">Named Destinations</option>
                  </select>
                  <p className="text-xs text-eink-light-gray mt-1">
                    How calendar dates should link to content
                  </p>
                </div>

                {selectedWidget.properties?.link_strategy === 'sequential_pages' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">First Page</label>
                      <input
                        type="number"
                        min="1"
                        {...register('properties.first_page_number', { min: 1 })}
                        onChange={(e) => handleLiveUpdate('properties.first_page_number', parseInt(e.target.value) || 1)}
                        className="input-field w-full"
                        placeholder="2"
                      />
                      <p className="text-xs text-eink-light-gray mt-1">
                        Starting page number
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Pages per Date</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        {...register('properties.pages_per_date', { min: 1, max: 10 })}
                        onChange={(e) => handleLiveUpdate('properties.pages_per_date', parseInt(e.target.value) || 1)}
                        className="input-field w-full"
                        placeholder="1"
                      />
                      <p className="text-xs text-eink-light-gray mt-1">
                        Pages allocated per day
                      </p>
                    </div>
                  </div>
                )}

                {selectedWidget.properties?.link_strategy === 'named_destinations' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Destination Pattern</label>
                    <input
                      {...register('properties.destination_pattern')}
                      onChange={(e) => handleLiveUpdate('properties.destination_pattern', e.target.value)}
                      className="input-field w-full"
                      placeholder="day_{YYYY-MM-DD}"
                    />
                    <p className="text-xs text-eink-light-gray mt-1">
                      Pattern for destination names. Use {'{YYYY-MM-DD}'} for date substitution
                    </p>
                  </div>
                )}

                <div>
                  <h5 className="font-medium mb-2">Display Options</h5>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        {...register('properties.show_weekdays')}
                        onChange={(e) => handleLiveUpdate('properties.show_weekdays', e.target.checked)}
                        className="rounded border-eink-pale-gray"
                      />
                      <span className="text-sm">Show weekday headers</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        {...register('properties.show_month_year')}
                        onChange={(e) => handleLiveUpdate('properties.show_month_year', e.target.checked)}
                        className="rounded border-eink-pale-gray"
                      />
                      <span className="text-sm">Show month and year</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        {...register('properties.show_grid_lines')}
                        onChange={(e) => handleLiveUpdate('properties.show_grid_lines', e.target.checked)}
                        className="rounded border-eink-pale-gray"
                      />
                      <span className="text-sm">Show grid lines</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Week Start</label>
                  <select 
                    {...register('properties.first_day_of_week')} 
                    onChange={(e) => handleLiveUpdate('properties.first_day_of_week', e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="monday">Monday (European)</option>
                    <option value="sunday">Sunday (US)</option>
                  </select>
                  <p className="text-xs text-eink-light-gray mt-1">
                    First day of the week for calendar layout
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Minimum Cell Size (pt)</label>
                  <input
                    type="number"
                    min="20"
                    max="100"
                    {...register('properties.cell_min_size', { min: 20, max: 100 })}
                    onChange={(e) => handleLiveUpdate('properties.cell_min_size', parseInt(e.target.value) || 44)}
                    className="input-field w-full"
                    placeholder="44"
                  />
                  <p className="text-xs text-eink-light-gray mt-1">
                    Minimum touch target size for e-ink devices (recommended: 44pt)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bookmark Properties */}
          <div>
            <h4 className="font-medium mb-3">Navigation</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Bookmark ID</label>
                <input
                  {...register('properties.bookmark')}
                  className="input-field w-full"
                  placeholder="Optional bookmark identifier"
                />
                <p className="text-xs text-eink-light-gray mt-1">
                  Used for creating named destinations and links
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button type="submit" className="btn-primary w-full">
            Apply Changes
          </button>
        </form>
      </div>
    </div>
  );
};

export default PropertiesPanel;
