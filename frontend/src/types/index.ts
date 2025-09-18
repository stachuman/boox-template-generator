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
  checkbox_size?: number;
  line_spacing?: number;
  line_count?: number;
  line_thickness?: number;
  margin_left?: number;
  margin_right?: number;
  line_style?: 'solid' | 'dotted' | 'dashed' | 'grid';
  top_padding?: number;        // extra space before first line (pt)
  bottom_padding?: number;     // reserved summary area (pt)
  grid_spacing?: number;       // pt spacing for grid verticals
  columns?: number;            // number of equal columns (guides) when not grid
  vertical_guides?: number[];  // custom vertical guides as ratios [0..1]
  // Anchor widget properties (pages-only model)
  target_page?: number;
  // Tap zone properties
  tap_action?: 'page_link' | 'prev_page' | 'next_page';
  outline?: boolean; // editor-only visual aid
  // Image properties
  image_src?: string;             // URL or data URI
  image_fit?: 'fit' | 'stretch' | 'actual';
  optimize_on_import?: boolean;   // If true, downscale/compress on import
  max_image_px?: number;          // Max width/height in px when optimizing
  grayscale_on_import?: boolean;  // Convert to grayscale on import
  image_quality?: number;         // JPEG quality 0.5-0.95 (default 0.8)
  // Calendar widget properties
  calendar_type?: 'monthly' | 'weekly' | 'custom_range';
  start_date?: string;        // ISO 8601 format (YYYY-MM-DD)
  end_date?: string;          // ISO 8601 format (YYYY-MM-DD), optional for monthly/weekly
  link_strategy?: 'sequential_pages' | 'no_links';
  first_page_number?: number; // Required when link_strategy = 'sequential_pages'
  pages_per_date?: number;    // Required when link_strategy = 'sequential_pages'
  show_weekdays?: boolean;
  show_month_year?: boolean;
  cell_min_size?: number;     // Minimum touch target size for e-ink
  show_grid_lines?: boolean;
  first_day_of_week?: 'sunday' | 'monday'; // Calendar locale: Sunday (US) or Monday (Europe)
  [key: string]: any;
}

export interface Widget {
  id: string;
  type: 'text_block' | 'checkbox' | 'divider' | 'lines' | 'anchor' | 'calendar' | 'tap_zone' | 'image';
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

// Navigation is simplified; page-only links are embedded in widgets
export interface Navigation {}

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
  navigation?: Navigation;
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
  parsed_template?: Template | null;
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
  selectedIds: string[];
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
