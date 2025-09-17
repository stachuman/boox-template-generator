# E-ink PDF Templates - Project Summary

## Overview
A React + Python system for creating interactive PDF templates optimized for e-ink devices. Users design templates in a web interface and generate PDFs with clickable links and navigation.

## Architecture
- **Frontend**: React/TypeScript with Vite, Zustand state management, Tailwind CSS
- **Backend**: Python FastAPI with ReportLab PDF generation
- **Services**: Managed via `manage-services.sh` script (ports 3000 frontend, 8000 backend)

## Current Status: ✅ FULLY FUNCTIONAL

### Completed Features
- **Multi-page templates** with page management (add/delete/duplicate/batch operations)
- **Widget system**: Text blocks, checkboxes, dividers, ruled lines, anchors, calendars
- **Calendar widgets**: Monthly and weekly views with clickable date links
- **Navigation system**: Clickable PDF links (sequential pages, named destinations)
- **Device profiles**: E-ink optimized constraints and validation
- **Canvas editor**: Drag-drop, zoom, grid, real-time preview
- **PDF generation**: Multi-page output with proper coordinate conversion

### Widget Types Available
1. **Text Block**: Static text with styling
2. **Checkbox**: Interactive checkboxes
3. **Divider**: Horizontal separator lines
4. **Lines**: Ruled lines for handwriting (solid/dotted/dashed/grid)
5. **Anchor**: Clickable links within PDFs
6. **Calendar**: Monthly/weekly calendars with date navigation

### Key Files
- **Frontend**: `/frontend/src/components/editor/` (Canvas, WidgetPalette, Properties, PageManager)
- **Backend**: `/src/einkpdf/core/renderer.py` (PDF generation)
- **Types**: `/frontend/src/types/index.ts` (TypeScript definitions)
- **Services**: `manage-services.sh` (start/stop script)

## Development Commands
```bash
# Start services
./manage-services.sh start

# Stop services  
./manage-services.sh stop

# Manual start (if needed)
cd frontend && npm run dev    # Port 3000
cd backend && uvicorn app.main:app --reload --port 8000
```

## Code Standards
- Follows CLAUDE.md: Explicit validation, fail-fast errors, no dummy implementations
- TypeScript strict mode, proper error handling
- E-ink optimized: 1-2px strokes, 44px+ touch targets, monochrome design

## Next Steps
- Table/Grid widget implementation (pending)
- Additional widget types as needed
- Enhanced styling options

## Testing
- Calendar widgets tested with multi-page navigation
- Batch page operations verified
- PDF generation working for all widget types
- Sequential page links and named destinations functional

*Last updated: December 2024*