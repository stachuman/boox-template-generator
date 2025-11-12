# Variable System Documentation

**Purpose:** Guide for updating the variable tracking and validation system when adding new auto-generated variables.

**Follows:** CLAUDE.md coding standards - explicit behavior, no silent defaults, fail fast with meaningful errors.

---

## Table of Contents

1. [Variable System Architecture](#variable-system-architecture)
2. [Types of Variables](#types-of-variables)
3. [When to Update the System](#when-to-update-the-system)
4. [Required Code Changes](#required-code-changes)
5. [Testing Checklist](#testing-checklist)
6. [Future Variable Candidates](#future-variable-candidates)

---

## Variable System Architecture

The variable system tracks which variables are available to users during template compilation and PDF rendering.

### Key Components

1. **Backend Generation** - Where variables are actually created
   - `/src/einkpdf/services/compilation_service.py` - Compilation phase variables
   - `/src/einkpdf/core/renderer.py` - Rendering phase variables
   - `/src/einkpdf/core/renderers/*_renderer.py` - Widget-specific variables

2. **Backend Schema** - Documentation and validation
   - `/src/einkpdf/core/project_schema.py` - `BindingContext` class docstring

3. **Frontend Tracking** - User-facing validation
   - `/frontend/src/components/projects/PlanEditor.tsx` - Variable status panel
   - `AUTO_VARIABLES` set - Global auto-generated variables
   - `WIDGET_LOCAL_VARIABLES` set - Widget-scoped variables

4. **Frontend Types** - TypeScript definitions
   - `/frontend/src/types/index.ts` - `BindingContext` interface (optional)

---

## Types of Variables

### 1. Global Auto-Generated Variables

**Definition:** Variables automatically provided by the compilation system, available in all widgets.

**Current Examples:**
- **Rendering phase:** `page`, `total_pages` (added during PDF generation)
- **Always available:** `locale`, `subpage`
- **Date modes:** `date`, `year`, `month`, `month_name`, `day`, `weekday`, `week`, `iso_week`
- **Navigation:** `date_prev`, `date_next`, `month_prev`, `month_next`, etc.

**Characteristics:**
- ✅ Available in any widget content, properties, or styling
- ✅ Available across all masters in a project
- ✅ No user configuration required

### 2. Widget-Local Variables

**Definition:** Variables generated and available ONLY within specific widget types.

**Current Examples:**
- **Table widget:** `row`, `col`, `value` (only in `link_template` property)
- **Day list widget:** Uses global date variables, no local ones

**Characteristics:**
- ⚠️ Limited scope - only within specific widget properties
- ⚠️ NOT available in other widgets
- ⚠️ NOT available in global context

### 3. User-Defined Variables

**Definition:** Variables explicitly defined by users in plan sections.

**Methods:**
- **Counters:** Sequential numbering (e.g., `index`, `page_num`)
- **Context:** Static values (e.g., `project_name`, `category`)

**Characteristics:**
- 🔧 Explicitly defined in plan sections
- 🔧 Can be inherited by nested sections
- 🔧 Validated for naming collisions

---

## When to Update the System

### Scenario 1: Adding a New Global Auto-Generated Variable

**Example:** Adding `quarter` variable for quarterly date modes

**When:**
- Backend compilation service generates a new variable
- Variable should be available in all widgets
- Variable is automatically provided (no user configuration)

**Action:** Update all 4 locations (see [Required Code Changes](#required-code-changes))

### Scenario 2: Adding a New Widget-Local Variable

**Example:** Adding `sheet_name` for multi-sheet table support

**When:**
- Widget renderer generates variables with limited scope
- Variable only makes sense within specific widget context
- Variable is NOT global

**Action:** Update WIDGET_LOCAL_VARIABLES and add documentation

### Scenario 3: Variable is User-Defined

**Example:** Adding support for custom metadata fields

**When:**
- Users explicitly define the variable in Context or Counters
- Variable value comes from user input, not system generation

**Action:** No changes needed (already handled by existing Context/Counters system)

---

## Required Code Changes

### 1. Backend: Generate the Variable

**File:** `/src/einkpdf/services/compilation_service.py`

**Location:** `_build_context()` method (lines ~155-344)

**Example:**
```python
def _build_context(self, section: PlanSection, ...) -> BindingContext:
    """Build binding context for template substitution."""

    # ... existing code ...

    # NEW: Add quarter variable for date-based modes
    if date_obj:
        quarter = (date_obj.month - 1) // 3 + 1  # 1-4
        context.custom['quarter'] = quarter
        context.custom['quarter_name'] = f"Q{quarter}"
```

**Rule:** Following CLAUDE.md Rule #1 - No dummy implementations
- Actually generate the value, don't just set placeholder
- Use proper calculation/logic
- Add to `context.custom` dict for custom variables
- Or add as `context.{field_name}` for BindingContext fields

### 2. Backend: Document in Schema

**File:** `/src/einkpdf/core/project_schema.py`

**Location:** `BindingContext` class docstring (lines ~306-325)

**Example:**
```python
class BindingContext(BaseModel):
    """
    Context for binding resolution during compilation.

    Auto-generated variables (EACH_DAY, EACH_WEEK, EACH_MONTH modes):
    - date, date_long, year, month, month_padded, month_padded3, month_name
    - day, day_padded, weekday
    - quarter, quarter_name  # NEW: Quarterly date grouping
    - Navigation: date_prev, date_next, month_prev, month_next, ...
    - week, iso_week (ISO week number and identifier)

    ...
    """
```

**Rule:** Following CLAUDE.md Rule #2 - Keep it simple
- Update the docstring to document new variables
- List under appropriate category (date-based, always available, etc.)
- Include brief description of format/purpose

### 3. Frontend: Add to AUTO_VARIABLES

**File:** `/frontend/src/components/projects/PlanEditor.tsx`

**Location:** `variableStatus` useMemo, `AUTO_VARIABLES` set (lines ~203-216)

**Example:**
```typescript
const AUTO_VARIABLES = new Set([
  // PDF rendering phase (always available)
  'page', 'total_pages',
  // Always available (regardless of mode)
  'locale',
  // Date-based modes (EACH_DAY, EACH_WEEK, EACH_MONTH)
  'date', 'date_long', 'year', 'month', 'month_padded', 'month_padded3', 'month_name',
  'day', 'day_padded', 'weekday', 'week', 'iso_week',
  'quarter', 'quarter_name',  // NEW: Quarterly variables
  // Navigation (date-based modes only)
  'date_prev', 'date_next', 'month_prev', 'month_next',
  ...
]);
```

**Rule:** Following CLAUDE.md Rule #3 - No default fallbacks
- Only add variables that are ACTUALLY auto-generated
- Don't add variables that require user configuration
- Add comment explaining when variable is available

### 4. Frontend: Add to UI Documentation

**File:** `/frontend/src/components/projects/PlanEditor.tsx`

**Location:** Variable status panel UI (lines ~631-700)

**Example:**
```tsx
<div className="bg-white p-2 rounded border border-green-200">
  <div className="font-semibold text-green-900 mb-1">✅ EACH_DAY mode generates:</div>
  <div className="flex flex-wrap gap-1">
    <Badge variant="outline" className="text-xs bg-green-50">date</Badge>
    <Badge variant="outline" className="text-xs bg-green-50">date_long</Badge>
    ...
    <Badge variant="outline" className="text-xs bg-green-50">quarter</Badge>
    <Badge variant="outline" className="text-xs bg-green-50">quarter_name</Badge>
  </div>
  <div className="text-xs text-green-700 mt-1">
    + Navigation: date_prev, date_next, month_prev, month_next, ...
    + Quarterly: quarter (1-4), quarter_name (Q1-Q4)
  </div>
</div>
```

**Rule:** Following CLAUDE.md Rule #4 - Fail fast with meaningful errors
- Add to EACH mode section (EACH_DAY, EACH_WEEK, EACH_MONTH) if date-based
- Add to "Always available" if global
- Include format/value description

---

## Widget-Local Variables (Separate Process)

### When to Add Widget-Local Variables

**Criteria:**
1. Variable is generated by a specific widget renderer
2. Variable only makes sense within that widget's context
3. Variable is NOT available globally

### Example: Table Widget Variables

**Current Implementation:**

```typescript
// In PlanEditor.tsx
const WIDGET_LOCAL_VARIABLES = new Set([
  // Table widget: Only in link_template property
  'row',      // 1-based row number
  'col',      // 1-based column number
  'value'     // Cell content
]);
```

**UI Documentation:**
```tsx
<div className="bg-white p-2 rounded border border-yellow-200">
  <div className="font-semibold text-yellow-900 mb-1">🔧 Widget-local variables:</div>
  <div className="flex flex-wrap gap-1 mb-2">
    {variableStatus.widgetLocalVariables.map(v => (
      <Badge key={v} variant="outline" className="text-xs bg-yellow-50">
        {v}
      </Badge>
    ))}
  </div>
  <div className="text-xs text-yellow-800">
    <strong>⚠️ Scope limitations:</strong>
    <ul className="list-disc ml-4 mt-1">
      <li><code>row</code>, <code>col</code>, <code>value</code>: Only in <strong>table widget</strong> link_template property</li>
      <li>These are <strong>NOT</strong> available in other widgets or global context</li>
    </ul>
  </div>
</div>
```

---

## Testing Checklist

After adding a new auto-generated variable, verify:

### Backend Tests
- [ ] Variable is actually generated in `_build_context()`
- [ ] Variable has correct value/format
- [ ] Variable is added to appropriate modes (ONCE/COUNT/EACH_DAY/etc.)
- [ ] Compilation succeeds with variable usage
- [ ] PDF rendering includes variable substitution

### Frontend Tests
- [ ] Variable does NOT show as "missing" when used
- [ ] Variable appears in appropriate mode documentation
- [ ] Variable shows in "Auto-generated variables" list
- [ ] `isVariableProvided()` returns true for the variable

### Integration Tests
- [ ] Create master template using the new variable
- [ ] Compile project with variable usage
- [ ] Generate PDF and verify variable substitution
- [ ] Verify variable status panel shows no warnings

---

## Future Variable Candidates

### Likely Additions (Date-based)

1. **`quarter` / `quarter_name`**
   - **Purpose:** Quarterly date grouping (Q1-Q4)
   - **Scope:** Global, date-based modes (EACH_DAY, EACH_WEEK, EACH_MONTH)
   - **Implementation:** Calculate from month: `(month - 1) // 3 + 1`
   - **Example:** `{quarter}` → `1`, `{quarter_name}` → `Q1`

2. **`week_of_month`**
   - **Purpose:** Week number within the current month (1-5)
   - **Scope:** Global, date-based modes
   - **Implementation:** Calculate from day and first day of month
   - **Example:** `{week_of_month}` → `3`

3. **`day_of_year`**
   - **Purpose:** Day number within the year (1-366)
   - **Scope:** Global, date-based modes
   - **Implementation:** Use `date.timetuple().tm_yday`
   - **Example:** `{day_of_year}` → `245`

### Unlikely / Not Recommended

1. **`index`, `index_padded`, `total`**
   - **Status:** ❌ REMOVED - Was previously auto-generated
   - **Reason:** Confusing for users when available/not available
   - **Alternative:** Users define explicitly using Counters
   - **Decision:** Don't add back (see CLAUDE.md Rule #3)

2. **`month_abbr`**
   - **Status:** ❌ NOT IMPLEMENTED (dummy code exists in token_processor.py)
   - **Reason:** `month_name` already serves this purpose via format control
   - **Alternative:** Use `month_name` with widget `month_name_format: 'short'`
   - **Decision:** Remove dummy code, don't implement

3. **User metadata** (e.g., `user_name`, `user_email`)
   - **Status:** ⚠️ Security concern
   - **Reason:** Personal data should not be auto-injected into templates
   - **Alternative:** Users add via Context if needed
   - **Decision:** Require explicit user action

---

## Quick Reference: Update Locations

When adding a **global auto-generated variable:**

1. ✅ **Backend generation:** `/src/einkpdf/services/compilation_service.py` → `_build_context()`
2. ✅ **Backend docs:** `/src/einkpdf/core/project_schema.py` → `BindingContext` docstring
3. ✅ **Frontend tracking:** `/frontend/src/components/projects/PlanEditor.tsx` → `AUTO_VARIABLES`
4. ✅ **Frontend UI:** `/frontend/src/components/projects/PlanEditor.tsx` → Mode documentation

When adding a **widget-local variable:**

1. ✅ **Widget renderer:** `/src/einkpdf/core/renderers/{widget}_renderer.py` → Generate variable
2. ✅ **Frontend tracking:** `/frontend/src/components/projects/PlanEditor.tsx` → `WIDGET_LOCAL_VARIABLES`
3. ✅ **Frontend UI:** `/frontend/src/components/projects/PlanEditor.tsx` → Widget-local documentation

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Adding to Frontend Only

**Problem:** Variable shows as "provided" but doesn't actually exist in backend

**Result:** Silent failure - PDF generation produces `{variable_name}` literal text

**Fix:** Always update backend FIRST, then frontend

### ❌ Mistake 2: Adding to AUTO_VARIABLES When User-Defined

**Problem:** Variable marked as auto-generated but requires user configuration

**Result:** Confusing - users don't understand why variable is "missing"

**Fix:** Only add truly automatic variables to AUTO_VARIABLES

### ❌ Mistake 3: Global Scope for Widget-Local Variables

**Problem:** Adding widget-local variable to AUTO_VARIABLES

**Result:** Users try to use it in other widgets, get errors

**Fix:** Use WIDGET_LOCAL_VARIABLES and document scope limitations

### ❌ Mistake 4: No Documentation

**Problem:** Adding variable to AUTO_VARIABLES but not UI documentation

**Result:** Users don't know the variable exists or when it's available

**Fix:** Always update UI mode documentation sections

---

## Version History

- **2025-11-12:** Initial version documenting current variable system
  - Removed `index`, `index_padded`, `total` from auto-generated (now Counters-only)
  - Added widget-local variables (`row`, `col`, `value` for table widget)
  - Cleaned legacy `label_template`, `bind` dummy properties from projects

---

## See Also

- `/root/eink/CLAUDE.md` - Project coding standards
- `/root/eink/cleanup_legacy_properties.py` - Script for cleaning dummy properties
- `/root/eink/src/einkpdf/core/project_schema.py` - Schema definitions
- `/root/eink/frontend/src/components/projects/PlanEditor.tsx` - Variable status UI
