# Plan Editor UX Improvements

## Overview

Enhanced the Plan Configuration UI with nested sections support and unsaved changes protection to prevent data loss.

## Features Implemented

### 1. Nested Sections Support

**Visual Hierarchy:**
- ✅ Recursive `SectionEditor` component supporting up to 3 levels of nesting
- ✅ Left-border indentation with blue accent color for nested sections
- ✅ `ChevronRight` icons to indicate nesting
- ✅ Level indicators showing "(Level 2)", "(Level 3)"
- ✅ "Add Nested" button on each section (disabled at max depth)
- ✅ Max depth warning when limit is reached

**Page Estimation:**
- ✅ Hierarchical calculation (parent × child iterations)
- ✅ Nested overview in "Generated Sections Overview"
- ✅ Visual indentation matching section hierarchy
- ✅ Warning: "Maximum 1,000 pages per project"

**Validation:**
- ✅ Variable collision detection (checks ancestor variables)
- ✅ Recursive validation of all nested sections
- ✅ Clear error messages with hierarchy context
- ✅ Required field validation per section

### 2. Unsaved Changes Protection

**Change Detection:**
```typescript
// Tracks changes via JSON comparison
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
const [initialPlanJson, setInitialPlanJson] = useState(JSON.stringify(project.plan));

useEffect(() => {
  const currentPlanJson = JSON.stringify(plan);
  setHasUnsavedChanges(currentPlanJson !== initialPlanJson);
}, [plan, initialPlanJson]);
```

**Browser Navigation Warning:**
```typescript
// Warns before closing tab/window with unsaved changes
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = ''; // Required for Chrome
      return '';
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [hasUnsavedChanges]);
```

**Keyboard Shortcut:**
```typescript
// Ctrl+S / Cmd+S to save
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (hasUnsavedChanges && validationErrors.length === 0) {
        handleSave();
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [hasUnsavedChanges, validationErrors]);
```

**Visual Indicators:**
1. **Badge in header:**
   ```tsx
   {hasUnsavedChanges && (
     <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full">
       Unsaved Changes
     </span>
   )}
   ```

2. **Alert banner:**
   ```tsx
   {hasUnsavedChanges && (
     <div className="p-3 bg-amber-50 border border-amber-200 rounded">
       You have unsaved changes. Remember to save before leaving this page.
       Press Ctrl+S to save quickly
     </div>
   )}
   ```

3. **Disabled save button:**
   ```tsx
   <Button
     disabled={!hasUnsavedChanges || validationErrors.length > 0 || isSaving}
     title={hasUnsavedChanges ? "Save changes (Ctrl+S)" : "No changes to save"}
   >
     Save Plan
   </Button>
   ```

## User Experience Flow

### Before Save
```
┌─────────────────────────────────────────┐
│ Plan Configuration [Unsaved Changes]    │
│                                    Save │
├─────────────────────────────────────────┤
│ ⚠️ You have unsaved changes...         │
│         Press Ctrl+S to save quickly    │
├─────────────────────────────────────────┤
│ Section 1: projects                     │
│   ├─ Context: project_id               │
│   └─ Nested Sections                   │
│       └─ → Nested Section 1 (Level 2)  │
│            meetings                     │
└─────────────────────────────────────────┘
```

### Attempting to Leave
```
Browser prompt:
┌────────────────────────────────────┐
│ Leave site?                        │
│ Changes you made may not be saved  │
│                                    │
│           [Leave] [Stay]           │
└────────────────────────────────────┘
```

### After Save
```
┌─────────────────────────────────────────┐
│ Plan Configuration                      │
│                             [Save] (disabled)
├─────────────────────────────────────────┤
│ ✓ Changes saved successfully            │
│                                         │
│ Section 1: projects                     │
└─────────────────────────────────────────┘
```

## Benefits

1. **Prevents Data Loss**
   - Browser warns before navigating away
   - Visual feedback shows unsaved state
   - Keyboard shortcut for quick saving

2. **Improved Workflow**
   - No accidental loss of work
   - Ctrl+S/Cmd+S muscle memory support
   - Clear indication when save is needed

3. **Better Accessibility**
   - Keyboard navigation support
   - Clear visual indicators
   - Helpful tooltips

## Technical Details

### State Management
```typescript
interface EditorState {
  plan: Plan;                    // Current plan being edited
  initialPlanJson: string;       // Snapshot for comparison
  hasUnsavedChanges: boolean;    // Derived from comparison
  validationErrors: ValidationError[];
  isSaving: boolean;
}
```

### Save Flow
```
1. User makes changes
   ↓
2. plan state updates
   ↓
3. useEffect detects change via JSON.stringify()
   ↓
4. hasUnsavedChanges = true
   ↓
5. Visual indicators appear
   ↓
6. User saves (button click or Ctrl+S)
   ↓
7. handleSave() called
   ↓
8. initialPlanJson updated to new plan
   ↓
9. hasUnsavedChanges = false
   ↓
10. Indicators disappear
```

### Edge Cases Handled

1. **Multiple rapid edits**: Debounced via React's batched updates
2. **Save during validation errors**: Button disabled
3. **Save with no changes**: Button disabled
4. **Browser refresh**: beforeunload event fires
5. **Tab close**: beforeunload event fires
6. **Navigation to other route**: Would need React Router integration (TODO)

## Future Improvements (Optional)

1. **Auto-save draft**: Save to localStorage every 30 seconds
2. **Undo/Redo**: Add history management
3. **React Router integration**: Warn before route navigation
4. **Conflict resolution**: Handle concurrent edits from multiple tabs
5. **Visual diff**: Show what changed since last save

## Testing Checklist

- [x] Edit plan section → "Unsaved Changes" badge appears
- [x] Attempt to close tab → Browser warning shows
- [x] Press Ctrl+S → Plan saves successfully
- [x] No changes → Save button disabled
- [x] Validation errors → Save button disabled
- [x] Save successful → Badge disappears
- [x] Keyboard shortcut works on Mac (Cmd+S)
- [x] Keyboard shortcut works on Windows/Linux (Ctrl+S)
- [x] Multiple nested sections → Changes tracked correctly
- [x] Page refresh with unsaved changes → Warning shows

## Code Files Modified

- `frontend/src/types/index.ts` - Added `nested?: PlanSection[]`
- `frontend/src/components/projects/PlanEditor.tsx` - All UX improvements

## Screenshots (Conceptual)

### Unsaved Changes Badge
```
┌──────────────────────────────────────────────┐
│ [Plan Configuration] [Unsaved Changes]  Save │
└──────────────────────────────────────────────┘
```

### Alert Banner
```
┌──────────────────────────────────────────────┐
│ ⚠️  You have unsaved changes. Remember to    │
│     save before leaving this page.           │
│     Press [Ctrl+S] to save quickly           │
└──────────────────────────────────────────────┘
```

### Nested Section Hierarchy
```
Section 1: projects                    ~55 pages
  ├─ Master: project_index | Mode: count
  └─ → meetings (Level 2)              ~50 pages
       └─ Master: meeting_note | Mode: count
```
