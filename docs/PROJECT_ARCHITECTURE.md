# Project-Based Architecture

This document describes the new clean project-based architecture that replaces the previous master/plan compiler system.

## Overview

The new architecture follows a clear separation of concerns:

1. **Design Time**: Users create concrete named pages in the visual editor
2. **Configuration Time**: Users define compilation rules for how pages repeat and link
3. **Build Time**: System compiles project into final template for PDF generation

## Core Concepts

### Project
A workspace that contains:
- **Metadata**: Name, description, device profile, author
- **Named Pages**: Concrete page templates designed in the visual editor
- **Compilation Rules**: Instructions for how to repeat pages and resolve links
- **Canvas Settings**: Default canvas configuration inherited by all pages

### Named Page
A concrete page template with:
- **Name**: Unique identifier within the project
- **Template**: Complete YAML template with widgets, styling, etc.
- **Description**: Human-readable description

### Compilation Rule
Instructions for repeating a named page:
- **Page Reference**: Which named page to use
- **Repeat Mode**: How to repeat (once, each_day, each_week, each_month, count)
- **Date Range**: For date-based repetition
- **Context Rules**: Token substitutions for dynamic content
- **Order**: Position in final template

## Workflow

### 1. Create Project
```bash
POST /api/projects
{
  "name": "My 2026 Planner",
  "description": "Daily planner for 2026",
  "device_profile": "boox-note-air-4c"
}
```

### 2. Design Named Pages
Create concrete page templates in the visual editor:

```bash
POST /api/projects/{project_id}/pages
{
  "name": "Daily Page",
  "template_yaml": "...",  # Complete template YAML
  "description": "Template for daily planning"
}
```

The template YAML can include tokens like `{date}`, `{date_long}`, etc. for dynamic content.

### 3. Configure Compilation Rules
Define how pages should be repeated:

```bash
PUT /api/projects/{project_id}/compilation
{
  "rules": [
    {
      "page_name": "Daily Page",
      "repeat_mode": "each_day",
      "start_date": "2026-01-01",
      "end_date": "2026-12-31",
      "context_rules": {},
      "order": 1
    }
  ]
}
```

### 4. Compile and Download
Generate final template and PDF:

```bash
POST /api/projects/{project_id}/compile
# Returns compiled template YAML

POST /api/pdf/generate
{
  "yaml_content": "...",  # From compile step
  "profile": "boox-note-air-4c"
}
# Returns PDF file
```

## Repeat Modes

### `once`
Generate single instance of the page.

### `each_day`
Generate one page per day in the specified date range.
- Context: `{date}`, `{date_long}`, `{year}`, `{month}`, `{day}`, etc.

### `each_week`
Generate one page per ISO week in the date range.
- Context: `{iso_week}`, `{year}`, etc.

### `each_month`
Generate one page per month in the date range.
- Context: `{year}`, `{month}`, `{month_name}`, etc.

### `count`
Generate specified number of pages.
- Context: `{index}`, `{index_padded}`, `{total}`

## Token Substitution

Named pages can include tokens that get replaced during compilation:

- `{date}` → `2026-01-15`
- `{date_long}` → `Tuesday, January 15, 2026`
- `{year}` → `2026`
- `{month}` → `1`
- `{month_name}` → `January`
- `{index}` → Page number in sequence
- `{total}` → Total pages in sequence

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/{id}` - Get project details
- `PATCH /api/projects/{id}` - Update project metadata
- `DELETE /api/projects/{id}` - Delete project

### Named Pages
- `POST /api/projects/{id}/pages` - Add named page
- `PATCH /api/projects/{id}/pages/{name}` - Update named page
- `DELETE /api/projects/{id}/pages/{name}` - Remove named page

### Compilation
- `PUT /api/projects/{id}/compilation` - Update compilation rules
- `POST /api/projects/{id}/compile` - Compile project to template

## Benefits

### Clean Separation of Concerns
- **Visual Design**: Handled by editor for named pages
- **Business Logic**: Handled by compilation rules
- **PDF Generation**: Handled by existing renderer

### User-Friendly Workflow
1. Create project → Get workspace
2. Design pages → Visual editor
3. Configure rules → Simple form
4. Download PDF → Single click

### Maintainable Codebase
- No mixing of templates, plans, and masters
- Clear data flow: Project → Compilation → Template → PDF
- Testable components with single responsibilities

### Predictable Behavior
- Each named page is concrete and previewable
- Compilation is deterministic
- No hidden runtime magic

## Migration from Old System

The old master/plan compiler system has been replaced. To migrate:

1. **Extract Masters**: Convert parametric masters to concrete named pages
2. **Extract Plans**: Convert plan YAML to compilation rules
3. **Test**: Verify same output with new workflow

The old system files can be found in:
- `src/einkpdf/compiler/build.py` (old)
- `tools/plan_compiler.py` (old)
- `backend/app/api/compile.py` (old)

These should be removed once migration is complete.