#!/usr/bin/env python3
"""
Full-scale test for master/plan compiler - complete year (389 pages).

This test verifies the compilation system can handle:
- 2026-01-01 → 2026-12-31 (365 days)
- 1 index + 1 year + 12 months + 365 days + 10 notes = 389 pages total
- Profile-driven validation
- Case normalization
- Binding grammar validation
- Post-compile validation
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
from einkpdf.core.profiles import load_device_profile


def create_full_year_project() -> Project:
    """Create a comprehensive 2026 project with full-year coverage."""

    # Create project metadata
    metadata = ProjectMetadata(
        name="2026 Complete Digital Planner",
        description="Full-year planner with Index → Year → Months → Days → Notes structure",
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
            content="2026 Complete Planner",
            properties={"font_size": 24, "font_weight": "bold", "text_align": "center"}
        ),
        Widget(
            id="year_link",
            type="internal_link",
            position=Position(x=306, y=200, width=150, height=44),  # 44pt for good touch target
            content="→ Year 2026",
            properties={"to_dest": "year:2026", "font_size": 16}
        ),
        Widget(
            id="notes_grid",
            type="grid",
            position=Position(x=100, y=300, width=400, height=200),
            properties={
                "rows": 2,
                "cols": 5,
                "data_source": "range(1, 11)",
                "cell_template": {
                    "type": "internal_link",
                    "content": "Note {cell_value}",
                    "properties": {
                        "bind": "notes(@cell_value)",  # Function-like binding
                        "font_size": 12,
                        "text_align": "center"
                    }
                }
            }
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
            id="calendar_year_widget",
            type="calendar_year",
            position=Position(x=100, y=200, width=400, height=300),
            properties={
                "year": "{year}",
                "month_cell_bind": "month(@cell_month)"  # Function-like binding
            }
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
            id="calendar_month_widget",
            type="calendar_month",
            position=Position(x=100, y=200, width=400, height=250),
            properties={
                "year": "{year}",
                "month": "{month}",
                "day_cell_bind": "day(@cell_date)"  # Function-like binding
            }
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
            position=Position(x=306, y=300, width=100, height=44),  # Profile-compliant touch target
            content="→ Notes",
            properties={"bind": "notes(1)", "font_size": 14}  # Function-like binding
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
            id="back_to_index",
            type="internal_link",
            position=Position(x=50, y=500, width=100, height=44),
            content="← Home",
            properties={"to_dest": "home:index", "font_size": 12}
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

    # Create plan for FULL YEAR
    start_date = date(2026, 1, 1)
    end_date = date(2026, 12, 31)

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
        id="full-year-2026",
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
    """Test full-year compilation with comprehensive validation."""
    print("🚀 Full-Year Master/Plan Compiler Test (389 pages)")
    print("=" * 60)

    # Create full-year project
    print("📋 Creating full-year 2026 project...")
    project = create_full_year_project()
    print(f"✓ Created project with {len(project.masters)} masters and {len(project.plan.sections)} plan sections")

    # Load device profile for validation
    print("\n📱 Loading device profile...")
    try:
        device_profile = load_device_profile(project.metadata.device_profile)
        profile_dict = device_profile.model_dump()
        print(f"✓ Loaded profile: {device_profile.name}")
        print(f"  - Min touch target: {device_profile.constraints.min_touch_target_pt}pt")
        print(f"  - Min font size: {device_profile.constraints.min_font_pt}pt")
    except Exception as e:
        print(f"⚠️  Warning: Could not load device profile: {e}")
        profile_dict = None

    # Initialize compilation service
    print("\n🔧 Initializing compilation service...")
    compiler = CompilationService()
    print("✓ Compilation service ready")

    # Compile full-year project
    print("\n⚡ Compiling full-year project...")
    try:
        result = compiler.compile_project(project, profile_dict)
        print("✅ Full-year compilation successful!")

        # Validate expected page count
        stats = result.compilation_stats
        total_pages = stats['total_pages']
        expected_pages = 1 + 1 + 12 + 365 + 10  # index + year + months + days + notes

        print(f"\n📊 Compilation Statistics:")
        print(f"  Total pages: {total_pages} (expected: {expected_pages})")
        print(f"  Total widgets: {stats['total_widgets']}")
        print(f"  Sections processed: {stats['sections_processed']}")

        for section, count in stats['pages_generated_per_section'].items():
            print(f"  📄 {section}: {count} pages")

        # Validate page count
        if total_pages == expected_pages:
            print("✅ Page count matches expected value!")
        else:
            print(f"❌ Page count mismatch! Expected {expected_pages}, got {total_pages}")
            return 1

        # Validate template structure
        print(f"\n🔍 Template Validation:")
        print(f"  Schema version: {result.template.schema_version}")
        print(f"  Template name: {result.template.metadata.name}")

        # Check navigation
        nav = result.template.navigation
        destinations = nav.get('named_destinations', [])
        links = nav.get('links', [])
        print(f"  Named destinations: {len(destinations)}")
        print(f"  Internal links: {len(links)}")

        # Validate critical anchors exist
        dest_ids = {dest['id'] for dest in destinations}
        critical_dests = [
            "home:index",
            "year:2026",
            "month:2026-01", "month:2026-12",  # First and last month
            "day:2026-01-01", "day:2026-12-31",  # First and last day
            "notes:page:001", "notes:page:010"   # First and last note
        ]

        missing_dests = [dest for dest in critical_dests if dest not in dest_ids]
        if missing_dests:
            print(f"❌ Missing critical destinations: {missing_dests}")
            return 1
        else:
            print("✅ All critical destinations present")

        # Validate destination format (post-compile)
        invalid_dests = []
        for dest_id in dest_ids:
            # Should be lowercase and follow canonical format
            if dest_id != dest_id.lower():
                invalid_dests.append(f"'{dest_id}' not lowercase")
            if '{' in dest_id or '}' in dest_id or '@' in dest_id:
                invalid_dests.append(f"'{dest_id}' contains template tokens")

        if invalid_dests:
            print(f"❌ Invalid destination formats: {invalid_dests[:5]}...")  # Show first 5
            return 1
        else:
            print("✅ All destinations follow canonical format")

        # Test specific months have correct day counts
        monthly_links = {}
        for link in links:
            if link.get('to_dest', '').startswith('day:'):
                month = link['to_dest'][4:11]  # Extract YYYY-MM
                if month not in monthly_links:
                    monthly_links[month] = 0
                monthly_links[month] += 1

        # Check February (28 days in 2026) and December (31 days)
        if monthly_links.get('2026-02', 0) != 28:
            print(f"❌ February 2026 should have 28 day links, got {monthly_links.get('2026-02', 0)}")
            return 1

        if monthly_links.get('2026-12', 0) != 31:
            print(f"❌ December 2026 should have 31 day links, got {monthly_links.get('2026-12', 0)}")
            return 1

        print("✅ Month day counts are correct")

        print(f"\n🎉 SUCCESS: Full-year compilation generated {total_pages} pages with complete validation!")

        # Performance summary
        if total_pages > 350:
            print("📈 Performance: Successfully handled large-scale compilation (350+ pages)")

        return 0

    except Exception as e:
        print(f"❌ Full-year compilation failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())