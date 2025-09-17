# Navigation Implementation Specification

## Overview

This document provides precise, implementation-ready specifications for navigation and linking widgets that support the multi-page patterns outlined in `MULTIPAGE_NAVIGATION_DESIGN.md`. It defines data models, YAML schemas, engine passes, validation rules, and worked examples.

## Core Abstractions (Engine Level)

### Anchor (Named Destination)
```python
@dataclass
class Anchor:
    dest_id: str                    # Unique within document
    page: int                       # 1-based page index
    rect: Tuple[float, float, float, float]  # Top-left origin in YAML
    fit: str = "FitH"              # PDF fit type (default for e-ink predictability)
    zoom: Optional[float] = None    # Optional zoom level
```

### Link (Annotation)
```python
@dataclass
class LinkSpec:
    src_widget_id: str              # Source widget ID
    dest_id: str                    # Target destination ID
    rect: Tuple[float, float, float, float]  # Top-left origin
    padding_pt: int = 6             # Expand hitbox (min 44×44 pt effective)
    style: str = "underline"        # Visual cue: underline | box | none
    role: str = "nav"               # nav | xref | toc (for QA/analytics)
```

### NavGroup
Generator for repeated anchors/links created by patterns (calendar grid, prev/next bars, tabs). Implements hub-and-spoke, linear, hierarchical, and grid patterns.

## Engine Processing Passes (Deterministic)

1. **Layout Pass**: Place widgets → provisional page/rects
2. **Anchor Harvest**: Register anchors from explicit Anchor widgets and anchor-capable widgets
3. **Link Build**: Resolve link widgets against AnchorRegistry, expand hitboxes, enforce min sizes
4. **Outline Build**: Create bookmarks from YAML outlines and/or heading anchors
5. **Validate**: Check touch sizes, missing targets, overlaps, off-page positioning
6. **Post-Process**: Write named destinations, link annotations, outlines; optionally flatten forms

## YAML Schema Specifications

### Primitive Widgets

#### Anchor Widget
Creates a named destination at a specific location.

```yaml
widgets:
  - id: "anchor_evening"
    type: "anchor"
    page: 1
    position: { x: 72, y: 540, width: 180, height: 22 }
    properties:
      dest_id: "evening_section"
      fit: "FitH"
      zoom: null
```

#### Internal Link Widget
Clickable area that navigates to an anchor.

```yaml
widgets:
  - id: "link_to_evening"
    type: "internal_link"
    page: 1
    position: { x: 72, y: 510, width: 160, height: 20 }
    properties:
      to: "evening_section"
      padding_pt: 6
      style: "underline"
      role: "nav"
```

#### Outline Entries (Bookmarks)
```yaml
navigation:
  outlines:
    - title: "Daily Goals"
      dest: "goals_section"
      level: 1
    - title: "Evening Review"
      dest: "evening_section"
      level: 1
```

### Navigation Helper Widgets

#### NavBar (Previous/Next/Home)
Supports linear sequence navigation patterns.

```yaml
widgets:
  - id: "navbar"
    type: "nav_bar"
    repeat: { pages: "all" }
    position: { x: 72, y: 782, width: 451, height: 24 }
    properties:
      home_dest: "toc_home"
      prev_next: true
      layout: "left_home_center_prevnext_right_page"
      min_touch_pt: 44
```

**Engine Behavior**: Expands into three Links per page (prev/next suppressed on edges) and one Home link.

#### Section Tabs
Multi-modal navigation for hierarchical content.

```yaml
widgets:
  - id: "tabs"
    type: "section_tabs"
    repeat: { pages: "all" }
    position: { x: 72, y: 60, width: 451, height: 28 }
    properties:
      sections:
        - { title: "Overview", dest: "sec_overview" }
        - { title: "Week 1", dest: "sec_w1" }
        - { title: "Week 2", dest: "sec_w2" }
      style: "pill"
      min_touch_pt: 44
```

## Implementation Examples

### Calendar Month Widget (Hub-and-Spoke Pattern)

Calendar hub on page 1 with each day linking to daily pages, and daily pages linking back.

