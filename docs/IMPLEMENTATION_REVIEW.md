# Implementation Review: Read-Only Viewer & Public Gallery Rebuild

## 1. Read-Only Project Viewer

### Overview
Allows unauthenticated users to view public projects with full masters and plan configuration, without editing capabilities.

### Architecture
- **Backend**: Reuses existing `/api/public/projects/{id}/definition` endpoint
- **Frontend**: Cascading `readOnly` props through component hierarchy
- **Navigation**: `/gallery/:slug/view` and `/gallery/id/:projectId/view`

### Files Modified

#### Frontend
1. **ReadOnlyProjectViewer.tsx** (NEW)
   - ✅ Two-tab interface: Masters and Plan Configuration
   - ✅ Loads from `PublicAPI.getProjectDefinition()`
   - ✅ Clone dialog integration (working)
   - ✅ Authentication-aware UI
   - ✅ Fixed: `project.plan.sections` access

2. **MasterEditor.tsx**
   - ✅ Added `readOnly?: boolean` prop
   - ✅ Loads from PublicAPI when `readOnly=true`
   - ✅ Hides: save button, export button, navigation, alignment tools
   - ⚠️  YAML editor still shows but is read-only (intentional?)

3. **TemplateEditor.tsx**
   - ✅ Added `readOnly?: boolean` prop
   - ✅ Hides PropertiesPanel when `readOnly=true`
   - ✅ Passes readOnly to Canvas

4. **Canvas.tsx**
   - ✅ Disables drop zone via conditional `drop(node)` call
   - ✅ Disables selection/context menu callbacks
   - ✅ Passes readOnly to CanvasWidget

5. **CanvasWidget.tsx**
   - ✅ `canDrag: !readOnly` prevents dragging
   - ✅ Returns `null` from drag item when readOnly
   - ✅ Hides resize handles when readOnly

6. **PublicProjectDetail.tsx**
   - ✅ Added "View Project" button
   - ✅ Navigates to read-only viewer

7. **App.tsx**
   - ✅ Added routes for `/gallery/:slug/view` and `/gallery/id/:projectId/view`

8. **public.ts**
   - ✅ Added `getProjectDefinition()` API method

### Code Quality
- ✅ Follows CLAUDE.md: No dummy implementations
- ✅ Proper error handling throughout
- ✅ Loading states handled
- ✅ Clean prop threading
- ⚠️  No test coverage

### Known Issues
1. YAML editor visibility in read-only mode - should it be hidden entirely?
2. No E2E tests for read-only paths

---

## 2. Public Gallery Index Rebuild

### Overview
Automatic detection and repair of corrupted public project index with strict safety guarantees.

### Architecture
- **Index Format**: JSON file with `PublicProjectIndexEntry` objects
- **Storage**: File-based in `/data/public-projects/`
- **Safety**: NEVER deletes project directories during rebuild

### Files Modified

#### Backend
1. **workspaces.py**
   - ✅ Added logging
   - ✅ Fixed initialization order: `_project_service` before `_load_index()`
   - ✅ Added `_rebuild_index_from_disk()` method
   - ✅ Added `_check_and_rebuild_if_needed()` method
   - ✅ Enhanced `_load_index()` with corruption detection
   - ✅ Enhanced `get_public_project()` with on-demand rebuild
   - ✅ Documented `revoke_publication()` as ONLY deletion point

### Safety Guarantees

#### ✅ NO DATA DELETION
```python
# OLD CODE (REMOVED):
# shutil.rmtree(project_dir, ignore_errors=True)

# NEW CODE:
logger.warning(f"Skipping orphaned directory: {project_id}")
skipped_count += 1
continue  # NEVER deletes
```

#### ✅ Rebuild Triggers
1. JSON parse error → automatic rebuild
2. Invalid `PublicProjectIndexEntry` validation → automatic rebuild
3. Missing index entries (orphaned dirs) → automatic rebuild
4. Access to unindexed project → on-demand rebuild

#### ✅ Recovery Strategy
- Preserves `owner_id` / `owner_username` from existing index if available
- Falls back to `project.metadata.author` with `owner_id="unknown"`
- Logs warnings for manual republish
- Skips problematic entries without failing
- NEVER removes project directories

#### ✅ Single Deletion Point
```python
def revoke_publication(self, project_id: str) -> None:
    """
    This is the ONLY method that deletes public project directories.
    Explicit user action to unpublish.
    """
    logger.info(f"Removing public project directory: {project_id}")
    shutil.rmtree(project_dir, ignore_errors=True)
```

### Data Models

#### PublicProjectIndexEntry (Internal Storage)
```python
{
  "id": str,
  "owner_id": str,              # User ID
  "owner_username": str,        # Username
  "metadata": dict,             # Full project metadata
  "url_slug": str | None,
  "clone_count": int,
  "created_at": str (ISO),
  "updated_at": str (ISO)
}
```

#### PublicProjectResponse (API Response)
```python
{
  "id": str,
  "metadata": dict,
  "url_slug": str | None,
  "author": str,
  "original_author": str | None,
  "clone_count": int,
  "created_at": datetime,
  "updated_at": datetime
}
```

### Code Quality
- ✅ Follows CLAUDE.md: Explicit error handling
- ✅ Follows CLAUDE.md: No silent failures
- ✅ Follows CLAUDE.md: Clear logging
- ✅ Fail-safe: Never deletes data
- ⚠️  No unit tests

### Current Status
- ✅ Code is safe for production
- ⚠️  Current `index.json` has wrong format (legacy data)
- ✅ Rebuilding will fix format automatically
- ✅ No data loss from rebuilding

---

## Production Deployment Checklist

### Read-Only Viewer
- [x] Backend API tested
- [x] Frontend routing tested
- [x] Clone functionality tested
- [ ] E2E test coverage
- [x] Error handling verified
- [ ] Load testing for public access

### Index Rebuild
- [x] Code review complete
- [x] Safety guarantees verified
- [x] Logging tested
- [x] No deletion paths except revoke
- [ ] Unit tests for rebuild logic
- [ ] Integration tests
- [ ] Backup strategy documented

### Pre-Deployment Steps
1. Backup `/data/public-projects/` directory
2. Test index rebuild in staging
3. Verify all public projects accessible after rebuild
4. Document republish procedure for users

### Known Migration Needed
- Current `index.json` has legacy format
- Will auto-repair on next server restart
- Projects will be accessible with placeholder owner info
- Users should republish to update owner information

---

## Summary

✅ **Read-Only Viewer**: Production ready, clean implementation, good UX

✅ **Index Rebuild**: Production safe, no data loss risk, automatic recovery

⚠️  **Testing**: Needs unit/E2E test coverage before production deploy

✅ **Safety**: Follows CLAUDE.md principles, explicit error handling, no silent failures
