#!/usr/bin/env python3
"""
Simple year test to debug token resolution issues.
"""

import sys
from pathlib import Path
from datetime import date

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from einkpdf.core.project_schema import (
    Project, ProjectMetadata, Master, Plan, PlanSection, CalendarConfig,
    GenerateMode, LinkResolution
)
from einkpdf.core.schema import Widget, Position
from einkpdf.services.compilation_service import CompilationService


def create_simple_project() -> Project:
    """Create a simple project to test token resolution."""

    metadata = ProjectMetadata(
        name="Simple Test",
        description="Simple test for token resolution",
        category="test",
        author="Test",
        device_profile="boox-note-air-4c",
        created_at="2024-01-01T00:00:00Z",
        updated_at="2024-01-01T00:00:00Z"
    )

    # Simple month master
    month_widgets = [
        Widget(
            id="month_title",
            type="text_block",
            position=Position(x=306, y=100, width=200, height=30),
            content="{month_name} {year}",
            properties={"font_size": 20}
        ),
        Widget(
            id="month_anchor",
            type="anchor",
            position=Position(x=0, y=0, width=1, height=1),
            properties={"dest_id": "month:{year}-{month:02d}"}
        )
    ]

    masters = [Master(
        name="month",
        description="Month page",
        widgets=month_widgets,
        created_at="2024-01-01T00:00:00Z",
        updated_at="2024-01-01T00:00:00Z"
    )]

    # Plan for just January 2026
    calendar = CalendarConfig(
        start_date="2026-01-01",
        end_date="2026-01-31",
        pages_per_day=1
    )

    sections = [
        PlanSection(
            kind="months",
            master="month",
            generate=GenerateMode.EACH_MONTH,
            start_date="2026-01-01",
            end_date="2026-01-31"
        )
    ]

    plan = Plan(
        calendar=calendar,
        sections=sections,
        order=["months"]
    )

    project = Project(
        id="simple-test",
        metadata=metadata,
        masters=masters,
        plan=plan,
        link_resolution=LinkResolution(),
        default_canvas={
            "dimensions": {"width": 612, "height": 792, "margins": [72, 72, 72, 72]},
            "coordinate_system": "top_left",
            "background": "#FFFFFF"
        }
    )

    return project


def main():
    """Test simple compilation."""
    print("Simple compilation test")
    project = create_simple_project()
    compiler = CompilationService()

    try:
        result = compiler.compile_project(project)
        print(f"✅ Success: {result.compilation_stats['total_pages']} pages")

        # Check compiled destinations
        nav = result.template.navigation
        destinations = nav.get('named_destinations', [])
        print(f"Destinations: {[d['id'] for d in destinations]}")

    except Exception as e:
        print(f"❌ Failed: {e}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())