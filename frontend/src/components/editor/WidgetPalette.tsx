/**
 * Widget palette for drag-and-drop widget creation.
 *
 * Provides a palette of available widget types that can be dragged onto the canvas.
 * Organized into collapsible groups for better discoverability.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

import React, { useState, useEffect } from 'react';
import { useDrag } from 'react-dnd';
import { Type, Square, Minus, AlignJustify, Anchor, Calendar, MoveVertical, Table, Grid3x3, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface WidgetType {
  id: string; // Unique identifier for React keys
  type: 'text_block' | 'checkbox' | 'divider' | 'vertical_line' | 'lines' | 'dot_grid' | 'anchor' | 'internal_link' | 'calendar' | 'day_list' | 'tap_zone' | 'image' | 'link_list' | 'box' | 'table';
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

interface WidgetGroup {
  id: string;
  label: string;
  widgets: WidgetType[];
}

const ALL_WIDGETS: WidgetType[] = [
  {
    id: 'text_block',
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
    id: 'header_text',
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
    id: 'footer_text',
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
    id: 'checkbox',
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
        box_size: 12
      }
    }
  },
  {
    id: 'internal_link',
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
    id: 'anchor',
    type: 'anchor',
    label: 'Anchor (Destination)',
    icon: Anchor,
    description: 'Named destination marker (invisible)',
    defaultProps: {
      content: '',
      position: { width: 100, height: 30 },
      properties: {
        dest_id: 'day:2026-01-01'
      }
    }
  },
  {
    id: 'link_list',
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
        bind: 'notes:{index}',
        orientation: 'horizontal'
      }
    }
  },
   
  {
    id: 'tap_zone',
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
    id: 'calendar',
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
  },

  {
    id: 'day_list',
    type: 'day_list',
    label: 'Day List',
    icon: AlignJustify,
    description: 'Vertical monthly day list with notes space',
    defaultProps: {
      content: '',  // Day list generates its own content
      position: { width: 320, height: 400 },  // ~20 days at 20px row height
      styling: {
        font: 'Helvetica',
        size: 10,
        color: '#000000'
      },
      properties: {
        start_date: '{year}-{month}-01',  // Token for first day of current month
        row_height: 20,
        show_day_numbers: true,
        show_weekday_names: true,
        weekday_format: 'short',
        show_notes_lines: true,
        notes_line_count: 1,
        highlight_weekends: false,
        weekend_color: '#F0F0F0',
        first_day_of_week: 'monday',
        link_strategy: 'no_links',
        orientation: 'horizontal',
        show_month_header: false,
        show_year_in_header: false,
        month_name_format: 'long'
      }
    }
  },

  {
    id: 'box',
    type: 'box',
    label: 'Box (Rect)',
    icon: Square,
    description: 'Background block with border and optional link',
    defaultProps: {
      position: { width: 240, height: 120 },
      styling: {
        fill_color: '#FFFFFF',
        stroke_color: '#000000',
        line_width: 1
      },
      properties: {
        corner_radius: 0,
        opacity: 1.0
      }
    }
  },

  {
    id: 'image',
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
    id: 'divider',
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
    id: 'vertical_line',
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
    id: 'lines',
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
    id: 'dot_grid',
    type: 'dot_grid',
    label: 'Dot Grid',
    icon: Grid3x3,
    description: 'Evenly-spaced dot grid pattern for note-taking',
    defaultProps: {
      position: { width: 400, height: 500 },
      properties: {
        grid_cell_size: 10,
        dot_size: 1.5,
        dot_shape: 'round',
        dot_color: '#CCCCCC',
        margin_left: 5,
        margin_right: 5,
        margin_top: 5,
        margin_bottom: 5
      }
    }
  },

  {
    id: 'table',
    type: 'table',
    label: 'Data Table',
    icon: Table,
    description: 'Structured data table with headers and styling',
    defaultProps: {
      position: { width: 400, height: 120 }, // 5 rows (4 data + 1 header) × 24 = 120
      properties: {
        rows: 4,
        columns: 3,
        has_header: true,
        table_data: [
          ['Header', '', ''],
          ['Row', '', ''],
          ['', '', ''],
          ['', '', ''],
          ['', '', '']
        ],
        border_style: 'all',
        cell_padding: 4,
        row_height: 24,
        header_background: '#F0F0F0',
        header_color: '#000000',
        zebra_rows: false,
        text_align: 'left',
        text_wrap: true,
        max_lines: 2
      },
      styling: {
        font: 'Helvetica',
        size: 10,
        color: '#000000'
      }
    }
  }
];

// Organize widgets into logical groups
const WIDGET_GROUPS: WidgetGroup[] = [
  {
    id: 'text',
    label: 'Text & Typography',
    widgets: ALL_WIDGETS.filter(w => ['text_block', 'header_text', 'footer_text', 'checkbox'].includes(w.id))
  },
  {
    id: 'interactive',
    label: 'Interactive Elements',
    widgets: ALL_WIDGETS.filter(w => ['internal_link', 'anchor', 'link_list', 'tap_zone', 'table'].includes(w.id))
  },
  {
    id: 'calendars',
    label: 'Calendars & Lists',
    widgets: ALL_WIDGETS.filter(w => ['calendar', 'day_list'].includes(w.id))
  },
  {
    id: 'shapes',
    label: 'Shapes & Lines',
    widgets: ALL_WIDGETS.filter(w => ['box', 'divider', 'vertical_line', 'lines'].includes(w.id))
  },
  {
    id: 'patterns',
    label: 'Patterns & Grids',
    widgets: ALL_WIDGETS.filter(w => ['dot_grid'].includes(w.id))
  },
  {
    id: 'media',
    label: 'Media & Data',
    widgets: ALL_WIDGETS.filter(w => ['image'].includes(w.id))
  }
];

interface DraggableWidgetProps {
  widgetType: WidgetType;
}

interface CollapsibleGroupProps {
  group: WidgetGroup;
  isExpanded: boolean;
  onToggle: () => void;
}

const CollapsibleGroup: React.FC<CollapsibleGroupProps> = ({ group, isExpanded, onToggle }) => {
  return (
    <div className="mb-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-eink-dark-gray hover:bg-eink-pale-gray rounded transition-colors"
      >
        <span>{group.label}</span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>
      {isExpanded && (
        <div className="mt-2 space-y-2 pl-1">
          {group.widgets.map((widget) => (
            <DraggableWidget key={widget.id} widgetType={widget} />
          ))}
        </div>
      )}
    </div>
  );
};

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
  // Track which groups are expanded (default: all expanded)
  // Following CLAUDE.md Rule #3: Persist user preferences explicitly
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('widgetPaletteExpandedGroups');
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch (e) {
      // Ignore parsing errors
    }
    // Default: all groups expanded
    return new Set(WIDGET_GROUPS.map(g => g.id));
  });

  // Save expanded state to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('widgetPaletteExpandedGroups', JSON.stringify(Array.from(expandedGroups)));
    } catch (e) {
      // Ignore storage errors (quota exceeded, etc.)
    }
  }, [expandedGroups]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-eink-pale-gray">
        <h3 className="font-semibold">Widget Palette</h3>
        <p className="text-sm text-eink-gray">Drag widgets onto the canvas</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {WIDGET_GROUPS.map((group) => (
          <CollapsibleGroup
            key={group.id}
            group={group}
            isExpanded={expandedGroups.has(group.id)}
            onToggle={() => toggleGroup(group.id)}
          />
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
