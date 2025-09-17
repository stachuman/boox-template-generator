/**
 * TypeScript type definitions for the E-ink PDF Templates frontend.
 * 
 * These types mirror the backend API models and einkpdf schema.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

export interface DeviceProfile {
  name: string;
  display: {
    screen_size: [number, number];
    ppi: number;
    aspect_ratio: string;
    physical_size: string;
  };
  pdf_settings: {
    page_size: string;
    orientation: string;
    safe_margins: [number, number, number, number];
  };
  constraints: {
    min_font_pt: number;
    min_stroke_pt: number;
    min_touch_target_pt: number;
    grayscale_levels: number;
    max_gray_fill_area: number;
  };
}

export interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextStyling {
  font?: string;
  size?: number;
  color?: string;
}

export interface WidgetProperties {
  bookmark?: string;
  checkbox_size?: number;
  line_spacing?: number;
  line_count?: number;
  line_thickness?: number;
  margin_left?: number;
  margin_right?: number;
  line_style?: 'solid' | 'dotted' | 'dashed' | 'grid';
  // Anchor widget properties
  destination?: string;
  anchor_type?: 'named_destination' | 'page_link' | 'outline_bookmark';
  target_page?: number;
  // Calendar widget properties
  calendar_type?: 'monthly' | 'weekly' | 'custom_range';
  start_date?: string;        // ISO 8601 format (YYYY-MM-DD)
  end_date?: string;          // ISO 8601 format (YYYY-MM-DD), optional for monthly/weekly
  link_strategy?: 'sequential_pages' | 'named_destinations' | 'no_links';
  first_page_number?: number; // Required when link_strategy = 'sequential_pages'
  pages_per_date?: number;    // Required when link_strategy = 'sequential_pages'
  destination_pattern?: string; // Required when link_strategy = 'named_destinations'
  show_weekdays?: boolean;
  show_month_year?: boolean;
  cell_min_size?: number;     // Minimum touch target size for e-ink
  show_grid_lines?: boolean;
  first_day_of_week?: 'sunday' | 'monday'; // Calendar locale: Sunday (US) or Monday (Europe)
  [key: string]: any;
}

export interface Widget {
  id: string;
  type: 'text_block' | 'checkbox' | 'divider' | 'lines' | 'anchor' | 'calendar';
  page: number;
  content?: string;
  position: Position;
  background_color?: string;
  styling?: TextStyling;
  properties?: WidgetProperties;
}

export interface Master {
  id: string;
  name?: string;
  widgets: Widget[];
}

export interface PageAssignment {
  page: number;
  master_id: string;
}

export interface NamedDestination {
  id: string;
  page: number;
  x: number;
  y: number;
  fit: 'FitH' | 'Fit' | 'XYZ';
}

export interface OutlineItem {
  title: string;
  dest: string;
  level: number;
}

export interface Navigation {
  named_destinations: NamedDestination[];
  outlines: OutlineItem[];
}

export interface TemplateMetadata {
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
  created: string;
  profile: string;
}

export interface Canvas {
  dimensions: {
    width: number;
    height: number;
    margins: [number, number, number, number];
  };
  coordinate_system?: 'top_left';
  background?: string;
  grid_size?: number;
  snap_enabled?: boolean;
}

export interface Template {
  schema_version: string;
  metadata: TemplateMetadata;
  canvas: Canvas;
  widgets: Widget[];
  masters?: Master[];
  page_assignments?: PageAssignment[];
  navigation: Navigation;
  export?: {
    default_mode: 'interactive' | 'flattened';
  };
}

export interface TemplateResponse {
  id: string;
  name: string;
  description: string;
  profile: string;
  created_at: string;
  updated_at: string;
  yaml_content: string;
}

export interface APIError {
  error: string;
  message: string;
  details?: Array<{
    field: string;
    message: string;
    value: any;
  }>;
}

export interface WebSocketMessage {
  type: 'preview_request' | 'preview_response' | 'error';
  data: {
    [key: string]: any;
  };
}

// UI State Types
export interface EditorState {
  selectedWidget: Widget | null;
  activeProfile: DeviceProfile | null;
  currentTemplate: Template | null;
  isDragging: boolean;
  showGrid: boolean;
  snapEnabled: boolean;
  zoom: number;
  // Multi-page support
  currentPage: number;
  totalPages: number;
  // Panel visibility
  showWidgetPalette: boolean;
  showPagesPanel: boolean;
  showRightPanel: boolean;
}

export interface DragItem {
  type: string;
  widget?: Widget;
  widgetType?: Widget['type'];
  defaultProps?: {
    content?: string;
    position: {
      width: number;
      height: number;
    };
    styling?: any;
    properties?: any;
  };
  isNew?: boolean;
}
