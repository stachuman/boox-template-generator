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
  const { selectedWidget, updateWidget, removeWidget, setSelectedWidget, getAssignedMasterForPage, moveWidgetToMaster, detachWidgetFromMasterToPage, findMasterIdByWidget, currentPage } = useEditorStore() as any;

  const { register, handleSubmit, reset } = useForm<Widget>();

  React.useEffect(() => {
    if (selectedWidget) {
      reset(selectedWidget);
    }
  }, [selectedWidget, reset]);

  // Font options loaded from backend assets (must be before any conditional returns)
  const [fontOptions, setFontOptions] = React.useState<string[]>(['Helvetica','Times-Roman','Courier']);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { APIClient } = await import('@/services/api');
        const fonts = await APIClient.getFonts();
        if (mounted && Array.isArray(fonts) && fonts.length) setFontOptions(fonts);
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, []);

  const onSubmit = (data: Widget) => {
    if (selectedWidget) {
      updateWidget(selectedWidget.id, data);
    }
  };

  // Helper functions for link template preview
  const generateDestinationPreview = (bindTemplate: string): string => {
    if (!bindTemplate) return '';

    // Simulate the backend binding resolution logic
    // Replace @index with sample numbers, @index_date with sample dates
    let preview = bindTemplate;

    // Add colon after the first part (this is what the backend does)
    const colonIndex = preview.indexOf('(');
    if (colonIndex > 0) {
      const prefix = preview.substring(0, colonIndex);
      const suffix = preview.substring(colonIndex);
      preview = prefix + ':' + suffix.replace(/[()]/g, '');
    }

    // Replace common variables with sample values
    preview = preview
      .replace(/@index_padded/g, '001')
      .replace(/@index/g, '1')
      .replace(/@index_date/g, '2026-01-15')
      .replace(/@year/g, '2026')
      .replace(/@month_padded/g, '01')
      .replace(/@month/g, '1');

    return preview + ', ' + preview.replace(/001|01|1$/, '002') + '...';
  };

  const generateAnchorTemplate = (bindTemplate: string): string => {
    if (!bindTemplate) return '';

    // Convert link template to anchor template format
    let anchorTemplate = bindTemplate;

    // Add colon after the first part
    const colonIndex = anchorTemplate.indexOf('(');
    if (colonIndex > 0) {
      const prefix = anchorTemplate.substring(0, colonIndex);
      const suffix = anchorTemplate.substring(colonIndex);
      anchorTemplate = prefix + ':' + suffix.replace(/[()]/g, '');
    }

    // Convert @variables to {variables}
    anchorTemplate = anchorTemplate
      .replace(/@index_padded/g, '{index_padded}')
      .replace(/@index_date/g, '{date}')
      .replace(/@index/g, '{index}')
      .replace(/@year/g, '{year}')
      .replace(/@month_padded/g, '{month_padded}')
      .replace(/@month/g, '{month}');

    return anchorTemplate;
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
      case 'link_list': return AlignJustify;
      case 'anchor': return Anchor;
      case 'tap_zone': return Anchor;
      case 'box': return Square;
      default: return Settings;
    }
  };

  const Icon = getWidgetIcon(selectedWidget.type);
  // Deprecated static list removed; we fetch from backend assets

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
          {/* Move between page and master */}
          <div className="mt-2 flex items-center space-x-2">
            {(() => {
              const assignedMaster = getAssignedMasterForPage(currentPage);
              const inMaster = findMasterIdByWidget(selectedWidget.id);
              if (inMaster) {
                return (
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => detachWidgetFromMasterToPage(selectedWidget.id, currentPage)}
                    title="Detach from master to this page"
                  >
                    Detach to Page
                  </button>
                );
              }
              if (assignedMaster) {
                return (
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => moveWidgetToMaster(selectedWidget.id, assignedMaster)}
                    title="Move this widget into the assigned master"
                  >
                    Move to Master
                  </button>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Helper function for common styling properties */}
          {(() => {
            const renderAppearanceSection = () => (
              <div>
                <h4 className="font-medium mb-3">Appearance</h4>
                <div className="space-y-3">
                  {/* Background Color */}
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

                  {/* Text Styling - Show for widgets with text */}
                  {(selectedWidget.type === 'text_block' || selectedWidget.type === 'checkbox' ||
                    selectedWidget.type === 'internal_link' || selectedWidget.type === 'calendar' ||
                    selectedWidget.type === 'link_list') && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Font</label>
                          <select
                            {...register('styling.font')}
                            onChange={(e) => handleLiveUpdate('styling.font', e.target.value)}
                            className="input-field w-full"
                          >
                            {fontOptions.map(f => (<option key={f} value={f}>{f}</option>))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Size (pt)</label>
                          <input
                            type="number"
                            min="6"
                            max={selectedWidget.type === 'calendar' ? 24 : 72}
                            {...register('styling.size', { min: 6, max: selectedWidget.type === 'calendar' ? 24 : 72 })}
                            onChange={(e) => handleLiveUpdate('styling.size', parseInt(e.target.value) || 12)}
                            className="input-field w-full"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Color</label>
                          <input
                            type="color"
                            {...register('styling.color')}
                            onChange={(e) => handleLiveUpdate('styling.color', e.target.value)}
                            className="w-full h-10 border border-eink-pale-gray rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Text Align</label>
                          <select
                            {...register('styling.text_align')}
                            onChange={(e) => handleLiveUpdate('styling.text_align', e.target.value)}
                            className="input-field w-full"
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );

            return null; // This is just to define the function
          })()}
          {/* 1. BASIC - Core widget properties */}
          {(selectedWidget.type !== 'divider' && selectedWidget.type !== 'vertical_line' && selectedWidget.type !== 'lines' && selectedWidget.type !== 'anchor') && (
            <div>
              <h4 className="font-medium mb-3">Basic</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Content</label>
                  <textarea
                    {...register('content')}
                    onChange={(e) => handleLiveUpdate('content', e.target.value)}
                    className="input-field w-full resize-none"
                    rows={3}
                    placeholder="Enter content..."
                  />
                </div>
              </div>
            </div>
          )}

          {(selectedWidget.type === 'divider' || selectedWidget.type === 'vertical_line') && (
            <div>
              <h4 className="font-medium mb-3">Line Style</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Line Color</label>
                  <input
                    type="color"
                    defaultValue={selectedWidget.properties?.stroke_color || '#000000'}
                    {...register('properties.stroke_color')}
                    onChange={(e) => handleLiveUpdate('properties.stroke_color', e.target.value)}
                    className="w-full h-10 border border-eink-pale-gray rounded"
                    title="Choose line color"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Thickness (pt)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="6"
                    {...register('properties.line_thickness', { min: 0.25, max: 6 })}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 1;
                      handleLiveUpdate('properties.line_thickness', value);
                      if (selectedWidget?.type === 'divider') {
                        handleLiveUpdate('position.height', Math.max(1, value));
                      } else if (selectedWidget?.type === 'vertical_line') {
                        handleLiveUpdate('position.width', Math.max(1, value));
                      }
                    }}
                    className="input-field w-full"
                    placeholder="1.0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. POSITION & SIZE - Layout properties */}
          <div>
            <h4 className="font-medium mb-3">Position & Size</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">X</label>
                <input
                  type="number"
                  {...register('position.x', { required: true, min: 0 })}
                  onChange={(e) => handleLiveUpdate('position.x', parseInt(e.target.value) || 0)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Y</label>
                <input
                  type="number"
                  {...register('position.y', { required: true, min: 0 })}
                  onChange={(e) => handleLiveUpdate('position.y', parseInt(e.target.value) || 0)}
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
                    } else if (selectedWidget?.type === 'vertical_line') {
                      handleLiveUpdate('properties.line_thickness', width);
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
                    } else if (selectedWidget?.type === 'divider') {
                      handleLiveUpdate('properties.line_thickness', height);
                    }
                  }}
                  className="input-field w-full"
                />
              </div>
            </div>
          </div>

          {/* 3. APPEARANCE - Visual styling (background, fonts, colors) */}
          {(() => {
            const renderAppearanceSection = () => (
              <div>
                <h4 className="font-medium mb-3">Appearance</h4>
                <div className="space-y-3">
                  {/* Background Color */}
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

                  {/* Text Styling - Show for widgets with text */}
                  {(selectedWidget.type === 'text_block' || selectedWidget.type === 'checkbox' ||
                    selectedWidget.type === 'internal_link' || selectedWidget.type === 'calendar' ||
                    selectedWidget.type === 'link_list') && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Font</label>
                          <select
                            {...register('styling.font')}
                            onChange={(e) => handleLiveUpdate('styling.font', e.target.value)}
                            className="input-field w-full"
                          >
                            {fontOptions.map(f => (<option key={f} value={f}>{f}</option>))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Size (pt)</label>
                          <input
                            type="number"
                            min="6"
                            max={selectedWidget.type === 'calendar' ? 24 : selectedWidget.type === 'checkbox' ? 24 : 72}
                            {...register('styling.size', { min: 6, max: selectedWidget.type === 'calendar' ? 24 : selectedWidget.type === 'checkbox' ? 24 : 72 })}
                            onChange={(e) => handleLiveUpdate('styling.size', parseInt(e.target.value) || 12)}
                            className="input-field w-full"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Color</label>
                          <input
                            type="color"
                            {...register('styling.color')}
                            onChange={(e) => handleLiveUpdate('styling.color', e.target.value)}
                            className="w-full h-10 border border-eink-pale-gray rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Text Align</label>
                          <select
                            {...register('styling.text_align')}
                            onChange={(e) => handleLiveUpdate('styling.text_align', e.target.value)}
                            className="input-field w-full"
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Text Block specific styling */}
                  {selectedWidget.type === 'text_block' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Orientation</label>
                        <select
                          {...register('properties.orientation')}
                          onChange={(e) => handleLiveUpdate('properties.orientation', e.target.value)}
                          className="input-field w-full"
                        >
                          <option value="horizontal">Horizontal (0°)</option>
                          <option value="vertical">Vertical (90°)</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Top Padding (pt)</label>
                          <input
                            type="number"
                            min="0"
                            max="200"
                            {...register('properties.top_padding', { min: 0, max: 200 })}
                            onChange={(e) => handleLiveUpdate('properties.top_padding', parseInt(e.target.value) || 0)}
                            className="input-field w-full"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Line Cap</label>
                          <select
                            {...register('properties.line_cap')}
                            onChange={(e) => handleLiveUpdate('properties.line_cap', e.target.value)}
                            className="input-field w-full"
                          >
                            <option value="butt">Butt</option>
                            <option value="round">Round</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );

            return renderAppearanceSection();
          })()}

          {/* 4. BEHAVIOR - Widget-specific functionality */}

          {/* Box Behavior & Appearance */}
          {selectedWidget.type === 'box' && (
            <div>
              <h4 className="font-medium mb-3">Box</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Fill Color</label>
                    <div className="flex space-x-2">
                      <input
                        type="color"
                        {...register('properties.fill_color')}
                        onChange={(e) => handleLiveUpdate('properties.fill_color', e.target.value)}
                        className="w-12 h-10 border border-eink-pale-gray rounded cursor-pointer"
                        value={(selectedWidget as any).properties?.fill_color || '#FFFFFF'}
                      />
                      <input
                        type="text"
                        {...register('properties.fill_color')}
                        onChange={(e) => handleLiveUpdate('properties.fill_color', e.target.value)}
                        className="input-field w-full"
                        placeholder="#FFFFFF"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Stroke Color</label>
                    <div className="flex space-x-2">
                      <input
                        type="color"
                        {...register('properties.stroke_color')}
                        onChange={(e) => handleLiveUpdate('properties.stroke_color', e.target.value)}
                        className="w-12 h-10 border border-eink-pale-gray rounded cursor-pointer"
                        value={(selectedWidget as any).properties?.stroke_color || '#000000'}
                      />
                      <input
                        type="text"
                        {...register('properties.stroke_color')}
                        onChange={(e) => handleLiveUpdate('properties.stroke_color', e.target.value)}
                        className="input-field w-full"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Stroke Width (pt)</label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max="8"
                      {...register('properties.stroke_width', { min: 0, max: 8 })}
                      onChange={(e) => handleLiveUpdate('properties.stroke_width', parseFloat(e.target.value) || 0)}
                      className="input-field w-full"
                      placeholder="1.0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Corner Radius (pt)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="60"
                      {...register('properties.corner_radius', { min: 0, max: 60 })}
                      onChange={(e) => handleLiveUpdate('properties.corner_radius', parseFloat(e.target.value) || 0)}
                      className="input-field w-full"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Opacity (0–1)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      {...register('properties.opacity', { min: 0, max: 1 })}
                      onChange={(e) => handleLiveUpdate('properties.opacity', parseFloat(e.target.value) || 1)}
                      className="input-field w-full"
                      placeholder="1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Destination ID (optional)</label>
                  <input
                    type="text"
                    {...register('properties.to_dest')}
                    onChange={(e) => handleLiveUpdate('properties.to_dest', e.target.value)}
                    className="input-field w-full"
                    placeholder="e.g., home:index or notes:page:001"
                  />
                  <p className="text-xs text-eink-light-gray mt-1">Makes the box clickable to a named destination.</p>
                </div>
              </div>
            </div>
          )}

          {/* Link List Behavior */}
          {selectedWidget.type === 'link_list' && (
            <div>
              <h4 className="font-medium mb-3">Behavior</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Text Orientation</label>
                  <select
                    {...register('properties.orientation')}
                    onChange={(e) => handleLiveUpdate('properties.orientation', e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="horizontal">Horizontal (0°)</option>
                    <option value="vertical">Vertical (90° text)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Count</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      {...register('properties.count', { min: 1, max: 20 })}
                      onChange={(e) => handleLiveUpdate('properties.count', parseInt(e.target.value) || 1)}
                      className="input-field w-full"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Columns</label>
                    <input
                      type="number"
                      min="1"
                      max="15"
                      {...register('properties.columns', { min: 1, max: 15 })}
                      onChange={(e) => handleLiveUpdate('properties.columns', parseInt(e.target.value) || 2)}
                      className="input-field w-full"
                      placeholder="2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Index Padding</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      {...register('properties.index_pad', { min: 1, max: 6 })}
                      onChange={(e) => handleLiveUpdate('properties.index_pad', parseInt(e.target.value) || 3)}
                      className="input-field w-full"
                      placeholder="3"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Gap Y (pt)</label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      {...register('properties.gap_y', { min: 0, max: 50 })}
                      onChange={(e) => handleLiveUpdate('properties.gap_y', parseInt(e.target.value) || 6)}
                      className="input-field w-full"
                      placeholder="6"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Gap X (pt)</label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      {...register('properties.gap_x', { min: 0, max: 50 })}
                      onChange={(e) => handleLiveUpdate('properties.gap_x', parseInt(e.target.value) || 0)}
                      className="input-field w-full"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Item Height (pt)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      {...register('properties.item_height')}
                      onChange={(e) => {
                        const v = e.target.value;
                        // Allow empty to auto-calc; otherwise number
                        handleLiveUpdate('properties.item_height', v === '' ? '' : (parseFloat(v) || 0));
                      }}
                      className="input-field w-full"
                      placeholder="Leave empty to auto-calc"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Link Template</label>
                  <input
                    type="text"
                    {...register('properties.bind')}
                    onChange={(e) => handleLiveUpdate('properties.bind', e.target.value)}
                    className="input-field w-full"
                    placeholder="notes(@index)"
                  />
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                    <div className="font-medium text-blue-800 mb-1">Destination Preview:</div>
                    {selectedWidget.properties?.bind ? (
                      <div className="space-y-1">
                        <div className="text-blue-700">
                          <span className="font-mono bg-white px-1 rounded border">
                            {selectedWidget.properties.bind}
                          </span>
                          <span className="mx-2">→</span>
                          <span className="font-mono bg-white px-1 rounded border text-green-700">
                            {generateDestinationPreview(selectedWidget.properties.bind)}
                          </span>
                        </div>
                        <div className="text-blue-600 mt-1">
                          Create anchors with: <code className="bg-white px-1 rounded border">dest_id: "{generateAnchorTemplate(selectedWidget.properties.bind)}"</code>
                        </div>
                      </div>
                    ) : (
                      <div className="text-blue-600 italic">Enter a link template to see generated destinations</div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Label Template</label>
                  <input
                    type="text"
                    {...register('properties.label_template')}
                    onChange={(e) => handleLiveUpdate('properties.label_template', e.target.value)}
                    className="input-field w-full"
                    placeholder="@index"
                  />
                  <p className="text-xs text-eink-light-gray mt-1">
                    Template for link display text. Use @index for numbers, @index_date for dates.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Highlight (Index or Token)</label>
                  <input
                    type="text"
                    {...register('properties.highlight_index')}
                    onChange={(e) => handleLiveUpdate('properties.highlight_index', e.target.value)}
                    className="input-field w-full"
                    placeholder="e.g., 2 or {month}"
                  />
                  <p className="text-xs text-eink-light-gray mt-1">
                    Accepts a number (e.g., 3) or a token like {"{month}"} resolved during compilation.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Highlight Color (optional)</label>
                  <div className="flex space-x-2">
                    <input
                      type="color"
                      {...register('properties.highlight_color')}
                      onChange={(e) => handleLiveUpdate('properties.highlight_color', e.target.value)}
                      className="w-12 h-10 border border-eink-pale-gray rounded cursor-pointer"
                      title="Choose highlight color"
                      value={(selectedWidget.properties && (selectedWidget as any).properties.highlight_color) || '#cccccc'}
                    />
                    <input
                      type="text"
                      {...register('properties.highlight_color')}
                      onChange={(e) => handleLiveUpdate('properties.highlight_color', e.target.value)}
                      className="input-field w-full"
                      placeholder="#CCCCCC"
                    />
                    <button
                      type="button"
                      onClick={() => handleLiveUpdate('properties.highlight_color', '')}
                      className="px-3 py-2 text-xs border border-eink-pale-gray rounded hover:bg-eink-pale-gray"
                    >
                      Clear
                    </button>
                  </div>
                  <p className="text-xs text-eink-light-gray mt-1">If empty, a readable gray is used.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Background Color (optional)</label>
                  <div className="flex space-x-2">
                    <input
                      type="color"
                      {...register('properties.background_color')}
                      onChange={(e) => handleLiveUpdate('properties.background_color', e.target.value)}
                      className="w-12 h-10 border border-eink-pale-gray rounded cursor-pointer"
                      title="Choose background color"
                      value={(selectedWidget.properties && (selectedWidget as any).properties.background_color) || '#ffffff'}
                    />
                    <input
                      type="text"
                      {...register('properties.background_color')}
                      onChange={(e) => handleLiveUpdate('properties.background_color', e.target.value)}
                      className="input-field w-full"
                      placeholder="#FFFFFF"
                    />
                    <button
                      type="button"
                      onClick={() => handleLiveUpdate('properties.background_color', '')}
                      className="px-3 py-2 text-xs border border-eink-pale-gray rounded hover:bg-eink-pale-gray"
                    >
                      Clear
                    </button>
                  </div>
                  <p className="text-xs text-eink-light-gray mt-1">Background color for non-highlighted items. If empty, transparent is used.</p>
                </div>
              </div>
            </div>
          )}

          {/* Checkbox Behavior */}
          {selectedWidget.type === 'checkbox' && (
            <div>
              <h4 className="font-medium mb-3">Behavior</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Checkbox Size (pt)</label>
                  <input
                    type="number"
                    min="4"
                    max="100"
                    {...register('properties.checkbox_size', { min: 4, max: 100 })}
                    onChange={(e) => handleLiveUpdate('properties.checkbox_size', parseInt(e.target.value) || 16)}
                    className="input-field w-full"
                  />
                  <p className="text-xs text-eink-light-gray mt-1">
                    Checkbox size in points. Size shown in preview matches PDF output exactly.
                  </p>
                </div>
              </div>
            </div>
          )}


          {/* Lines Behavior */}
          {selectedWidget.type === 'lines' && (
            <div>
              <h4 className="font-medium mb-3">Behavior</h4>
              <div className="space-y-3">
                <div>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => {
                      // Apply Cornell Notes preset: left cue column ~25%, summary area ~120pt
                      const width = selectedWidget?.position?.width || 400;
                      const height = selectedWidget?.position?.height || 300;
                      const bottomPadding = 120;
                      const spacing = 18;
                      const count = Math.max(3, Math.floor((height - bottomPadding - (selectedWidget?.properties?.top_padding || 0)) / spacing));
                      handleLiveUpdate('properties.line_style', 'solid');
                      handleLiveUpdate('properties.vertical_guides', [0.25]);
                      handleLiveUpdate('properties.bottom_padding', bottomPadding);
                      handleLiveUpdate('properties.line_spacing', spacing);
                      handleLiveUpdate('properties.line_count', count);
                      handleLiveUpdate('properties.columns', 0);
                    }}
                  >
                    Apply Cornell Notes Preset
                  </button>
                  <p className="text-xs text-eink-light-gray mt-1">Adds a left cue column and bottom summary area</p>
                </div>
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
                {selectedWidget.properties?.line_style === 'grid' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Grid Spacing (pt)</label>
                    <input
                      type="number"
                      min="5"
                      max="200"
                      {...register('properties.grid_spacing', { min: 5, max: 200 })}
                      onChange={(e) => handleLiveUpdate('properties.grid_spacing', parseInt(e.target.value) || 20)}
                      className="input-field w-full"
                      placeholder="20"
                    />
                  </div>
                )}
                {selectedWidget.properties?.line_style !== 'grid' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Columns (guides)</label>
                    <input
                      type="number"
                      min="0"
                      max="12"
                      {...register('properties.columns', { min: 0, max: 15 })}
                      onChange={(e) => handleLiveUpdate('properties.columns', parseInt(e.target.value) || 0)}
                      className="input-field w-full"
                      placeholder="0"
                    />
                    <p className="text-xs text-eink-light-gray mt-1">Draw vertical guides splitting the area into equal columns</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Properties (for tap_zone) */}
          {selectedWidget.type === 'tap_zone' && (
            <div>
              <h4 className="font-medium mb-3">Tap Zone</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Action</label>
                  <select
                    {...register('properties.tap_action')}
                    onChange={(e) => handleLiveUpdate('properties.tap_action', e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="page_link">Go to Page</option>
                    <option value="destination_link">Go to Destination</option>
                    <option value="prev_page">Previous Page</option>
                    <option value="next_page">Next Page</option>
                  </select>
                </div>
                {(selectedWidget.properties?.tap_action === 'page_link' || !selectedWidget.properties?.tap_action) && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Target Page</label>
                    <input
                      type="number"
                      min="1"
                      {...register('properties.target_page', { min: 1 })}
                      onChange={(e) => handleLiveUpdate('properties.target_page', parseInt(e.target.value) || 1)}
                      className="input-field w-full"
                      placeholder="2"
                    />
                  </div>
                )}
                {selectedWidget.properties?.tap_action === 'destination_link' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Bind (Destination)</label>
                    <input
                      type="text"
                      {...register('properties.bind')}
                      onChange={(e) => handleLiveUpdate('properties.bind', e.target.value)}
                      className="input-field w-full"
                      placeholder="e.g., day(@date) or notes(@index)"
                    />
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                      <div className="font-medium text-blue-800 mb-1">Destination Preview:</div>
                      {selectedWidget.properties?.bind ? (
                        <div className="space-y-1">
                          <div className="text-blue-700">
                            <span className="font-mono bg-white px-1 rounded border">
                              {selectedWidget.properties.bind}
                            </span>
                            <span className="mx-2">→</span>
                            <span className="font-mono bg-white px-1 rounded border text-green-700">
                              {generateDestinationPreview(selectedWidget.properties.bind)}
                            </span>
                          </div>
                          <div className="text-blue-600 mt-1">
                            Create anchors with: <code className="bg-white px-1 rounded border">dest_id: "{generateAnchorTemplate(selectedWidget.properties.bind)}"</code>
                          </div>
                        </div>
                      ) : (
                        <div className="text-blue-600 italic">Enter a bind template to see generated destinations</div>
                      )}
                    </div>
                  </div>
                )}
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...register('properties.outline')}
                    onChange={(e) => handleLiveUpdate('properties.outline', e.target.checked)}
                    className="rounded border-eink-pale-gray"
                  />
                  <span className="text-sm">Show outline in editor</span>
                </label>
              </div>
            </div>
          )}

          {/* Internal Link Properties */}
          {selectedWidget.type === 'internal_link' && (
            <div>
              <h4 className="font-medium mb-3">Internal Link</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Orientation</label>
                  <select
                    {...register('properties.orientation')}
                    onChange={(e) => handleLiveUpdate('properties.orientation', e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="horizontal">Horizontal (0°)</option>
                    <option value="vertical">Vertical (90°)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Link Text</label>
                  <input
                    type="text"
                    {...register('content')}
                    onChange={(e) => handleLiveUpdate('content', e.target.value)}
                    className="input-field w-full"
                    placeholder="Link label"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Font</label>
                    <select {...register('styling.font')} onChange={(e) => handleLiveUpdate('styling.font', e.target.value)} className="input-field w-full">
                      {fontOptions.map(f => (<option key={f} value={f}>{f}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Size (pt)</label>
                    <input
                      type="number"
                      min={6}
                      max={48}
                      {...register('styling.size', { min: 6, max: 48 })}
                      onChange={(e) => handleLiveUpdate('styling.size', parseInt(e.target.value) || 12)}
                      className="input-field w-full"
                      placeholder="12"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Color</label>
                    <input type="color" {...register('styling.color')} onChange={(e) => handleLiveUpdate('styling.color', e.target.value)} className="w-full h-10 border border-eink-pale-gray rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Text Align</label>
                    <select {...register('styling.text_align')} onChange={(e) => handleLiveUpdate('styling.text_align', e.target.value)} className="input-field w-full">
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Bind (Destination)</label>
                  <input
                    type="text"
                    {...register('properties.bind')}
                    onChange={(e) => handleLiveUpdate('properties.bind', e.target.value)}
                    className="input-field w-full"
                    placeholder="e.g., day(@date) or notes(@index)"
                  />
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                    <div className="font-medium text-blue-800 mb-1">Destination Preview:</div>
                    {selectedWidget.properties?.bind ? (
                      <div className="space-y-1">
                        <div className="text-blue-700">
                          <span className="font-mono bg-white px-1 rounded border">
                            {selectedWidget.properties.bind}
                          </span>
                          <span className="mx-2">→</span>
                          <span className="font-mono bg-white px-1 rounded border text-green-700">
                            {generateDestinationPreview(selectedWidget.properties.bind)}
                          </span>
                        </div>
                        <div className="text-blue-600 mt-1">
                          Create anchors with: <code className="bg-white px-1 rounded border">dest_id: "{generateAnchorTemplate(selectedWidget.properties.bind)}"</code>
                        </div>
                      </div>
                    ) : (
                      <div className="text-blue-600 italic">Enter a bind template to see generated destinations</div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Or Destination ID</label>
                  <input
                    type="text"
                    {...register('properties.to_dest')}
                    onChange={(e) => handleLiveUpdate('properties.to_dest', e.target.value)}
                    className="input-field w-full"
                    placeholder="e.g., day:2026-01-01"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Properties (for image) */}
          {selectedWidget.type === 'image' && (
            <div>
              <h4 className="font-medium mb-3">Image</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Image Source</label>
                  <input
                    {...register('properties.image_src')}
                    onChange={(e) => handleLiveUpdate('properties.image_src', e.target.value)}
                    className="input-field w-full"
                    placeholder="/assets/logo.png or data:image/png;base64,..."
                  />
                  <p className="text-xs text-eink-light-gray mt-1">
                    Supports relative/absolute URLs or data URIs
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <input
                      id="image-file-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        // Optimization options
                        const props = selectedWidget.properties || {} as any;
                        const optimize = props.optimize_on_import !== false; // default true
                        const maxPx = Math.max(256, Math.min(4096, props.max_image_px || 1600));
                        const doGray = !!props.grayscale_on_import;
                        const quality = Math.max(0.5, Math.min(0.95, props.image_quality || 0.8));

                        const process = (img: HTMLImageElement) => {
                          const srcW = img.naturalWidth || img.width;
                          const srcH = img.naturalHeight || img.height;
                          let drawW = srcW;
                          let drawH = srcH;
                          if (optimize) {
                            const scale = Math.min(1, maxPx / Math.max(srcW, srcH));
                            drawW = Math.max(1, Math.round(srcW * scale));
                            drawH = Math.max(1, Math.round(srcH * scale));
                          }
                          const canvas = document.createElement('canvas');
                          canvas.width = drawW; canvas.height = drawH;
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return;
                          // Paint white background to avoid transparency issues in JPEG
                          ctx.fillStyle = '#ffffff';
                          ctx.fillRect(0, 0, drawW, drawH);
                          ctx.drawImage(img, 0, 0, drawW, drawH);
                          if (doGray) {
                            const imgData = ctx.getImageData(0, 0, drawW, drawH);
                            const data = imgData.data;
                            for (let i = 0; i < data.length; i += 4) {
                              const r = data[i], g = data[i+1], b = data[i+2];
                              // Luminance (BT.601)
                              const y = Math.round(0.299*r + 0.587*g + 0.114*b);
                              data[i] = data[i+1] = data[i+2] = y;
                            }
                            ctx.putImageData(imgData, 0, 0);
                          }
                          const dataUrl = canvas.toDataURL('image/jpeg', quality);
                          handleLiveUpdate('properties.image_src', dataUrl);
                        };

                        const img = new Image();
                        img.onload = () => { URL.revokeObjectURL(img.src); process(img); };
                        img.onerror = () => {
                          // Fallback: read as data URL without processing
                          const reader = new FileReader();
                          reader.onload = () => handleLiveUpdate('properties.image_src', reader.result as string);
                          reader.readAsDataURL(file);
                        };
                        img.src = URL.createObjectURL(file);
                      }}
                    />
                    <label htmlFor="image-file-input" className="btn-secondary cursor-pointer text-xs">
                      Choose Image...
                    </label>
                    {selectedWidget.properties?.image_src && (
                      <button
                        type="button"
                        className="text-xs text-red-700 border border-red-200 px-2 py-1 rounded hover:bg-red-50"
                        onClick={() => handleLiveUpdate('properties.image_src', '')}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fit</label>
                  <select
                    {...register('properties.image_fit')}
                    onChange={(e) => handleLiveUpdate('properties.image_fit', e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="fit">Fit (contain)</option>
                    <option value="stretch">Stretch</option>
                    <option value="actual">Actual size (top-left)</option>
                  </select>
                </div>
                <div>
                  <h5 className="font-medium mb-2">Optimization</h5>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        {...register('properties.optimize_on_import')}
                        onChange={(e) => handleLiveUpdate('properties.optimize_on_import', e.target.checked)}
                        className="rounded border-eink-pale-gray"
                        defaultChecked
                      />
                      <span className="text-sm">Optimize on import (size/quality)</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Max Size (px)</label>
                        <input
                          type="number"
                          min={256}
                          max={4096}
                          {...register('properties.max_image_px')}
                          onChange={(e) => handleLiveUpdate('properties.max_image_px', parseInt(e.target.value) || 1600)}
                          className="input-field w-full"
                          placeholder="1600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">JPEG Quality</label>
                        <input
                          type="number"
                          step={0.05}
                          min={0.5}
                          max={0.95}
                          {...register('properties.image_quality')}
                          onChange={(e) => handleLiveUpdate('properties.image_quality', parseFloat(e.target.value) || 0.8)}
                          className="input-field w-full"
                          placeholder="0.8"
                        />
                      </div>
                    </div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        {...register('properties.grayscale_on_import')}
                        onChange={(e) => handleLiveUpdate('properties.grayscale_on_import', e.target.checked)}
                        className="rounded border-eink-pale-gray"
                      />
                      <span className="text-sm">Convert to grayscale on import</span>
                    </label>
                  </div>
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
                  <label className="block text-sm font-medium mb-1">Destination ID</label>
                  <input
                    type="text"
                    {...register('properties.dest_id')}
                    onChange={(e) => handleLiveUpdate('properties.dest_id', e.target.value)}
                    className="input-field w-full"
                    placeholder="e.g., notes:page:{index_padded} or day:2026-01-01"
                  />
                  {/* Lint: warn if '@' used in dest_id (IDs must not contain @) */}
                  {selectedWidget.properties?.dest_id?.includes?.('@') && (
                    <p className="text-xs mt-1 text-red-600">
                      Destination IDs cannot contain '@'. Use tokens like {'{year}'} in dest_id, and use @vars only inside bind(...).
                    </p>
                  )}
                  <p className="text-xs text-eink-light-gray mt-1">
                    Named destination for internal links (used during compile)
                  </p>
                </div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedWidget.properties?.outline !== false}
                    onChange={(e) => handleLiveUpdate('properties.outline', e.target.checked)}
                    className="rounded border-eink-pale-gray"
                  />
                  <span className="text-sm">Show outline in editor</span>
                </label>
              </div>
            </div>
          )}

          {/* Calendar Widget Properties */}
          {/* Styling (for calendar) */}
          {selectedWidget.type === 'calendar' && (
            <div>
              <h4 className="font-medium mb-3">Calendar Options</h4>
              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...register('properties.show_trailing_days')}
                    onChange={(e) => handleLiveUpdate('properties.show_trailing_days', e.target.checked)}
                    className="rounded border-eink-pale-gray"
                  />
                  <span className="text-sm">Show trailing/leading days</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      {...register('properties.highlight_today')}
                      onChange={(e) => handleLiveUpdate('properties.highlight_today', e.target.checked)}
                      className="rounded border-eink-pale-gray"
                    />
                    <span className="text-sm">Highlight today</span>
                  </label>
                  <div>
                    <label className="block text-sm font-medium mb-1">Highlight Date (YYYY-MM-DD)</label>
                    <input
                      {...register('properties.highlight_date')}
                      onChange={(e) => handleLiveUpdate('properties.highlight_date', e.target.value)}
                      className="input-field w-full"
                      placeholder="Optional fixed date"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Weekday Labels</label>
                    <select
                      {...register('properties.weekday_label_style')}
                      onChange={(e) => handleLiveUpdate('properties.weekday_label_style', e.target.value)}
                      className="input-field w-full"
                    >
                      <option value="short">Mon</option>
                      <option value="narrow">M</option>
                      <option value="full">Monday</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Week Numbers</label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        {...register('properties.week_numbers')}
                        onChange={(e) => handleLiveUpdate('properties.week_numbers', e.target.checked)}
                        className="rounded border-eink-pale-gray"
                      />
                      <span className="text-sm">Show ISO week numbers</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cell Padding (pt)</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    {...register('properties.cell_padding', { min: 0, max: 20 })}
                    onChange={(e) => handleLiveUpdate('properties.cell_padding', parseFloat(e.target.value) || 4)}
                    className="input-field w-full"
                    placeholder="4"
                  />
                </div>
                {selectedWidget.properties?.calendar_type === 'weekly' && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Weekly Layout</h4>
                    <div>
                      <label className="block text-sm font-medium mb-1">Layout Orientation</label>
                      <select
                        {...register('properties.layout_orientation')}
                        onChange={(e) => handleLiveUpdate('properties.layout_orientation', e.target.value)}
                        className="input-field w-full"
                      >
                        <option value="horizontal">Horizontal (days as columns)</option>
                        <option value="vertical">Vertical (days as rows)</option>
                      </select>
                    </div>
                    <h4 className="font-medium">Weekly Time Grid</h4>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        {...register('properties.show_time_grid')}
                        onChange={(e) => handleLiveUpdate('properties.show_time_grid', e.target.checked)}
                        className="rounded border-eink-pale-gray"
                      />
                      <span className="text-sm">Show time grid</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Start Hour</label>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          {...register('properties.time_start_hour')}
                          onChange={(e) => handleLiveUpdate('properties.time_start_hour', parseInt(e.target.value) || 8)}
                          className="input-field w-full"
                          placeholder="8"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">End Hour</label>
                        <input
                          type="number"
                          min="1"
                          max="24"
                          {...register('properties.time_end_hour')}
                          onChange={(e) => handleLiveUpdate('properties.time_end_hour', parseInt(e.target.value) || 20)}
                          className="input-field w-full"
                          placeholder="20"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Slot Minutes</label>
                        <input
                          type="number"
                          min="5"
                          max="120"
                          {...register('properties.time_slot_minutes')}
                          onChange={(e) => handleLiveUpdate('properties.time_slot_minutes', parseInt(e.target.value) || 60)}
                          className="input-field w-full"
                          placeholder="60"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Label Every (min)</label>
                        <input
                          type="number"
                          min="5"
                          max="240"
                          {...register('properties.time_label_interval')}
                          onChange={(e) => handleLiveUpdate('properties.time_label_interval', parseInt(e.target.value) || 60)}
                          className="input-field w-full"
                          placeholder="60"
                        />
                      </div>
                    </div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        {...register('properties.show_time_gutter')}
                        onChange={(e) => handleLiveUpdate('properties.show_time_gutter', e.target.checked)}
                        className="rounded border-eink-pale-gray"
                      />
                      <span className="text-sm">Show time labels gutter</span>
                    </label>
                  </div>
                )}
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
                    type="text"
                    {...register('properties.start_date')}
                    onChange={(e) => handleLiveUpdate('properties.start_date', e.target.value)}
                    className="input-field w-full"
                    placeholder="YYYY-MM-DD or tokens like {year}-{month_padded}-01"
                  />
                  <p className="text-xs text-eink-light-gray mt-1">
                    Accepts exact date (YYYY-MM-DD) or tokens: {'{year}'}, {'{month_padded}'}, {'{day_padded}'}
                  </p>
                </div>

                {selectedWidget.properties?.calendar_type === 'custom_range' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="text"
                    {...register('properties.end_date')}
                    onChange={(e) => handleLiveUpdate('properties.end_date', e.target.value)}
                    className="input-field w-full"
                    placeholder="YYYY-MM-DD or tokens"
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
                    <option value="sequential_pages">Sequential Pages (Page_N bookmarks)</option>
                    <option value="named_destinations">Named Destinations (requires day anchors)</option>
                  </select>
                  <p className="text-xs text-eink-light-gray mt-1">
                    Sequential Pages links to bookmarks like Page_2. Named Destinations expects an Anchor on day pages with dest_id "day:{'{'}date{'}'}".
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
                        {...register('properties.pages_per_date', { min: 1, max: 15 })}
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

                {/* Named destination strategy removed; pages-only model */}

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

          {/* Navigation options removed in pages-only model */}

          {/* 5. ADVANCED - Optional technical settings */}
          <div>
            <h4 className="font-medium mb-3">Advanced</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Page (Optional - auto-assigned during compilation)</label>
                <input
                  type="number"
                  min="1"
                  {...register('page', { min: 1 })}
                  onChange={(e) => handleLiveUpdate('page', parseInt(e.target.value) || undefined)}
                  className="input-field w-full"
                  placeholder="Leave blank for master templates"
                />
                <p className="text-xs text-eink-light-gray mt-1">
                  Page number for multi-page documents. Usually left blank for master templates as it gets assigned automatically during compilation.
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
