# E‑ink PDF Templates

A quick look at the editor and output:

![E‑ink PDF Templates](pic-1.png)

![Calendar - example](/docs/examples/)

[Sample demo server](https://dokumenty.cgpsmapper.com)

A web UI + Python backend for designing static, link‑only PDFs optimized for Boox e‑ink devices. Includes device profiles, deterministic rendering, and a visual editor.

## 🚀 Project Status

**✅ Phase 1 MVP COMPLETED** - All core components implemented and tested

- Device profile system with constraint enforcement ✅
- Coordinate system conversion (top-left ↔ bottom-left) ✅ 
- PDF rendering with ReportLab (text, checkbox, input, divider) ✅
- Navigation features (destinations, outlines, links) ✅
- Ground truth preview generation with PyMuPDF ✅
- Deterministic PDF builds for testing ✅
- Golden file testing framework ✅

**Ready for Phase 2**: Forms and E-ink Optimization

## 🎯 Features

### Core Capabilities
- **Interactive PDF Generation**: Create PDFs with internal navigation, bookmarks, and links
- **Device Optimization**: Boox Onyx-specific profiles with constraint enforcement
- **Ground Truth Preview**: Pixel-perfect PNG previews matching final PDF output
- **Template Validation**: YAML-based templates with Pydantic schema validation
- **Deterministic Builds**: Reproducible PDF generation for testing and version control

### Widget Types (Phase 1)
- **Text Blocks**: Styled text with font, size, and color control
- **Checkboxes**: Interactive checkboxes with labels and touch target optimization
- **Text Inputs**: Form input fields with labels
- **Dividers**: Horizontal lines for layout structure

### Device Profiles
- **Boox Note Air 4C**: 10.3" E-ink display (1872×1404, 227 PPI)
- **Constraint Enforcement**: Minimum font sizes, touch targets, stroke widths
- **E-ink Optimization**: Grayscale levels and fill area constraints

## Architecture
- Frontend: Vite + React (served by Nginx in Docker)
- Backend: FastAPI (ReportLab + pikepdf + PyMuPDF)
- Profiles: YAML files defining device constraints (min font, touch target, etc.)
- Output: Static PDFs with internal link navigation (no forms/JS)

## Quick Start (Docker)
1) Profiles: ensure your host has `/config/profiles` with device YAMLs.
2) Build and run:
   - `docker compose build`
   - `docker compose up -d`
3) Open the app:
   - Frontend: `http://localhost:3000` (override with `FRONTEND_PORT`)
   - API is proxied internally by Nginx (`/api`, `/ws`)

Data persists in the named volume `eink_data` (mounted at `/app/backend/data`). Profiles are bind‑mounted read‑only to `/app/config/profiles`.

## Configuration
- Frontend port: set `FRONTEND_PORT` env for compose (default 3000)
- Profiles directory: host `/config/profiles` → container `/app/config/profiles`
- Cleanup on startup (backend):
  - `EINK_CLEANUP_TTL_DAYS=14` (set ≤0 to disable)
  - `EINK_CLEANUP_MAX_TEMPLATES` (optional cap)

## Library Usage (Python)
```python
from einkpdf.validation.yaml_validator import parse_yaml_template
from einkpdf.core.renderer import render_template

# Load template
with open("template.yaml", "r") as f:
    template = parse_yaml_template(f.read())

# Generate PDF
pdf_bytes = render_template(
    template, 
    profile="Boox-Note-Air-4C",
    deterministic=True
)

# Save PDF
with open("output.pdf", "wb") as f:
    f.write(pdf_bytes)
```

### Generate Preview
```python
from einkpdf.core.preview import generate_ground_truth_preview

# Generate PNG preview from PDF bytes
preview_bytes = generate_ground_truth_preview(
    pdf_bytes,
    page_number=1,
    scale=2.0
)

# Save preview
with open("preview.png", "wb") as f:
    f.write(preview_bytes)
```

### Template Format
```yaml
schema_version: "1.0"

metadata:
  name: "Sample Template"
  description: "Basic template example"
  profile: "Boox-Note-Air-4C"

canvas:
  dimensions:
    width: 595.2   # A4 width in points
    height: 841.8  # A4 height in points
    margins: [72, 72, 72, 72]  # 1 inch margins
  background: "#FFFFFF"

widgets:
  - id: "title"
    type: "text_block"
    page: 1
    content: "Document Title"
    position:
      x: 72
      y: 100
      width: 400
      height: 30
    styling:
      font: "Helvetica-Bold"
      size: 18
      color: "#000000"
    properties:
      bookmark: "title_section"

navigation:
  named_destinations:
    - id: "title_section"
      page: 1
      x: 72
      y: 100
      fit: "FitH"

  outlines:
    - title: "Document Title"
      dest: "title_section"
      level: 1
```

## Development
```bash
# Backend
python -m venv einkpdf-env && source einkpdf-env/bin/activate
pip install -e .[dev]
uvicorn backend.app.main:app --reload

# Frontend
cd frontend && npm ci && npm run dev
```

### Golden File Testing
```bash
# Capture new golden file
python tools/golden_file_cli.py capture "test_name" "template.yaml" "Boox-Note-Air-4C"

# Validate against golden file
python tools/golden_file_cli.py validate "test_name" "template.yaml" "Boox-Note-Air-4C"

# Run all golden file tests
python tools/golden_file_cli.py run-tests

# List golden files
python tools/golden_file_cli.py list
```

## Device Profiles
Place YAML files under `/config/profiles` on the host. The backend reads from `/app/config/profiles` (bind‑mounted). You can override with `EINK_PROFILE_DIR`.

## 🔧 Architecture

### Multi-Pass Rendering Pipeline
1. **ReportLab Pass**: Generate base PDF with widgets and content
2. **pikepdf Pass**: Add navigation features (destinations, outlines, links)
3. **Deterministic Pass**: Fix timestamps and metadata for reproducible builds
4. **Preview Pass**: Generate ground-truth PNG preview with PyMuPDF

### Coordinate System
- **Templates**: Top-left origin (0,0 at top-left corner)
- **PDF Output**: Bottom-left origin (ReportLab standard)
- **Automatic Conversion**: Seamless transformation between coordinate systems

## 📊 Performance

### Phase 1 MVP Metrics
- **PDF Generation**: ~2.1KB typical output with navigation
- **Preview Generation**: ~19.9KB PNG (scale 2.0)
- **Deterministic Builds**: 100% reproducible (identical SHA256 hashes)
- **Test Coverage**: 7/7 core components validated

## License
AGPL‑3.0‑or‑later.