```yaml
widgets:
  - id: "month_mar_2026"
    type: "calendar_month"
    page: 1
    position: { x: 72, y: 120, width: 451, height: 540 }
    properties:
      month: 3
      year: 2026
      start_week_on: "mon"
      daily_template_id: "daily_template"
      start_page: 2
      back_link_label: "← Month"
      min_touch_pt: 44
      cell_gutter_pt: 6
```

**Engine Behavior**:
- Computes day grid respecting first weekday and 28–31 days
- Auto-generates anchors for each day cell: `dest_id = "day_2026-03-01"...`
- Creates daily pages from `daily_template_id` with matching anchors
- Creates links from each hub cell → daily page anchor
- Creates back links from each daily page → hub

### Table of Contents Widget (Hierarchical Pattern)

Auto-generates TOC from outline/heading anchors.

```yaml
widgets:
  - id: "toc_main"
    type: "table_of_contents"
    page: 1
    position: { x: 72, y: 120, width: 451, height: 600 }
    properties:
      source: "anchors:level<=3"
      include_page_numbers: true
      dot_leaders: true
      indent_per_level_pt: 12
      min_touch_pt: 44
```

**Engine Behavior**:
- Scans AnchorRegistry for anchors with level metadata
- Renders TOC lines as links to respective anchors
- Generates matching outline tree for bookmark panel

### Master-Slave Navigation (Linear Pattern)

Persistent navigation across multiple pages using the repeat capability.

```yaml
# Page sequence definition
page_sequence:
  type: "linear"
  toc_dest: "toc_home"
  sections:
    - title: "Intro"
      pages: [2]
      dest: "sec_intro"
    - title: "Week 1"
      pages: [3,4,5]
      dest: "sec_w1"
    - title: "Week 2"
      pages: [6,7,8]
      dest: "sec_w2"

widgets:
  - id: "navbar"
    type: "nav_bar"
    repeat: { pages: "all" }
    position: { x: 72, y: 782, width: 451, height: 24 }
    properties:
      home_dest: "toc_home"
      prev_next: true
      min_touch_pt: 44

  - id: "tabs"
    type: "section_tabs"
    repeat: { pages: "all" }
    position: { x: 72, y: 60, width: 451, height: 28 }
    properties:
      sections:
        - { title: "Intro", dest: "sec_intro" }
        - { title: "W1", dest: "sec_w1" }
        - { title: "W2", dest: "sec_w2" }
      min_touch_pt: 44
```

## Engine Implementation Scaffold

### Core Classes
```python
# core/navigation.py
@dataclass
class Anchor:
    dest_id: str
    page: int
    rect: Tuple[float, float, float, float]  # TL origin space
    fit: str = "FitH"
    zoom: Optional[float] = None

class AnchorRegistry:
    def __init__(self): 
        self._by_id = {}
        
    def add(self, a: Anchor):
        if a.dest_id in self._by_id: 
            raise ValueError(f"Duplicate dest_id: {a.dest_id}")
        self._by_id[a.dest_id] = a
        
    def get(self, dest_id: str) -> Anchor: 
        return self._by_id[dest_id]
        
    def exists(self, dest_id: str) -> bool: 
        return dest_id in self._by_id

class LinkBuilder:
    def __init__(self, anchor_reg: AnchorRegistry, profile):
        self.ar = anchor_reg
        self.profile = profile

    def expand_hitbox(self, rect, min_size_pt=44, pad=6):
        x, y, w, h = rect
        x -= pad
        y -= pad
        w += 2 * pad
        h += 2 * pad
        
        if w < min_size_pt: 
            x -= (min_size_pt - w) / 2
            w = min_size_pt
        if h < min_size_pt: 
            y -= (min_size_pt - h) / 2
            h = min_size_pt
            
        return (x, y, w, h)

    def build_pdf_annotations(self, links: List[LinkSpec], pdf_canvas):
        for ln in links:
            if not self.ar.exists(ln.dest_id):
                raise ValueError(f"Unknown destination: {ln.dest_id}")
            rect_expanded = self.expand_hitbox(
                ln.rect, 
                self.profile.link_min_size_pt, 
                ln.padding_pt
            )
            # Convert TL → BL coords and write /Link annotations
```

