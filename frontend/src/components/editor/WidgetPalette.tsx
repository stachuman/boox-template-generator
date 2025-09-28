/**
 * Widget palette for drag-and-drop widget creation.
 * 
 * Provides a palette of available widget types that can be dragged onto the canvas.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React from 'react';
import { useDrag } from 'react-dnd';
import { Type, Square, Minus, AlignJustify, Anchor, Calendar, MoveVertical } from 'lucide-react';
import clsx from 'clsx';

interface WidgetType {
  type: 'text_block' | 'checkbox' | 'divider' | 'vertical_line' | 'lines' | 'anchor' | 'internal_link' | 'calendar' | 'tap_zone' | 'image' | 'link_list' | 'box';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  defaultProps: {
    content?: string;
    position: {
      width: number;
      height: number;
    };
    styling?: any;
    properties?: any;
  };
}

const WIDGET_TYPES: WidgetType[] = [
  {
    type: 'box',
    label: 'Box (Rect)',
    icon: Square,
    description: 'Background block with border and optional link',
    defaultProps: {
      position: { width: 240, height: 120 },
      properties: {
        fill_color: '#FFFFFF',
        stroke_color: '#000000',
        stroke_width: 1,
        corner_radius: 0,
        opacity: 1.0
      }
    }
  },
  {
    type: 'text_block',
    label: 'Text Block',
    icon: Type,
    description: 'Static text with styling options',
    defaultProps: {
      content: 'Text Block',
      position: { width: 200, height: 30 },
      styling: {
        font: 'Helvetica',
        size: 12,
        color: '#000000'
      },
      properties: {
        orientation: 'horizontal'
      }
    }
  },
  {
    type: 'link_list',
    label: 'Link List',
    icon: AlignJustify,
    description: 'Composite list of internal links (auto layout)',
    defaultProps: {
      position: { width: 320, height: 160 },
      styling: {
        font: 'Helvetica',
        size: 12,
        color: '#0066CC'
      },
      properties: {
        count: 10,
        start_index: 1,
        index_pad: 3,
        columns: 2,
        gap_y: 6,
        item_height: 24,
        label_template: 'Note {index_padded}',
        bind: 'notes(@index)',
        orientation: 'horizontal'
      }
    }
  },
  {
    type: 'image',
    label: 'Image',
    icon: Square,
    description: 'Place PNG/JPEG (fit/stretch/actual size)',
    defaultProps: {
      content: '',
      position: { width: 200, height: 120 },
      properties: {
        image_src: '',
        image_fit: 'fit'
      }
    }
  },
  {
    type: 'tap_zone',
    label: 'Tap Zone',
    icon: Anchor,
    description: 'Invisible link area (prev/next/page/destination)',
    defaultProps: {
      content: '',
      position: { width: 120, height: 48 },
      properties: {
        tap_action: 'page_link',
        target_page: 2,
        outline: true
      }
    }
  },
  {
    type: 'text_block',
    label: 'Header Text',
    icon: Type,
    description: 'Top banner; supports {page} token',
    defaultProps: {
      content: 'Header — Page {page} of {total_pages}',
      position: { width: 400, height: 24 },
      styling: {
        font: 'Helvetica',
        size: 12,
        color: '#000000'
      }
    }
  },
  {
    type: 'text_block',
    label: 'Footer Text',
    icon: Type,
    description: 'Bottom banner; supports {page} token',
    defaultProps: {
      content: '© {page}/{total_pages}',
      position: { width: 200, height: 20 },
      styling: {
        font: 'Helvetica',
        size: 10,
        color: '#000000'
      }
    }
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    icon: Square,
    description: 'Interactive checkbox with label',
    defaultProps: {
      content: 'Checkbox Label',
      position: { width: 150, height: 20 },
      styling: {
        font: 'Courier-Prime',
        size: 10,
        color: '#000000'
      },
      properties: {
        checkbox_size: 12
      }
    }
  },
  {
    type: 'divider',
    label: 'Divider',
    icon: Minus,
    description: 'Horizontal line separator',
    defaultProps: {
      position: { width: 300, height: 2 },
      properties: {
        line_thickness: 1.0,
        stroke_color: '#000000'
      }
    }
  },
  {
    type: 'vertical_line',
    label: 'Vertical Line',
    icon: MoveVertical,
    description: 'Vertical separator line',
    defaultProps: {
      position: { width: 2, height: 200 },
      properties: {
        line_thickness: 1.0,
        stroke_color: '#000000'
      }
    }
  },
  {
    type: 'lines',
    label: 'Lines & Grids',
    icon: AlignJustify,
    description: 'Ruled lines, dotted, dashed, or grid patterns',
    defaultProps: {
      position: { width: 400, height: 200 },
      properties: {
        line_style: 'solid',
        line_spacing: 20,
        line_count: 10,
        line_thickness: 0.75,
        margin_left: 0,
        margin_right: 0
      }
    }
  },
  {
    type: 'anchor',
    label: 'Anchor (Destination)',
    icon: Anchor,
    description: 'Named destination marker (invisible)',
    defaultProps: {
      content: '',
      position: { width: 1, height: 1 },
      properties: {
        dest_id: 'day:2026-01-01'
      }
    }
  },
  {
    type: 'internal_link',
    label: 'Internal Link',
    icon: Anchor,
    description: 'Text link to a named destination',
    defaultProps: {
      content: 'Internal Link',
      position: { width: 140, height: 24 },
      styling: {
        font: 'Patrick-Hand',
        size: 12,
        color: '#0066CC'
      },
      properties: {
        to_dest: 'notes:index',
        orientation: 'horizontal'
      }
    }
  },
  {
    type: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    description: 'Interactive calendar with date navigation',
    defaultProps: {
      content: '',  // Calendar generates its own content
      position: { width: 280, height: 200 },  // Standard monthly calendar size
      styling: {
        font: 'Patrick-Hand',
        size: 10,
        color: '#000000'
      },
      properties: {
        calendar_type: 'monthly',
        start_date: new Date().toISOString().split('T')[0],  // Today's date in YYYY-MM-DD
        link_strategy: 'sequential_pages',
        first_page_number: 2,     // Start from page 2 (page 1 might be calendar index)
        pages_per_date: 1,        // One page per day
        show_weekdays: true,
        show_month_year: true,
        cell_min_size: 44,        // E-ink touch target minimum
        show_grid_lines: true,
        first_day_of_week: 'monday'  // European default (Monday first)
      }
    }
  }
];

interface DraggableWidgetProps {
  widgetType: WidgetType;
}

const DraggableWidget: React.FC<DraggableWidgetProps> = ({ widgetType }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'WIDGET',
    item: {
      type: 'WIDGET',
      widgetType: widgetType.type,
      defaultProps: widgetType.defaultProps,
      isNew: true
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });

  const Icon = widgetType.icon;

  return (
    <div
      ref={drag}
      className={clsx(
        'p-3 border border-eink-pale-gray rounded-lg cursor-move hover:bg-eink-off-white transition-colors',
        isDragging && 'opacity-50'
      )}
    >
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-eink-pale-gray rounded">
          <Icon className="w-4 h-4 text-eink-dark-gray" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{widgetType.label}</h4>
          <p className="text-xs text-eink-gray truncate">{widgetType.description}</p>
        </div>
      </div>
    </div>
  );
};

const WidgetPalette: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-eink-pale-gray">
        <h3 className="font-semibold">Widget Palette</h3>
        <p className="text-sm text-eink-gray">Drag widgets onto the canvas</p>
      </div>
      
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {WIDGET_TYPES.map((widgetType) => (
          <DraggableWidget key={widgetType.type} widgetType={widgetType} />
        ))}
      </div>
      
      <div className="p-4 border-t border-eink-pale-gray">
        <div className="text-xs text-eink-light-gray space-y-1">
          <p>• Drag widgets to the canvas</p>
          <p>• Click to select and edit</p>
          <p>• Delete with keyboard key</p>
        </div>
      </div>
    </div>
  );
};

export default WidgetPalette;
