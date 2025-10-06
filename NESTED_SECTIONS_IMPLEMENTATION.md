# Nested Section Enumeration - Implementation Summary

## Overview

Implemented nested section enumeration to support hierarchical plan structures (e.g., projects → meetings → tasks), enabling complex document generation like meeting notepads, course curriculums, etc.

## Key Features

### 1. Nested Section Schema (`project_schema.py`)

```yaml
sections:
  - kind: projects
    master: project_index
    generate: count
    count: 5
    counters:
      project_id: {start: 1, step: 1}
    nested:
      - kind: meetings
        master: meeting_note
        generate: count
        count: 10
        counters:
          meeting_id: {start: 1, step: 1}
```

**Constraints:**
- Maximum nesting depth: **3 levels**
- No variable name collisions (validates transitive ancestors)
- Unique section kinds across entire plan (including nested)

### 2. Variable Inheritance

**Parent variables are inherited by all descendants:**
```yaml
projects (project_id=1)
  └─ meetings (inherits project_id=1, adds meeting_id=1..10)
     └─ tasks (inherits project_id=1, meeting_id=1, adds task_id=1..20)
```

**Destination IDs are hierarchical:**
- `project:1`
- `project:1:meeting:5`
- `project:1:meeting:5:task:12`

### 3. Page Limit Validation (Fail-Fast)

**Pre-compilation validation** using `estimate_page_count()`:

```python
# From settings (configurable, default 1000)
MAX_PDF_PAGES = 1000

# Validates BEFORE compilation starts
service.compile_project(project, max_pages=MAX_PDF_PAGES)
```

**Checks:**
1. ✅ Total estimated pages ≤ max_pages
2. ✅ Per-section page count ≤ max_pages
3. ✅ Warning if pages > 50% of limit
4. ✅ Handles nested section multiplication (e.g., 10 × 150 = 1,500 pages)

**Error Example:**
```
Plan validation failed:
  - Section 'projects' would generate 1,500 pages. Maximum allowed: 1,000 per section.
  - Plan would generate approximately 1,500 total pages. Maximum allowed: 1,000.
```

### 4. Variable Collision Detection

**Validates at schema parse time:**

```python
# ✅ VALID: Unique variable names
projects (project_id)
  └─ meetings (meeting_id)
     └─ tasks (task_id)

# ❌ INVALID: Direct parent-child collision
projects (id)
  └─ meetings (id)  # ERROR!

# ❌ INVALID: Transitive grandparent-grandchild collision
projects (id)
  └─ meetings (meeting_id)
     └─ tasks (id)  # ERROR: redefines grandparent variable!

# ✅ VALID: Siblings can reuse names
projects (project_id)
  ├─ meetings (item_id)
  └─ notes (item_id)  # OK: siblings don't inherit from each other
```

**Error Message:**
```
Section 'tasks' redefines ancestor variables: ['id'].
Hierarchy: projects → meetings → tasks.
Use unique variable names (e.g., 'project_id' vs 'meeting_id' vs 'task_id').
```

## Implementation Details

### Schema Extensions (`src/einkpdf/core/project_schema.py`)

1. **PlanSection.nested** field
   - `Optional[List[PlanSection]]` (recursive)
   - Validators:
     - `validate_nesting_depth`: Max 3 levels
     - `validate_no_variable_collisions`: Transitive ancestor check

2. **estimate_page_count()** helper
   - Recursively calculates total pages including nested
   - Handles all GenerateMode types (ONCE, COUNT, EACH_DAY, etc.)
   - Multiplies parent × child counts

3. **Plan.validate_order** updated
   - Only validates top-level section kinds
   - Nested sections ordered implicitly (after parent)

### Enumeration Logic (`src/einkpdf/services/compilation_service.py`)

1. **PlanEnumerator.enumerate_section()**
   - Signature: `→ Iterator[Tuple[BindingContext, List[PlanSection]]]`
   - Returns context + nested sections for each iteration
   - Merges parent context into child contexts

2. **CompilationService._compile_section_recursive()**
   - Generates parent section's pages first
   - Then recurses into nested children with parent context
   - Tracks pages_generated including nested

