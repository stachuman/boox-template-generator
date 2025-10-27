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
    color?: boolean;
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
  text_align?: 'left' | 'center' | 'right';
  orientation?: 'horizontal' | 'vertical';
  underline?: boolean;
  stroke_color?: string;
  fill_color?: string;
  line_width?: number;
}

export interface WidgetProperties {
  // Named destination primitives (renderer/plan-compiler)
  dest_id?: string;    // for anchor widgets
  to_dest?: string;    // for internal links or tap zones
  bind?: any;          // opaque binding consumed by plan compiler

  // Checkbox properties
  box_size?: number;
  checkbox_size?: number; // deprecated legacy field for backward compatibility

  // Line-based widgets (divider, vertical_line, lines)
  line_spacing?: number;
  line_count?: number;
  line_thickness?: number;
  margin_left?: number;
  margin_right?: number;
  line_style?: 'solid' | 'dotted' | 'dashed' | 'grid';
  stroke_color?: string;
  top_padding?: number;        // extra space before first line (pt)
  bottom_padding?: number;     // reserved summary area (pt)
  grid_spacing?: number;       // pt spacing for grid verticals
  column_guides?: number;      // number of equal columns (guides) when not grid
  vertical_guides?: number[];  // custom vertical guides as ratios [0..1]
  line_cap?: 'butt' | 'round';

  // Dot grid properties
  grid_cell_size?: number;
  dot_size?: number;
  dot_shape?: 'round' | 'square';
  dot_color?: string;
  margin_top?: number;
  margin_bottom?: number;

  // Anchor widget properties (pages-only model)
  target_page?: number;

  // Tap zone properties
  tap_action?: 'page_link' | 'prev_page' | 'next_page';
  outline?: boolean; // editor-only visual aid

  // Image properties
  image_src?: string;             // URL to external image
  image_data?: string;            // Base64-encoded image data (max 0.5MB)
  image_fit?: 'fit' | 'stretch' | 'actual';
  convert_to_grayscale?: boolean; // Convert to grayscale in PDF rendering
  optimize_on_import?: boolean;   // If true, downscale/compress on import
  max_image_px?: number;          // Max width/height in px when optimizing
  grayscale_on_import?: boolean;  // Convert to grayscale on import (client-side)
  image_quality?: number;         // JPEG quality 0.5-0.95 (default 0.8)

  // Box widget properties
  fill_color?: string;
  stroke_width?: number;
  corner_radius?: number;
  opacity?: number; // 0..1

  // Calendar widget properties
  calendar_type?: 'monthly' | 'weekly' | 'custom_range';
  start_date?: string;        // ISO 8601 format (YYYY-MM-DD)
  end_date?: string;          // ISO 8601 format (YYYY-MM-DD), optional for monthly/weekly
  link_strategy?: 'sequential_pages' | 'no_links' | 'named_destinations';
  first_page_number?: number; // Required when link_strategy = 'sequential_pages'
  pages_per_date?: number;    // Required when link_strategy = 'sequential_pages'
  show_weekdays?: boolean;
  show_month_year?: boolean;
  cell_min_size?: number;     // Minimum touch target size for e-ink
  show_grid_lines?: boolean;
  first_day_of_week?: 'sunday' | 'monday'; // Calendar locale: Sunday (US) or Monday (Europe)
  layout_orientation?: 'horizontal' | 'vertical'; // Weekly calendar layout: horizontal (columns) or vertical (rows)

  // Day list widget properties (extends calendar properties for dates)
  show_day_numbers?: boolean;
  show_weekday_names?: boolean;
  weekday_format?: 'short' | 'narrow' | 'full';
  show_notes_lines?: boolean;
  notes_line_count?: number;
  highlight_weekends?: boolean;
  weekend_color?: string;
  orientation?: 'horizontal' | 'vertical_cw' | 'vertical_ccw';
  show_month_header?: boolean;
  show_year_in_header?: boolean;
  month_name_format?: 'long' | 'short';

  // Table widget properties
  rows?: number;                      // Number of data rows (1-100)
  columns?: number;                   // Number of columns (1-20)
  has_header?: boolean;               // Whether first row is header
  column_widths?: number[];           // Relative column widths (e.g., [1,2,1])
  table_data?: string[][];            // 2D array data (tokens are always processed)
  border_style?: 'none' | 'outer' | 'all' | 'horizontal' | 'vertical';
  cell_padding?: number;              // Cell internal padding (points)
  row_height?: number;                // Fixed row height (points)
  header_background?: string;         // Header row background color
  header_color?: string;              // Header text color
  zebra_rows?: boolean;               // Enable alternating row colors
  even_row_bg?: string;              // Even row background color
  odd_row_bg?: string;               // Odd row background color
  text_align?: 'left' | 'center' | 'right'; // Default text alignment
  column_aligns?: string[];           // Per-column alignment overrides
  text_wrap?: boolean;                // Wrap text in cells
  max_lines?: number;                 // Max lines per cell
  link_template?: string;             // Link pattern (table: {row},{col},{value}; day_list: {date},{year},{month},{day})
  link_columns?: number[];            // Which columns are linkable (0-based internally, displayed as 1-based)

  [key: string]: any;
}