## Validation Rules (E-ink Optimized)

### Touch Target Validation
- **Minimum Size**: Final link rect ≥ 44×44 pt
- **Auto-Expand**: Unless `--strict` mode enabled
- **Profile Constraints**: Respect device-specific touch requirements

### Spatial Validation
- **On-Page**: Rect must lie within content box (after expansion)
- **No Overlap**: Warn or reflow overlapping form fields (configurable)
- **Boundary Check**: Ensure links don't extend beyond page margins

### Reference Validation
- **Target Exists**: Every `to` resolves to registered `dest_id`
- **Unique Destinations**: No duplicate `dest_id` values
- **Outline Integrity**: Every outline points to existing destination

### Pattern-Specific Validation
- **Calendar Integrity**: Correct day count & first weekday for month widgets
- **Generated Pages**: Cover all days when auto-generating daily pages
- **Level Consistency**: Outline levels start at 1, no jumps >1 level deeper

## UI Design Affordances

### Link Inspector
- Select link → shows target `dest_id`, jump button, effective hitbox
- Real-time validation feedback
- Preview destination page

### Tap-Target Overlay
- Toggle to display final (expanded) hitboxes on canvas
- Color-coded by link role (nav/xref/toc)
- Size validation indicators

### Structure View
- Graph tree of outlines + anchors + links
- Click to focus page (assists large hierarchies)
- Relationship visualization for complex navigation

### Auto-Fix Badges
- Show non-printing badges when validator expands elements
- Help authors understand automatic adjustments
- Clear feedback on constraint enforcement

## Additional Navigation Patterns

### Breadcrumb Widget
Supports hierarchical document navigation.

```yaml
widgets:
  - id: "breadcrumb"
    type: "breadcrumb"
    repeat: { pages: "all" }
    position: { x: 72, y: 88, width: 451, height: 18 }
    properties:
      trail: 
        - { title: "Home", dest: "toc_home" }
        - { title: "Section", dest: "sec_w1" }
      separator: " › "
      min_touch_pt: 44
```

### Thumbnail Grid Widget
Overview → detail pattern with auto-thumbnailing.

```yaml
widgets:
  - id: "photo_grid"
    type: "thumbnail_grid"
    page: 1
    position: { x: 72, y: 120, width: 451, height: 600 }
    properties:
      columns: 4
      rows: 6
      detail_pages: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
      thumbnail_source: "auto"
      back_link_dest: "photo_grid"
      min_touch_pt: 44
```

### Conditional Link Widget
Server-side condition resolution for dynamic routing.

```yaml
widgets:
  - id: "next_step"
    type: "conditional_link"
    page: 1
    position: { x: 72, y: 400, width: 200, height: 44 }
    properties:
      conditions:
        - if: "user_level == 'beginner'"
          target: "page_basics"
          text: "Start with Basics"
        - if: "user_level == 'advanced'"
          target: "page_advanced"
          text: "Skip to Advanced"
      default:
        target: "page_continue"
        text: "Continue"
```

## Testing Strategy

### Graph Validation
- Build directed graph of {anchors, links, outlines}
- Assert no dangling links
- Report weakly connected components (should be 1)

### Visual Testing
- Render PNGs with link rectangles overlaid
- SSIM comparisons in CI for golden samples
- Touch target visualization validation

### Pattern Testing
- Calendar month fuzz testing (all months, leap years)
- Assert hub ↔ spokes completeness
- Linear sequence integrity testing

### Integration Testing
- End-to-end navigation flows
- PDF reader compatibility testing
- E-ink device validation

## Implementation Priority (1-2 Sprints)

### Phase 1: Core Foundation
1. **AnchorRegistry + LinkBuilder + OutlineBuilder** (engine)
2. **Primitive widgets**: `anchor`, `internal_link`, `nav_bar`
3. **Validation framework** with auto-fix capability

### Phase 2: Key Patterns
1. **Calendar month widget** (hub-and-spoke) with back links
2. **TOC widget** (auto from anchors) + outline parity
3. **Master-slave navigation** with repeat capability

### Phase 3: Enhanced UX
1. **Tap-target overlay** in editor
2. **Link inspector** for debugging
3. **Structure view** for complex documents