3. **CompilationService._validate_nested_plan()**
   - Pre-compilation validation (fail-fast)
   - Estimates page count before expensive operations
   - Checks for duplicate section kinds

### Backend Integration

**Updated endpoints:**
- `backend/app/api/projects.py` (compile endpoint)
- `backend/app/api/compile.py` (adhoc compile)
- `backend/app/services/pdf_worker.py` (background jobs)

**All pass `max_pages` from settings:**
```python
from ..config import settings
service.compile_project(project, max_pages=settings.MAX_PDF_PAGES)
```

**Defense-in-depth:**
- Pre-compilation: `_validate_nested_plan()` estimates and fails fast
- Post-compilation: Safety net checks actual page count

## Testing

### Test Files

1. **test_nested_sections.py** - Meeting notepad example
   - 1 master index + 5 projects × (1 index + 10 meetings) = 56 pages
   - Validates variable inheritance
   - Checks hierarchical destination IDs

2. **test_variable_collision.py** - Collision detection
   - Direct parent-child collision ✅
   - Transitive grandparent-grandchild collision ✅
   - Valid nested variables ✅

3. **test_sibling_collision.py** - Sibling sections
   - Siblings can reuse variable names ✅

4. **test_page_limit.py** - Limit validation
   - Flat plan exceeding limit ✅
   - Nested plan exceeding limit ✅
   - Plan within limit ✅

### Test Results

```
✓ All tests PASSED

Nested section enumeration working correctly:
  - Parent variables (project_id) inherited by children
  - Child variables (meeting_id) scoped to child iteration
  - Hierarchical destination IDs created correctly

Page limit validation working correctly:
  - Validates BEFORE compilation (fail-fast)
  - Handles nested section page estimates
  - Uses configurable limit from settings
```

## Usage Example

### Meeting Notepad (3 levels)

```yaml
plan:
  sections:
    - kind: master_index
      master: master_index
      generate: once

    - kind: projects
      master: project_index
      generate: count
      count: 5
      counters:
        project_id: {start: 1, step: 1}
      nested:
        - kind: meetings
          master: meeting_note
          generate: count
          count: 10
          counters:
            meeting_id: {start: 1, step: 1}
          nested:
            - kind: tasks
              master: task_note
              generate: count
              count: 20
              counters:
                task_id: {start: 1, step: 1}

  order: [master_index, projects]
```

**Generated structure:**
- Page 1: Master index
- Page 2: Project 1 index
- Pages 3-12: Project 1, Meeting 1 (1 meeting page + 20 tasks)
- Pages 13-32: Project 1, Meeting 2 (1 meeting page + 20 tasks)
- ... (10 meetings × 21 pages each = 210 pages per project)
- Total: 1 + 5 × (1 + 10 × 21) = **1,056 pages** (would be rejected by default 1000 limit)

## Configuration

### Backend Settings (`backend/app/config.py`)

```python
MAX_PDF_PAGES: int = 1000  # Configurable via env var
```

Set via environment:
```bash
export MAX_PDF_PAGES=2000  # Increase limit for larger projects
```

## CLAUDE.md Compliance

✅ **Rule 1: No Dummy Implementations**
- All enumeration logic is real, no placeholders
- estimate_page_count() handles all generate modes

✅ **Rule 2: No Overcomplicated Code**
- Recursive traversal is straightforward
- Single responsibility: enumerate → compile → validate

✅ **Rule 3: No Default Fallbacks Without Confirmation**
- Max depth = 3 (hard limit, not configurable)
- Variable collisions → exception, not silent override
- Page limits are explicit and configurable

✅ **Rule 4: Fail Fast**
- Pre-compilation validation catches page count explosions
- Pydantic validators run on schema parse
- Clear error messages with actionable fixes

✅ **Rule 5: Challenge Incorrect Requests**
- Identified unbounded nesting as dangerous
- Proposed explicit limits instead of "make it flexible"
- Fixed transitive collision detection bug

## Migration Notes

**Backwards Compatible:**
- Existing plans without `nested` field work unchanged
- `order` validation unchanged for non-nested plans
- Default max_pages=1000 matches existing behavior

**Breaking Changes:**
- None - nested sections are opt-in feature
