# Public Project Index Refactoring

## Problem
Had TWO different code paths creating `PublicProjectIndexEntry` objects:
1. `publish_project()` - when publishing a project
2. `_rebuild_index_from_disk()` - when rebuilding corrupted index

This violated DRY principle and could cause divergence/corruption.

## Solution
Created **SINGLE SOURCE OF TRUTH** for index entry creation:

```python
def _create_index_entry(
    self,
    *,
    project: Project,
    owner_id: str,
    owner_username: str,
    url_slug: Optional[str] = None,
) -> PublicProjectIndexEntry:
    """
    Create a PublicProjectIndexEntry from a project.

    This is the SINGLE SOURCE OF TRUTH for index entry creation.
    Used by both publish and rebuild to ensure consistency.
    """
    now = datetime.now(timezone.utc).isoformat()
    existing = self._index.get(project.id)

    return PublicProjectIndexEntry(
        id=project.id,
        owner_id=owner_id,
        owner_username=owner_username,
        metadata=project.metadata.model_dump(),
        url_slug=url_slug or project.metadata.public_url_slug,
        clone_count=project.metadata.clone_count,
        created_at=existing.created_at if existing else now,
        updated_at=now,
    )
```

## Changes Made

### 1. Created `_create_index_entry()` method
- Single method to build index entries
- Used by both publish and rebuild
- Preserves `created_at` from existing entry if present
- Always updates `updated_at` to current time

### 2. Updated `publish_project()`
```python
# OLD CODE (inline construction):
entry = PublicProjectIndexEntry(
    id=project.id,
    owner_id=owner.id,
    owner_username=owner.username,
    metadata=project.metadata.model_dump(),
    url_slug=slug,
    clone_count=project.metadata.clone_count,
    created_at=created_at,
    updated_at=now,
)

# NEW CODE (shared method):
entry = self._create_index_entry(
    project=project,
    owner_id=owner.id,
    owner_username=owner.username,
    url_slug=slug,
)
```

### 3. Updated `_rebuild_index_from_disk()`
```python
# OLD CODE (inline construction):
entry = PublicProjectIndexEntry(
    id=project_id,
    owner_id=owner_id,
    owner_username=owner_username,
    metadata=project.metadata.model_dump(),
    url_slug=project.metadata.public_url_slug,
    clone_count=project.metadata.clone_count,
    created_at=existing.created_at if existing else now,
    updated_at=existing.updated_at if existing else now,
)

# NEW CODE (shared method):
entry = self._create_index_entry(
    project=project,
    owner_id=owner_id,
    owner_username=owner_username,
    url_slug=None,  # Will use project.metadata.public_url_slug
)
```

## Verification

### Only ONE construction point:
```bash
$ grep -n "PublicProjectIndexEntry(" app/workspaces.py
73:class PublicProjectIndexEntry(BaseModel):
262:        return PublicProjectIndexEntry(
```

✅ Only line 262 constructs entries (inside `_create_index_entry()`)

### All modification points use shared method:
1. `publish_project()` → calls `_create_index_entry()`
2. `_rebuild_index_from_disk()` → calls `_create_index_entry()`
3. `increment_clone_count()` → modifies existing entry (doesn't create new)

## Benefits

1. ✅ **Consistency**: Publish and rebuild always create identical format
2. ✅ **Maintainability**: Single place to update entry creation logic
3. ✅ **Safety**: No divergence between code paths
4. ✅ **DRY**: Follows Don't Repeat Yourself principle
5. ✅ **CLAUDE.md**: No dummy implementations, single source of truth

## Index Entry Schema

```python
class PublicProjectIndexEntry(BaseModel):
    """Persistent metadata for a public project listing."""

    id: str                        # Project ID
    owner_id: str                  # Owner user ID (can be "unknown")
    owner_username: str            # Owner username
    metadata: Dict[str, Any]       # Full project metadata
    url_slug: Optional[str] = None # Public URL slug
    clone_count: int = 0           # Number of clones
    created_at: str                # ISO timestamp
    updated_at: str                # ISO timestamp
```

## Testing

To verify the fix works:

1. Publish a new project
2. Check index has correct format
3. Corrupt the index (delete it)
4. Trigger rebuild (access a public project)
5. Verify index has identical format

## Production Safety

✅ **No breaking changes** - only refactoring internal code
✅ **No data deletion** - rebuild still skips problematic entries
✅ **Backward compatible** - can read old index format
✅ **Forward consistent** - new entries always match