### Phase 4: Advanced Patterns
1. **Thumbnail grid** for visual content
2. **Breadcrumb navigation** for hierarchies
3. **Conditional linking** for dynamic content

## UI/UX Design Patterns for Navigation Widgets

Navigation widgets introduce unique complexity requiring specialized UI patterns beyond standard widget editing. This section defines the user experience for creating, managing, and validating complex multi-page relationships.

### Widget Palette Extensions

#### Navigation Category
```typescript
const NAVIGATION_WIDGETS: WidgetType[] = [
  {
    type: 'anchor',
    label: 'Anchor Point',
    icon: Target,
    description: 'Named destination for links',
    category: 'navigation'
  },
  {
    type: 'internal_link', 
    label: 'Internal Link',
    icon: Link,
    description: 'Jump to another page/section',
    category: 'navigation'
  },
  {
    type: 'calendar_month',
    label: 'Calendar Hub',
    icon: Calendar,
    description: 'Month view with daily page links',
    category: 'navigation',
    generates_pages: true  // Special indicator
  },
  {
    type: 'table_of_contents',
    label: 'Table of Contents', 
    icon: List,
    description: 'Auto-generated content index',
    category: 'navigation'
  },
  {
    type: 'nav_bar',
    label: 'Navigation Bar',
    icon: Navigation,
    description: 'Prev/Next/Home controls',
    category: 'navigation',
    repeat_capable: true  // Special indicator
  }
];
```

**Visual Indicators**:
- **🔗 Auto-Gen Badge**: For widgets that create pages (calendar_month)
- **📋 Repeat Badge**: For widgets that appear on multiple pages (nav_bar)
- **🎯 Target Badge**: For widgets that create destinations (anchor)

### Enhanced Properties Panel

#### Smart Property Components

**Destination Picker with Preview**:
```tsx
const DestinationPicker: React.FC<{value: string, onChange: (dest: string) => void}> = ({value, onChange}) => {
  const availableDestinations = useDestinations();
  
  return (
    <div className="space-y-2">
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="input-field w-full"
      >
        <option value="">Select destination...</option>
        {availableDestinations.map(dest => (
          <option key={dest.id} value={dest.id}>
            {dest.label} (Page {dest.page})
          </option>
        ))}
      </select>
      
      {value && (
        <button 
          className="btn-secondary text-xs"
          onClick={() => jumpToDestination(value)}
        >
          Preview Target 🔗
        </button>
      )}
    </div>
  );
};
```

**Page Generation Preview**:
```tsx
const PageGenerationPreview: React.FC<{widget: CalendarWidget}> = ({widget}) => {
  const generatedInfo = useCalendarGeneration(widget);
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
      <div className="font-medium mb-2">📅 Auto-Generation Preview</div>
      <div className="space-y-1 text-gray-600">
        <div>Month: {widget.properties.month}/{widget.properties.year}</div>
        <div>Pages: {generatedInfo.startPage} - {generatedInfo.endPage}</div>
        <div>Days: {generatedInfo.dayCount}</div>
      </div>
      
      {generatedInfo.warnings.length > 0 && (
        <div className="mt-2 text-amber-600">
          ⚠️ {generatedInfo.warnings.join(', ')}
        </div>
      )}
    </div>
  );
};
```

### Multi-Page Canvas Navigation

#### Page Tabs Interface
```tsx
const PageTabs: React.FC = () => {
  const { currentTemplate, currentPage, setCurrentPage } = useEditorStore();
  
  return (
    <div className="flex space-x-1 overflow-x-auto border-b bg-gray-50 px-4 py-2">
      {currentTemplate.pages.map((page, index) => (
        <button
          key={page.id}
          onClick={() => setCurrentPage(index + 1)}
          className={clsx(
            'px-3 py-1 rounded-t text-sm whitespace-nowrap',
            currentPage === index + 1 
              ? 'bg-white border-t border-l border-r text-blue-600' 
              : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
          )}
        >
          Page {index + 1}
          {page.generated && <span className="ml-1 text-xs">🔗</span>}
          {page.hasAnchors && <span className="ml-1 text-xs">🎯</span>}
        </button>
      ))}
      
      <button 
        onClick={addPage}
        className="px-3 py-1 rounded text-sm text-gray-500 hover:text-gray-700"
      >
        + Add Page
      </button>
    </div>
  );
};
```

