# E-ink PDF Templates - Service Management

## Quick Start

The E-ink PDF Templates system now uses systemctl services for easy management.

### Service Management Commands

Use the `eink-services` command from anywhere in the system:

```bash
# Start both services
eink-services start

# Stop both services  
eink-services stop

# Restart both services (useful after code changes)
eink-services restart

# Check service status
eink-services status

# View recent logs
eink-services logs

# Enable services to start on boot
eink-services enable
```

### Individual Service Commands

```bash
# Backend only
eink-services start-backend
eink-services restart-backend
eink-services logs-backend

# Frontend only  
eink-services start-frontend
eink-services restart-frontend
eink-services logs-frontend
```

### When to Restart Services

**Frontend**: 
- ✅ **Auto-reload works** for UI changes (PropertiesPanel, CanvasWidget, etc.)
- ❌ **Restart needed** for major configuration changes

**Backend**: 
- ✅ **Auto-reload works** for API changes in `/root/eink/backend/`
- ❌ **Restart needed** for core PDF engine changes in `/root/eink/src/`

### After Lines Widget Changes

Since the Lines widget renderer is in `/root/eink/src/einkpdf/core/renderer.py`, restart the backend:

```bash
eink-services restart-backend
```

### Access URLs

- **Frontend**: http://localhost:3001 (auto-switched from 3000)
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Service Files Location

- Backend service: `/etc/systemd/system/eink-backend.service`
- Frontend service: `/etc/systemd/system/eink-frontend.service`
- Management script: `/root/eink/manage-services.sh`
- Symlink: `/usr/local/bin/eink-services`

### Troubleshooting

**Check service status:**
```bash
eink-services status
```

**View detailed logs:**
```bash
eink-services logs-backend
eink-services logs-frontend
```

**Manual systemctl commands:**
```bash
systemctl status eink-backend
systemctl status eink-frontend
journalctl -u eink-backend -f
journalctl -u eink-frontend -f
```

### Development Workflow

1. **Make code changes**
2. **If frontend changes**: Changes auto-reload (no restart needed)
3. **If backend core changes**: `eink-services restart-backend` 
4. **Test changes** at http://localhost:3000
5. **View logs** if needed: `eink-services logs`

This systemctl setup makes service management much easier and more reliable!