/**
 * Base property panel component with common widget editing functionality.
 *
 * Provides consistent layout and shared controls for all widget types.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { Settings, Type, Square, Minus, AlignJustify, Anchor, Trash2, Table } from 'lucide-react';
import { Widget } from '@/types';
import ColorPicker from './shared/ColorPicker';
import NumberInput from './shared/NumberInput';
import FontSelector from './shared/FontSelector';
import SelectInput from './shared/SelectInput';

interface BasePropertyPanelProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
  onRemove: () => void;
  children?: React.ReactNode;
}

const getWidgetIcon = (type: string) => {
  switch (type) {
    case 'text_block': return Type;
    case 'checkbox': return Square;
    case 'divider': return Minus;
    case 'lines': return AlignJustify;
    case 'anchor': return Anchor;
    case 'internal_link': return Anchor;
    case 'table': return Table;
    default: return Settings;
  }
};

const BasePropertyPanel: React.FC<BasePropertyPanelProps> = ({
  widget,
  onUpdate,
  onRemove,
  children
}) => {
  const Icon = getWidgetIcon(widget.type);

  const updatePosition = (field: keyof Widget['position'], value: number) => {
    onUpdate({
      position: {
        ...widget.position,
        [field]: value
      }
    });
  };

  const updateStyling = (field: string, value: any) => {
    onUpdate({
      styling: {
        ...widget.styling,
        [field]: value
      }
    });
  };

  const hasTextStyling = [
    'text_block', 'checkbox', 'internal_link',
    'calendar', 'link_list', 'table'
  ].includes(widget.type);

  const textAlignOptions = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' }
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-eink-pale-gray">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon className="w-5 h-5 text-eink-dark-gray" />
            <h3 className="font-semibold text-lg">
              {widget.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h3>
          </div>
          <button
            onClick={onRemove}
            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete widget"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Position */}
        <div>
          <h4 className="font-medium mb-3">Position & Size</h4>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="X"
              value={widget.position.x}
              onChange={(value) => updatePosition('x', value)}
              unit="pt"
            />
            <NumberInput
              label="Y"
              value={widget.position.y}
              onChange={(value) => updatePosition('y', value)}
              unit="pt"
            />
            <NumberInput
              label="Width"
              value={widget.position.width}
              onChange={(value) => updatePosition('width', value)}
              min={1}
              unit="pt"
            />
            <NumberInput
              label="Height"
              value={widget.position.height}
              onChange={(value) => updatePosition('height', value)}
              min={1}
              unit="pt"
            />
          </div>
        </div>

        {/* Background Color */}
        <ColorPicker
          label="Background Color"
          value={widget.background_color || ''}
          onChange={(value) => onUpdate({ background_color: value })}
          defaultValue="transparent"
          helpText="Widget background color (transparent if empty)"
        />

        {/* Text Styling */}
        {hasTextStyling && (
          <div>
            <h4 className="font-medium mb-3">Text Styling</h4>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FontSelector
                  label="Font"
                  value={widget.styling?.font || 'Helvetica'}
                  onChange={(value) => updateStyling('font', value)}
                />
                <NumberInput
                  label="Size"
                  value={widget.styling?.size || 12}
                  onChange={(value) => updateStyling('size', value)}
                  min={widget.type === 'calendar' ? 6 : 8}
                  max={widget.type === 'calendar' ? 24 : 72}
                  unit="pt"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ColorPicker
                  label="Text Color"
                  value={widget.styling?.color || '#000000'}
                  onChange={(value) => updateStyling('color', value)}
                />
                <SelectInput
                  label="Alignment"
                  value={widget.styling?.text_align || 'left'}
                  onChange={(value) => updateStyling('text_align', value)}
                  options={textAlignOptions}
                />
              </div>
            </div>
          </div>
        )}

        {/* Content Input */}
        {widget.type === 'text_block' && (
          <div>
            <label className="block text-sm font-medium mb-1">
              Content
            </label>
            <textarea
              value={widget.content || ''}
              onChange={(e) => onUpdate({ content: e.target.value })}
              placeholder="Enter text content..."
              rows={3}
              className="w-full px-3 py-2 border border-eink-pale-gray rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-eink-blue"
            />
          </div>
        )}

        {/* Widget-specific properties */}
        {children}
      </div>
    </div>
  );
};

export default BasePropertyPanel;