export interface Widget {
  id: string;
  type: 'text_block' | 'checkbox' | 'divider' | 'vertical_line' | 'lines' | 'dot_grid' | 'anchor' | 'internal_link' | 'calendar' | 'day_list' | 'tap_zone' | 'image' | 'link_list' | 'box' | 'table';
  page?: number; // Optional - auto-assigned during compilation for multi-page documents
  content?: string;
  position: Position;
  background_color?: string;
  styling?: TextStyling;
  properties?: WidgetProperties;
  z_order?: number; // Optional - controls widget layering (higher values render on top)
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

// ---- Project-Based Architecture Types ----

export type RepeatMode = 'once' | 'each_day' | 'each_week' | 'each_month' | 'count';

export interface ProjectMetadata {
  name: string;
  description: string;
  category: string;
  author: string;
  device_profile: string;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  public_url_slug: string | null;
  original_author: string | null;
  cloned_from: string | null;
  clone_count: number;
}

export interface NamedPage {
  name: string;
  description: string;
  template: Template;
  created_at: string;
  updated_at: string;
}

export interface CompilationRule {
  page_name: string;
  repeat_mode: RepeatMode;
  start_date?: string;
  end_date?: string;
  count?: number;
  context_rules: Record<string, string>;
  order: number;
}

export interface LinkResolution {
  mode: 'named_destinations' | 'page_numbers';
  destination_patterns: Record<string, string>;
  generate_outlines: boolean;
  generate_month_links: boolean;
  generate_day_links: boolean;
}

// Master/Plan Architecture Types
export interface ProjectMaster {
  name: string;
  description: string;
  widgets: Widget[];
  created_at: string;
  updated_at: string;
}

export enum GenerateMode {
  ONCE = 'once',
  EACH_DAY = 'each_day',
  EACH_WEEK = 'each_week',
  EACH_MONTH = 'each_month',
  COUNT = 'count'
}

export interface CounterConfig {
  start: number;
  step: number;
}

export interface PlanSection {
  kind: string;
  master: string;
  generate: GenerateMode;
  start_date?: string;
  end_date?: string;
  count?: number;
  pages_per_item?: number;
  context?: Record<string, any>;
  counters?: Record<string, CounterConfig>;
  nested?: PlanSection[];  // Recursive nesting (max depth: 3)
}

export interface CalendarConfig {
  start_date: string;
  end_date: string;
  pages_per_day: number;
}

export interface Plan {
  calendar: CalendarConfig;
  sections: PlanSection[];
  order: string[];
  locale?: string;
}

export interface BindingContext {
  [key: string]: any;
}

export interface Project {
  id: string;
  metadata: ProjectMetadata;
  masters: ProjectMaster[];
  plan: Plan;
  link_resolution: LinkResolution;
  default_canvas: Record<string, any>;
  pages: NamedPage[];
  compilation_rules?: CompilationRule[]; // Deprecated - use Plan/Master architecture instead
}

export interface ProjectListItem {
  id: string;
  name: string;
  description: string;
  masters_count: number;
  plan_sections_count: number;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  public_url_slug: string | null;
  clone_count: number;
}

export interface CompilationResult {
  template_yaml: string;
  compilation_stats: Record<string, any>;
  warnings?: string[];
}

// Request types for project API
export interface CreateProjectRequest {
  name: string;
  description?: string;
  device_profile?: string;
  author?: string;
  category?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  device_profile?: string;
  author?: string;
  category?: string;
}

export interface MakeProjectPublicRequest {
  is_public: boolean;
  url_slug?: string | null;
}

export interface CloneProjectRequestPayload {
  new_name: string;
  new_description?: string;
}

export interface AddPageRequest {
  name: string;
  template_yaml: string;
  description?: string;
}

export interface UpdatePageRequest {
  template_yaml?: string;
  new_name?: string;
  description?: string;
}

export interface UpdateCompilationRulesRequest {
  rules: CompilationRule[];
}

// Master/Plan API Request Types
export interface AddMasterRequest {
  name: string;
  template_yaml: string;
  description?: string;
}

export interface UpdateMasterRequest {
  template_yaml?: string;
  new_name?: string;
  description?: string;
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
  // Canvas scroll container ref
  canvasScrollContainer: HTMLDivElement | null;
  // Clipboard for copy/paste
  clipboard: Widget[];
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
  selectedWidgets?: Widget[]; // All selected widgets when dragging a group
}

// PDF Job Types (async PDF generation)
export type PDFJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface PDFJob {
  id: string;
  project_id?: string | null;
  status: PDFJobStatus;
  error_message?: string | null;
  size_bytes?: number | null;
  page_count?: number | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  diagnostics?: PDFJobDiagnostics | null;
}

export interface PDFJobCreateRequest {
  yaml_content?: string;
  profile?: string;
  deterministic?: boolean;
  strict_mode?: boolean;
  project_id?: string | null;
}

export interface PDFJobListResponse {
  jobs: PDFJob[];
  total: number;
}

export interface PDFJobDiagnosticsPhase {
  started_at?: string | null;
  completed_at?: string | null;
  error?: string | null;
  warnings?: string[];
  stats?: Record<string, unknown> | null;
  page_count?: number | null;
  size_bytes?: number | null;
}

export interface PDFJobDiagnostics {
  compile?: PDFJobDiagnosticsPhase | null;
  render?: PDFJobDiagnosticsPhase | null;
}
