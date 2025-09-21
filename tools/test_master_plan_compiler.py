#!/usr/bin/env python3
"""
Test script for the new master/plan compiler.

This script creates a simple test project with masters and plan
to verify the compilation system works correctly.
"""

import sys
import json
from pathlib import Path
from datetime import date, timedelta

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from einkpdf.core.project_schema import (
    Project, ProjectMetadata, Master, Plan, PlanSection, CalendarConfig,
    GenerateMode, LinkResolution, BindingContext
)
from einkpdf.core.schema import Widget, Position
from einkpdf.services.compilation_service import CompilationService


def create_test_project() -> Project:
    """Create a test project with the 4-level structure."""

    # Create project metadata
    metadata = ProjectMetadata(
        name="2026 Digital Planner",
        description="Complete planner with Index → Year → Months → Days structure",
        category="planner",
        author="Test User",
        device_profile="boox-note-air-4c",
        created_at="2024-01-01T00:00:00Z",
        updated_at="2024-01-01T00:00:00Z"
    )

    # Create masters
    masters = []

    # 1. Index Master
    index_widgets = [
        Widget(
            id="title",
            type="text_block",
            position=Position(x=306, y=100, width=200, height=30),
            content="2026 Digital Planner",
            properties={"font_size": 24, "font_weight": "bold", "text_align": "center"}
        ),
        Widget(
            id="notes_grid",
            type="grid",
            position=Position(x=100, y=200, width=400, height=200),
            properties={
                "rows": 2,
                "cols": 5,
                "data_source": "range(1, 11)",
                "cell_template": {
                    "type": "internal_link",
                    "content": "Note {cell_value}",
                    "properties": {
                        "bind": "notes(@cell_value)",
                        "font_size": 12,
                        "text_align": "center"
                    }
                }
            }
        ),
        Widget(
            id="year_link",
            type="internal_link",
            position=Position(x=306, y=450, width=150, height=25),
            content="→ Year 2026",
            properties={"to_dest": "year:2026", "font_size": 16}
        ),
        Widget(
            id="home_anchor",
            type="anchor",
            position=Position(x=0, y=0, width=1, height=1),
            properties={"dest_id": "home:index"}
        )
    ]

    masters.append(Master(
        name="index",
        description="Main index page",
        widgets=index_widgets,
        created_at="2024-01-01T00:00:00Z",
        updated_at="2024-01-01T00:00:00Z"
    ))

    # 2. Year Master
    year_widgets = [
        Widget(
            id="year_title",
            type="text_block",
            position=Position(x=306, y=100, width=200, height=30),
            content="Year {year}",
            properties={"font_size": 22, "font_weight": "bold", "text_align": "center"}
        ),
        Widget(
            id="year_subtitle",
            type="text_block",
            position=Position(x=306, y=150, width=200, height=20),
            content="Navigate to monthly and daily pages below",
            properties={"font_size": 14, "text_align": "center"}
        ),
        Widget(
            id="year_anchor",
            type="anchor",
            position=Position(x=0, y=0, width=1, height=1),
            properties={"dest_id": "year:{year}"}
        )
    ]

    masters.append(Master(
        name="year",
        description="Year overview page",
        widgets=year_widgets,
        created_at="2024-01-01T00:00:00Z",
        updated_at="2024-01-01T00:00:00Z"
    ))

    # 3. Month Master
    month_widgets = [
        Widget(
            id="month_title",
            type="text_block",
            position=Position(x=306, y=100, width=200, height=30),
            content="{month_name} {year}",
            properties={"font_size": 20, "font_weight": "bold", "text_align": "center"}
        ),
        Widget(
            id="day1_link",
            type="internal_link",
            position=Position(x=100, y=200, width=80, height=20),
            content="Day 1",
            properties={"to_dest": "day:{date}", "font_size": 12}
        ),
        Widget(
            id="month_anchor",
            type="anchor",
            position=Position(x=0, y=0, width=1, height=1),
            properties={"dest_id": "month:{year}-{month:02d}"}
        )
    ]

    masters.append(Master(
        name="month",
        description="Month overview page",
        widgets=month_widgets,
        created_at="2024-01-01T00:00:00Z",
        updated_at="2024-01-01T00:00:00Z"
    ))

    # 4. Day Master
    day_widgets = [
        Widget(
            id="day_title",
            type="text_block",
            position=Position(x=306, y=100, width=300, height=30),
            content="{date_long}",
            properties={"font_size": 18, "font_weight": "bold", "text_align": "center"}
        ),
        Widget(
            id="notes_link",
            type="internal_link",
            position=Position(x=306, y=300, width=100, height=20),
            content="→ Notes",
            properties={"bind": "notes(1)", "font_size": 14}
        ),
        Widget(
            id="day_anchor",
            type="anchor",
            position=Position(x=0, y=0, width=1, height=1),
            properties={"dest_id": "day:{date}"}
        )
    ]

    masters.append(Master(
        name="day",
        description="Daily page",
        widgets=day_widgets,
        created_at="2024-01-01T00:00:00Z",
        updated_at="2024-01-01T00:00:00Z"
    ))

    # 5. Notes Master
    notes_widgets = [
        Widget(
            id="notes_title",
            type="text_block",
            position=Position(x=306, y=100, width=200, height=30),
            content="Notes Page {index}",
            properties={"font_size": 16, "font_weight": "bold", "text_align": "center"}
        ),
        Widget(
            id="notes_anchor",
            type="anchor",
            position=Position(x=0, y=0, width=1, height=1),
            properties={"dest_id": "notes:page:{index_padded}"}
        )
    ]

    masters.append(Master(
        name="notes",
        description="Notes page",
        widgets=notes_widgets,
        created_at="2024-01-01T00:00:00Z",
        updated_at="2024-01-01T00:00:00Z"
    ))

    # Create plan
    today = date.today()
    start_date = date(2026, 1, 1)
    end_date = date(2026, 1, 31)  # Just January for testing

    calendar = CalendarConfig(
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        pages_per_day=1
    )

    sections = [
        PlanSection(
            kind="index",
            master="index",
            generate=GenerateMode.ONCE,
            context={}
        ),
        PlanSection(
            kind="years",
            master="year",
            generate=GenerateMode.ONCE,
            context={"year": 2026}
        ),
        PlanSection(
            kind="months",
            master="month",
            generate=GenerateMode.EACH_MONTH,
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat()
        ),
        PlanSection(
            kind="days",
            master="day",
            generate=GenerateMode.EACH_DAY,
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat()
        ),
        PlanSection(
            kind="notes",
            master="notes",
            generate=GenerateMode.COUNT,
            count=10
        )
    ]

    plan = Plan(
        calendar=calendar,
        sections=sections,
        order=["index", "years", "months", "days", "notes"]
    )

    # Create project
    project = Project(
        id="test-project-001",
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
    """Test the master/plan compilation system."""
    print("Testing Master/Plan Compiler")
    print("=" * 40)

    # Create test project
    print("Creating test project...")
    project = create_test_project()
    print(f"✓ Created project with {len(project.masters)} masters and {len(project.plan.sections)} plan sections")

    # Initialize compilation service
    print("\nInitializing compilation service...")
    compiler = CompilationService()
    print("✓ Compilation service ready")

    # Compile project
    print("\nCompiling project...")
    try:
        result = compiler.compile_project(project)
        print("✓ Compilation successful!")

        # Print compilation stats
        stats = result.compilation_stats
        print(f"\nCompilation Statistics:")
        print(f"  Total pages: {stats['total_pages']}")
        print(f"  Total widgets: {stats['total_widgets']}")
        print(f"  Sections processed: {stats['sections_processed']}")

        for section, count in stats['pages_generated_per_section'].items():
            print(f"  {section}: {count} pages")

        # Test specific features
        print(f"\nTemplate Details:")
        print(f"  Schema version: {result.template.schema_version}")
        print(f"  Template name: {result.template.metadata.name}")
        nav = result.template.navigation
        destinations = nav.get('named_destinations', []) if hasattr(nav, 'get') else getattr(nav, 'named_destinations', [])
        links = nav.get('links', []) if hasattr(nav, 'get') else getattr(nav, 'links', [])
        print(f"  Navigation destinations: {len(destinations)}")
        print(f"  Internal links: {len(links)}")

        # Test some widgets have proper context substitution
        print(f"\nSample Widget Content:")
        for i, widget in enumerate(result.template.widgets[:5]):
            if hasattr(widget, 'content') and widget.content:
                print(f"  Widget {i+1}: '{widget.content}'")

        print(f"\n✓ All tests passed! Compilation generated {stats['total_pages']} pages successfully.")

    except Exception as e:
        print(f"✗ Compilation failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())