#### Navigation Overlay Mode
Toggle-able overlay showing all navigation elements with visual indicators:

```tsx
const NavigationOverlay: React.FC = () => {
  const [showNavOverlay, setShowNavOverlay] = useState(false);
  const navigationElements = useNavigationElements();
  
  return (
    <div className="absolute top-4 right-4 z-10">
      <button
        onClick={() => setShowNavOverlay(!showNavOverlay)}
        className={clsx(
          'btn-secondary px-2 py-1 text-xs',
          showNavOverlay && 'bg-blue-100 text-blue-700'
        )}
      >
        🔗 Nav ({navigationElements.length})
      </button>
      
      {showNavOverlay && (
        <div className="absolute inset-0 pointer-events-none">
          {navigationElements.map(element => (
            <div
              key={element.id}
              className={clsx(
                'absolute border-2 pointer-events-auto',
                element.type === 'anchor' && 'border-green-400 bg-green-100/50',
                element.type === 'link' && 'border-blue-400 bg-blue-100/50',
                element.valid === false && 'border-red-400 bg-red-100/50'
              )}
              style={{
                left: element.rect.x,
                top: element.rect.y,
                width: element.rect.width,
                height: element.rect.height
              }}
              title={`${element.type}: ${element.label}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

### Document Structure Panel

#### Navigation Tree View
Hierarchical view of all navigation relationships:

