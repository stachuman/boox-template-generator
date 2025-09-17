# E-ink PDF Templates - Web Interface Guide

## Phase 1.5: Web Interface Complete ✅

The web interface for E-ink PDF Templates is now fully implemented with a modern React frontend and FastAPI backend.

## 🎯 Features Implemented

### ✅ Backend (FastAPI)
- **REST API**: Complete CRUD operations for templates, PDF generation, preview, and device profiles
- **WebSocket Support**: Real-time preview updates during template editing
- **Template Storage**: JSON-indexed file-based template management
- **Error Handling**: Comprehensive error responses with proper HTTP status codes
- **CORS Support**: Ready for React frontend integration
- **API Documentation**: Automatic OpenAPI/Swagger docs at `/docs`

### ✅ Frontend (React + TypeScript)
- **Template Gallery**: Browse, create, edit, and delete templates with thumbnails
- **Drag-and-Drop Editor**: Visual template designer with widget palette
- **Real-time Preview**: Live preview updates via WebSocket connection
- **Device Profiles**: Device-specific constraint validation and preview
- **Property Editing**: Comprehensive property panel for widget customization
- **Responsive Design**: Modern UI with Tailwind CSS and e-ink-optimized color palette

## 🚀 Quick Start

### 1. Start Backend Server
```bash
# Option 1: Using the startup script
python start_backend.py

# Option 2: Manual startup
cd backend
source ../einkpdf-env/bin/activate
python -m app.main
```

Backend will be available at:
- **API**: http://127.0.0.1:8000/api
- **Docs**: http://127.0.0.1:8000/docs
- **WebSocket**: ws://127.0.0.1:8000/ws

### 2. Start Frontend Server
```bash
# Option 1: Using the startup script
python start_frontend.py

# Option 2: Manual startup
cd frontend
npm install  # Only needed first time
npm run dev
```

Frontend will be available at:
- **App**: http://localhost:3000

## 🎨 User Interface

### Template Gallery
- **Overview**: Browse all saved templates with thumbnails
- **Actions**: Create new templates, edit existing ones, delete templates
- **Metadata**: View creation date, author, and device profile for each template

### Template Editor
- **Canvas**: Visual editing area with grid overlay and zoom controls
- **Widget Palette**: Drag-and-drop widgets (text blocks, checkboxes, inputs, dividers)
- **Properties Panel**: Edit widget properties, positioning, styling, and navigation
- **Preview Panel**: Real-time preview with WebSocket updates
- **Toolbar**: Save, export PDF, device profile selection, and view controls

### Widget Types (Phase 1)
- ✅ **Text Block**: Styled text with font, size, and color options
- ✅ **Checkbox**: Interactive checkboxes with customizable size and labels
- ✅ **Text Input**: Form input fields with labels
- ✅ **Divider**: Horizontal line separators

## 🔧 Technical Architecture

### Frontend Stack
- **React 18**: Component-based UI framework
- **TypeScript**: Type safety and better development experience
- **Vite**: Fast development and build tooling
- **Tailwind CSS**: Utility-first styling with e-ink color palette
- **React DnD**: Drag-and-drop functionality for widget placement
- **Zustand**: State management for editor state
- **Axios**: HTTP client for API communication

### Backend Stack
- **FastAPI**: Modern Python web framework with automatic documentation
- **Uvicorn**: ASGI server for development and production
- **WebSockets**: Real-time communication for live preview
- **Pydantic**: Data validation and serialization
- **einkpdf Library**: Integration with Phase 1 PDF generation engine

### Communication
- **REST API**: CRUD operations, PDF generation, device profiles
- **WebSocket**: Real-time preview updates during editing
- **Proxy Configuration**: Vite dev server proxies API calls to FastAPI backend

## 📁 Project Structure

```
eink/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py            # FastAPI application entry point
│   │   ├── models.py          # Pydantic request/response models
│   │   ├── services.py        # Business logic layer
│   │   ├── websockets.py      # WebSocket handlers
│   │   └── api/               # REST API endpoints
│   │       ├── templates.py   # Template CRUD operations
│   │       ├── pdf.py         # PDF/preview generation
│   │       └── profiles.py    # Device profile management
│   └── requirements.txt       # Python dependencies
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── Navigation.tsx
│   │   │   ├── TemplateGallery.tsx
│   │   │   ├── TemplateEditor.tsx
│   │   │   └── editor/        # Editor-specific components
│   │   ├── services/          # API and WebSocket clients
│   │   ├── stores/            # Zustand state management
│   │   ├── types/             # TypeScript type definitions
│   │   └── main.tsx           # React application entry point
│   ├── package.json           # Node.js dependencies
│   ├── vite.config.ts         # Vite configuration
│   └── tailwind.config.js     # Tailwind CSS configuration
└── src/einkpdf/               # Phase 1 PDF engine (unchanged)
```

## 🧪 Testing

### Backend Testing
```bash
# Test backend services directly
python test_backend_services.py

# Test FastAPI endpoints (requires running server)
python test_backend.py
```

### Frontend Testing
The React frontend includes:
- TypeScript type checking
- ESLint code quality checks
- Component-based architecture for testability

## 🔌 API Reference

### Templates
- `GET /api/templates/` - List all templates
- `POST /api/templates/` - Create new template
- `GET /api/templates/{id}` - Get specific template
- `PUT /api/templates/{id}` - Update template
- `DELETE /api/templates/{id}` - Delete template

### PDF Generation
- `POST /api/pdf/generate` - Generate PDF from template
- `POST /api/pdf/preview` - Generate PNG preview from template

### Device Profiles
- `GET /api/profiles/` - List available device profiles
- `GET /api/profiles/{name}` - Get specific device profile

### WebSocket
- `WS /ws/{client_id}` - Real-time preview updates

## 🎯 Next Steps

The web interface is now complete and provides a full end-to-end solution for creating interactive PDF templates. The system is ready for:

1. **Phase 2**: Forms and E-ink Optimization
2. **Production Deployment**: Docker containers, cloud hosting
3. **Advanced Features**: Template inheritance, advanced widgets, collaborative editing

## 🐛 Known Limitations

- YAML parsing/serialization is currently placeholder (JSON used instead)
- Widget resizing handles are visual only (no resize functionality yet)
- Template thumbnails are placeholders (no actual preview thumbnails)
- No keyboard shortcuts implemented
- No collaborative editing features

## 📄 License

AGPL v3.0 (compatible with PyMuPDF licensing requirements)