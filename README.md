# E‑ink PDF Templates

A complete web application for designing interactive PDF templates optimized for e‑ink devices. Features a visual editor, multi-user authentication, public project gallery, and professional PDF generation.

![E‑ink PDF Templates](pic-1.png)

![Calendar - example](/docs/examples/)

**Demo server**: [https://eink.cgpsmapper.com](https://eink.cgpsmapper.com)
**Tutorial**: [TUTORIAL.md](TUTORIAL.md)

## 🚀 Project Status

**✅ Phase 1 & 2 COMPLETED** - Full-featured application with user management

### ✅ Core PDF Engine
- Device profile system with constraint enforcement
- Coordinate system conversion (top-left ↔ bottom-left)
- PDF rendering with ReportLab (text, checkbox, input, divider)
- Navigation features (destinations, outlines, links)
- Ground truth preview generation with PyMuPDF
- Deterministic PDF builds for testing

### ✅ Web Application Features
- **Multi-user authentication** with JWT tokens
- **Project management** with versioning and metadata
- **Visual editor** with drag-and-drop interface
- **Master/Plan system** for parametric templates
- **Compilation rules** for repeated page generation
- **Public gallery** for sharing templates with the community
- **Real-time preview** with WebSocket updates
- **PDF download** and export functionality

### ✅ User Experience
- Responsive design optimized for desktop and mobile
- User registration and authentication system
- Project cloning and sharing capabilities
- Version tracking (v0.2.1)
- Donation support integration

## 🎯 Features

### PDF Generation Engine
- **Interactive PDF Creation**: PDFs with internal navigation, bookmarks, and links
- **Device Optimization**: 9 e-ink device profiles with constraint enforcement
- **Ground Truth Preview**: Pixel-perfect PNG previews matching final PDF output
- **Template Validation**: YAML-based templates with Pydantic schema validation
- **Deterministic Builds**: Reproducible PDF generation for testing and version control

### Project Management
- **Multi-user Workspace**: Individual user accounts with project isolation
- **Project Versioning**: Track changes and maintain project history
- **Master Templates**: Create reusable template components
- **Plan System**: Define parametric template configurations
- **Compilation Rules**: Generate multiple pages with different data contexts

### Public Gallery
- **Template Sharing**: Publish projects to the community gallery
- **Project Cloning**: One-click duplication of public templates
- **PDF Downloads**: Direct download of compiled PDFs from gallery
- **Usage Tracking**: View clone counts and project popularity

### Widget Types
- **Text Blocks**: Styled text with font, size, and color control
- **Checkboxes**: Interactive checkboxes with labels and touch target optimization
- **Text Inputs**: Form input fields with labels
- **Dividers**: Horizontal lines for layout structure

### Device Profiles (9 Supported)
- **Boox Note Air 4C**: 10.3" E-ink (1872×1404, 227 PPI)
- **reMarkable 2**: 10.3" E-ink (1872×1404, 226 PPI)
- **Kindle Scribe**: 10.2" E-ink (1860×2480, 300 PPI)
- **Supernote A5X**: 10.3" E-ink (1872×1404, 227 PPI)
- **Supernote A6X**: 7.8" E-ink (1872×1404, 300 PPI)
- **Supernote Manta**: 10.3" E-ink (1872×1404, 227 PPI)
- **Kobo Sage**: 8" E-ink (1440×1920, 300 PPI)
- **Kobo Elipsa 2E**: 10.3" E-ink (1872×1404, 227 PPI)
- **Custom profiles**: Easy to add new devices via YAML configuration

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for utility-first styling
- **Zustand** for state management
- **React Router** for navigation
- **Axios** for API communication
- **React Hook Form** for form validation

### Backend Stack
- **FastAPI** with Python for high-performance API
- **JWT** authentication with secure token handling
- **ReportLab** for PDF generation
- **pikepdf** for PDF post-processing
- **PyMuPDF** for preview generation
- **Pydantic** for data validation
- **File-based storage** for user data and projects

### Infrastructure
- **Docker** containerization with multi-stage builds
- **Nginx** reverse proxy and static file serving
- **WebSocket** support for real-time preview updates
- **CORS** configuration for cross-origin requests

## 🚀 Quick Start (Docker)

### Prerequisites
- Docker and Docker Compose installed
- Device profile files in `/config/profiles/` (included in repository)

### Installation
```bash
# Clone the repository
git clone https://github.com/stachuman/boox-template-generator.git
cd boox-template-generator

# Build and start the application
docker compose build
docker compose up -d
```

### Access the Application
- **Frontend**: `http://localhost:3000` (set `FRONTEND_PORT` to override)
- **API**: Automatically proxied through Nginx at `/api` and `/ws`

### First Steps
1. **Register an account** at `http://localhost:3000/register`
2. **Create your first project** from the dashboard
3. **Design your template** using the visual editor
4. **Preview and download** your PDF
5. **Share to gallery** to contribute to the community

### Data Persistence
- User data and projects: Docker volume `eink_data`
- Device profiles: Host directory `/config/profiles/` (read-only)

## ⚙️ Configuration

### Environment Variables
```bash
# Frontend
FRONTEND_PORT=3000              # Port for web interface

# Backend Data Storage
EINK_DATA_DIR=/app/backend/data # User data storage directory
EINK_PROFILE_DIR=/app/config/profiles # Device profiles directory

# Cleanup Settings
EINK_CLEANUP_TTL_DAYS=14        # Auto-cleanup after N days (set ≤0 to disable)
EINK_CLEANUP_MAX_TEMPLATES=1000 # Maximum templates to keep (optional)

# Security
JWT_SECRET_KEY=your-secret-key  # JWT token signing key (auto-generated if not set)
```

### Docker Compose Override
Create `docker-compose.override.yml` for custom configuration:
```yaml
version: '3.8'
services:
  backend:
    environment:
      - EINK_CLEANUP_TTL_DAYS=30
      - JWT_SECRET_KEY=your-custom-secret

  frontend:
    ports:
      - "8080:80"  # Custom port mapping
```

## 💻 Development

### Local Development Setup
```bash
# Backend development
python -m venv einkpdf-env
source einkpdf-env/bin/activate  # Linux/Mac
# or: .\einkpdf-env\Scripts\activate  # Windows

pip install -e .[dev]
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend development (separate terminal)
cd frontend
npm ci
npm run dev  # Starts on http://localhost:3000
```

### API Library Usage (Python)
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

## 🌐 Web Application Usage

### User Account Management
- **Registration**: Create account with username/email/password
- **Authentication**: Secure JWT-based login system
- **Profile**: Manage account settings and view project history

### Project Workflow
1. **Create Project**: Start with blank template or clone from gallery
2. **Design Interface**: Use visual editor with drag-and-drop widgets
3. **Master/Plan System**: Create parametric templates with variables
4. **Compilation Rules**: Define how pages should be repeated/generated
5. **Preview & Test**: Real-time preview with WebSocket updates
6. **Export**: Download PDF or share to public gallery

### Collaboration Features
- **Public Gallery**: Browse community-shared templates
- **Project Cloning**: One-click duplication of public projects
- **Usage Tracking**: View how many times your templates are used
- **Version Control**: Track project changes over time

### Template Format
The application uses YAML-based templates for configuration:
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

## 📊 Performance & Metrics

### Application Performance
- **PDF Generation**: ~2.1KB typical output with navigation
- **Preview Generation**: ~19.9KB PNG (scale 2.0)
- **Real-time Updates**: WebSocket-based preview updates <100ms
- **Authentication**: JWT token-based with secure session management
- **Deterministic Builds**: 100% reproducible (identical SHA256 hashes)

### Scalability
- **Multi-user Support**: File-based storage with user isolation
- **Device Profiles**: 9 supported e-ink devices with easy expansion
- **Project Management**: Unlimited projects per user
- **Gallery System**: Community sharing with clone tracking
- **Container Ready**: Docker deployment with volume persistence

### Current Version
- **Application Version**: v0.2.1
- **API Compatibility**: Stable v1 endpoints
- **Database Migration**: Automatic user data migration support

## 🤝 Contributing

### How to Contribute
1. **Fork the repository** on GitHub
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** following the coding standards in `CLAUDE.md`
4. **Test your changes** thoroughly
5. **Submit a pull request** with a clear description

### Development Guidelines
- Follow the coding standards in `CLAUDE.md`
- Add tests for new functionality
- Update documentation as needed
- Ensure all existing tests pass

### Issues and Support
- **Bug Reports**: [GitHub Issues](https://github.com/stachuman/boox-template-generator/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/stachuman/boox-template-generator/discussions)
- **Tutorial**: [TUTORIAL.md](TUTORIAL.md)

## 💖 Support the Project

This project is **free and open source**. If you find it useful, consider supporting development:

**☕ Donate**: [PayPal.me/StachuMan](https://paypal.me/StachuMan)

Your support helps maintain and improve the project for the entire community!

## 📄 License

**AGPL-3.0-or-later** - This project is free software that ensures freedom for all users.

## 🔗 Links

- **Repository**: [https://github.com/stachuman/boox-template-generator](https://github.com/stachuman/boox-template-generator)
- **Demo**: [https://eink.cgpsmapper.com](https://eink.cgpsmapper.com)
- **Tutorial**: [TUTORIAL.md](TUTORIAL.md)
- **Issues**: [GitHub Issues](https://github.com/stachuman/boox-template-generator/issues)

---

**Version**: v0.2.1 | **Built with**: React + FastAPI + ReportLab | **Optimized for**: E-ink devices