```tsx
const NavigationStructure: React.FC = () => {
  const navStructure = useNavigationStructure();
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Document Structure</h3>
        <p className="text-sm text-gray-600">Navigation & links overview</p>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        <NavigationTree nodes={navStructure.tree} />
      </div>
      
      <div className="p-4 border-t bg-gray-50 text-xs">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="font-medium">{navStructure.stats.anchors}</div>
            <div className="text-gray-600">Anchors</div>
          </div>
          <div>
            <div className="font-medium">{navStructure.stats.links}</div>
            <div className="text-gray-600">Links</div>
          </div>
          <div>
            <div className="font-medium">{navStructure.stats.pages}</div>
            <div className="text-gray-600">Pages</div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Validation & Feedback System

#### Real-Time Validation
```tsx
const NavigationValidator: React.FC = () => {
  const validationResults = useNavigationValidation();
  
  if (validationResults.valid) return null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-white border border-red-200 rounded-lg shadow-lg p-4 max-w-sm">
      <div className="flex items-center space-x-2 mb-2">
        <span className="text-red-500">⚠️</span>
        <span className="font-medium text-sm">Navigation Issues</span>
      </div>
      
      <div className="space-y-2">
        {validationResults.errors.map((error, index) => (
          <div key={index} className="text-xs">
            <div className="font-medium text-red-700">{error.type}</div>
            <div className="text-gray-600">{error.message}</div>
            {error.fixable && (
              <button 
                onClick={() => autoFix(error)}
                className="text-blue-600 hover:underline"
              >
                Auto-fix
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

#### Link Preview Modal
Modal for previewing link relationships before PDF generation:

```tsx
const LinkPreviewModal: React.FC<{linkId: string}> = ({linkId}) => {
  const linkInfo = useLinkInfo(linkId);
  const targetPreview = useTargetPreview(linkInfo.targetDest);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Link Preview</h3>
          <p className="text-sm text-gray-600">
            {linkInfo.sourceWidget} → {linkInfo.targetDest}
          </p>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Source (Page {linkInfo.sourcePage})</h4>
              <div className="border rounded bg-gray-50 h-32 flex items-center justify-center">
                <span className="text-blue-600 border-2 border-blue-400 px-2 py-1 rounded">
                  {linkInfo.linkText || 'Link'}
                </span>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Target (Page {linkInfo.targetPage})</h4>
              <div className="border rounded bg-gray-50 h-32 flex items-center justify-center">
                {targetPreview ? (
                  <img src={targetPreview} alt="Target preview" className="max-h-full" />
                ) : (
                  <span className="text-green-600">🎯 {linkInfo.targetDest}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Auto-Generation Workflow

#### Generation Dialog for Complex Widgets
```tsx
const AutoGenerationDialog: React.FC<{widget: CalendarWidget}> = ({widget}) => {
  const [settings, setSettings] = useState({
    createPages: true,
    useTemplate: 'daily_default',
    startPage: 2,
    overwriteExisting: false
  });
  
  const preview = useGenerationPreview(widget, settings);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Generate Calendar Pages</h3>
          <p className="text-sm text-gray-600">
            Create {preview.dayCount} daily pages for {widget.properties.month}/{widget.properties.year}
          </p>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Template</label>
            <select 
              value={settings.useTemplate}
              onChange={(e) => setSettings(prev => ({...prev, useTemplate: e.target.value}))}
              className="input-field w-full"
            >
              <option value="daily_default">Default Daily Page</option>
              <option value="daily_lines">Lined Daily Page</option>
              <option value="daily_grid">Grid Daily Page</option>
            </select>
          </div>
          
          {preview.conflicts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
              <div className="font-medium text-amber-800 mb-1">⚠️ Conflicts</div>
              <div className="text-amber-700">
                {preview.conflicts.join(', ')}
              </div>
              <label className="flex items-center mt-2">
                <input
                  type="checkbox"
                  checked={settings.overwriteExisting}
                  onChange={(e) => setSettings(prev => ({...prev, overwriteExisting: e.target.checked}))}
                  className="mr-2"
                />
                Overwrite existing pages
              </label>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t flex justify-between">
          <button className="btn-secondary">Cancel</button>
          <button 
            className="btn-primary"
            disabled={preview.conflicts.length > 0 && !settings.overwriteExisting}
          >
            Generate {preview.dayCount} Pages
          </button>
        </div>
      </div>
    </div>
  );
};
```

### TypeScript Extensions

#### Navigation Widget Types
```typescript
type NavigationWidgetType = 
  | 'anchor'
  | 'internal_link' 
  | 'calendar_month'
  | 'table_of_contents'
  | 'nav_bar'
  | 'section_tabs'
  | 'breadcrumb';

interface NavigationWidget extends Widget {
  type: NavigationWidgetType;
  generates_pages?: boolean;
  repeat_capable?: boolean;
  validation_status?: 'valid' | 'warning' | 'error';
  relationships?: {
    targets?: string[];
    sources?: string[];
    generated_pages?: number[];
  };
}
```

#### Editor State Extensions
```typescript
interface NavigationEditorState {
  currentPage: number;
  showNavigationOverlay: boolean;
  selectedNavigationElement?: string;
  generationDialogOpen?: string;
  linkPreviewOpen?: string;
  navigationStructureOpen: boolean;
}
```

### Custom Hooks for Navigation
```typescript
const useNavigationValidation = () => {
  const { currentTemplate } = useEditorStore();
  return useMemo(() => validateNavigation(currentTemplate), [currentTemplate]);
};

const useDestinations = () => {
  const { currentTemplate } = useEditorStore();
  return useMemo(() => extractDestinations(currentTemplate), [currentTemplate]);
};

const useNavigationStructure = () => {
  const { currentTemplate } = useEditorStore();
  return useMemo(() => buildNavigationTree(currentTemplate), [currentTemplate]);
};
```

### UI Design Principles

1. **Progressive Disclosure**: Simple widgets remain simple, complex widgets reveal their power through specialized interfaces
2. **Visual Feedback**: Clear indicators for auto-generation, validation status, and relationship mapping
3. **Real-time Validation**: Immediate feedback on navigation integrity with auto-fix suggestions
4. **Relationship Visibility**: Multiple views (overlay, structure panel, preview modal) to understand complex relationships
5. **Template-Driven**: Leverage templates and patterns to reduce manual configuration overhead

This UI approach treats navigation widgets as **first-class citizens** with specialized editing patterns, providing users full visibility into the complex multi-page relationships while maintaining the simplicity of basic widget editing for standard use cases.

---

This specification provides complete technical foundation for implementing sophisticated multi-page navigation while maintaining e-ink optimization and following the established architectural patterns.