# Storage Consolidation Plan

## ✅ COMPLETED - October 2, 2025

All storage has been successfully consolidated to `backend/data/`.

## Current State

### backend/data/ (Existing - Docker mounted)
- users/{user_id}/projects/         ✅ User project files
- public-projects/                  ✅ Public shared projects
- templates/                        ✅ Template storage
- projects/                         ✅ Additional projects

### storage/ (Created in Phase 0 - NOT mounted)
- einkpdf.sqlite                    ❌ Database here
- assets/                           ❌ Empty (future images)
- jobs/                             ❌ Empty (future PDFs)

## Target State: backend/data/ (Single Source)

```
/root/eink/backend/data/
├── einkpdf.sqlite                  # Move from storage/
├── assets/                         # Move from storage/
│   └── {sha256_hash}.{ext}        # Content-addressable images
├── jobs/                           # Move from storage/
│   └── {job_id}.pdf               # Generated PDFs
├── users/                          # Already here ✅
│   └── {user_id}/
│       └── projects/{project_id}/
├── public-projects/                # Already here ✅
├── templates/                      # Already here ✅
└── projects/                       # Already here ✅
```

## Migration Steps

### Step 1: Move Database and Directories
```bash
# Stop backend service first
sudo systemctl stop eink-backend

# Move database
mv /root/eink/storage/einkpdf.sqlite /root/eink/backend/data/
mv /root/eink/storage/einkpdf.sqlite-shm /root/eink/backend/data/ 2>/dev/null || true
mv /root/eink/storage/einkpdf.sqlite-wal /root/eink/backend/data/ 2>/dev/null || true

# Move asset and job directories
mv /root/eink/storage/assets /root/eink/backend/data/
mv /root/eink/storage/jobs /root/eink/backend/data/

# Verify
ls -la /root/eink/backend/data/
```

### Step 2: Update Configuration

**backend/app/config.py:**
```python
class Settings(BaseSettings):
    # Database - relative to backend working directory
    DATABASE_URL: str = "sqlite:///data/einkpdf.sqlite"
    
    # Storage Paths - relative to backend working directory
    STORAGE_DIR: Path = Path("data")
    ASSETS_DIR: Path = Path("data/assets")
    JOBS_DIR: Path = Path("data/jobs")
```

### Step 3: Update workspaces.py

**backend/app/workspaces.py:**
```python
def _resolve_data_root() -> Path:
    """Resolve the base data directory for user and public storage."""
    env_root = os.getenv("EINK_DATA_DIR")
    if env_root:
        root = Path(env_root)
    else:
        # Use data directory relative to backend
        root = Path(__file__).resolve().parent / "data"
    root.mkdir(parents=True, exist_ok=True)
    return root
```

### Step 4: Update Docker Compose (Already Correct!)

**docker-compose.yml** - Should already have:
```yaml
services:
  backend:
    volumes:
      - eink_data:/app/backend/data  # Already mounted ✅
      - ./config/profiles:/app/config/profiles:ro
    environment:
      - DATABASE_URL=sqlite:///data/einkpdf.sqlite
      - EINK_DATA_DIR=/app/backend/data
```

### Step 5: Update Alembic

**backend/alembic.ini:**
```ini
# Already points to correct location since backend is working dir
script_location = %(here)s/alembic
```

### Step 6: Clean Up

```bash
# Remove old storage directory (after verifying everything works)
rm -rf /root/eink/storage/

# Update .gitignore
# (backend/data already ignored)
```

## Advantages

✅ **No User Data Migration** - Projects already in backend/data/users/
✅ **Docker Already Configured** - Volume mount exists
✅ **Single Backup Location** - Backup backend/data/
✅ **Consistent Paths** - Everything under backend/data/
✅ **Simple** - Just move database, update config

## Configuration Changes Required

### 1. backend/app/config.py
Change:
- `DATABASE_URL: str = "sqlite:///storage/einkpdf.sqlite"`
- `STORAGE_DIR: Path = Path("storage")`

To:
- `DATABASE_URL: str = "sqlite:///data/einkpdf.sqlite"`
- `STORAGE_DIR: Path = Path("data")`

### 2. backend/app/workspaces.py
Change:
- `root = Path(__file__).resolve().parents[1] / "data"`

To:
- `root = Path(__file__).resolve().parent / "data"`

### 3. docker-compose.yml
Change (if needed):
- `DATABASE_URL=sqlite:///storage/einkpdf.sqlite`

To:
- `DATABASE_URL=sqlite:///data/einkpdf.sqlite`

## Testing Checklist

After migration:
- [x] Backend starts successfully
- [x] Database connection works
- [x] Users can login (tested with stachuman)
- [x] Projects load correctly (empty array for new user)
- [ ] Can create new projects (not tested yet)
- [x] Assets directory accessible
- [x] Jobs directory accessible

## Rollback Plan

If something goes wrong:
```bash
# Stop backend
sudo systemctl stop eink-backend

# Restore database to storage/
mv /root/eink/backend/data/einkpdf.sqlite* /root/eink/storage/

# Restore directories
mv /root/eink/backend/data/assets /root/eink/storage/
mv /root/eink/backend/data/jobs /root/eink/storage/

# Revert config.py changes
# Restart backend
sudo systemctl start eink-backend
```

## Documentation Updates Needed

- [ ] PHASE0_SUMMARY.md - Update storage paths
- [ ] PHASE1_USER_MIGRATION_SUMMARY.md - Update paths
- [ ] DOCKER_SETUP.md - Update volume mount documentation
- [ ] MULTIUSER_IMPLEMENTATION_PLAN.md - Update storage architecture
- [ ] README.md - Update storage location

