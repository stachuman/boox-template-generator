"""
Test nested section enumeration for meeting notepad use case.

This test validates the nested enumeration feature:
- Master index page
- 5 project pages (each with project_id counter)
- 10 meeting pages per project (each with meeting_id counter)

Expected total: 1 + 50 = 51 pages
"""
import sys
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from einkpdf.services.compilation_service import CompilationService
from einkpdf.core.project_schema import (
    Project, ProjectMetadata, Plan, PlanSection, GenerateMode,
    Master, CalendarConfig
)
from einkpdf.core.schema import Widget


def test_meeting_notepad():
    """Test nested sections: projects with meetings."""

    # Create masters
    masters = [
        # Master index - links to all projects
        Master(
            name="master_index",
            description="Main index page",
            widgets=[
                Widget(
                    id="title",
                    type="text_block",
                    page=1,
                    position={"x": 50, "y": 50, "width": 400, "height": 50},
                    content="Meeting Notepad - Projects Index",
                    styling={"font_size": 24, "font_weight": "bold"}
                ),
                Widget(
                    id="anchor_home",
                    type="anchor",
                    page=1,
                    position={"x": 0, "y": 0, "width": 10, "height": 10},
                    properties={"dest_id": "home:index"}
                )
            ],
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        ),

        # Project index master - one per project, links to its meetings
        Master(
            name="project_index",
            description="Project index page (parent for meetings)",
            widgets=[
                Widget(
                    id="project_title",
                    type="text_block",
                    page=1,
                    position={"x": 50, "y": 50, "width": 400, "height": 50},
                    content="Project {project_id}",
                    styling={"font_size": 20, "font_weight": "bold"}
                ),
                Widget(
                    id="anchor_project",
                    type="anchor",
                    page=1,
                    position={"x": 0, "y": 0, "width": 10, "height": 10},
                    properties={"dest_id": "project:{project_id}"}
                )
            ],
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        ),

        # Meeting note master - leaf page
        Master(
            name="meeting_note",
            description="Meeting note page",
            widgets=[
                Widget(
                    id="meeting_title",
                    type="text_block",
                    page=1,
                    position={"x": 50, "y": 50, "width": 400, "height": 30},
                    content="Project {project_id} - Meeting {meeting_id}",
                    styling={"font_size": 16}
                ),
                Widget(
                    id="anchor_meeting",
                    type="anchor",
                    page=1,
                    position={"x": 0, "y": 0, "width": 10, "height": 10},
                    properties={"dest_id": "project:{project_id}:meeting:{meeting_id}"}
                )
            ],
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
    ]

    # Create plan with nested sections
    plan = Plan(
        calendar=CalendarConfig(pages_per_day=1),
        sections=[
            # Master index - single page
            PlanSection(
                kind="master_index",
                master="master_index",
                generate=GenerateMode.ONCE,
                context={"total_projects": 5}
            ),

            # Projects section with nested meetings
            PlanSection(
                kind="projects",
                master="project_index",
                generate=GenerateMode.COUNT,
                count=5,
                counters={
                    "project_id": {"start": 1, "step": 1}
                },
                # Nested meetings section
                nested=[
                    PlanSection(
                        kind="meetings",
                        master="meeting_note",
                        generate=GenerateMode.COUNT,
                        count=10,
                        counters={
                            "meeting_id": {"start": 1, "step": 1}
                        }
                    )
                ]
            )
        ],
        order=["master_index", "projects"]
    )

    # Create project
    project = Project(
        id="test_nested",
        metadata=ProjectMetadata(
            name="Meeting Notepad Test",
            description="Test nested sections",
            category="test",
            author="test",
            device_profile="boox-note-air-4c",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        ),
        masters=masters,
        plan=plan,
        default_canvas={
            "dimensions": {"width": 595.2, "height": 841.8, "margins": [72, 72, 72, 72]},
            "coordinate_system": "top_left",
            "background": "#FFFFFF"
        }
    )

    # Compile
    print("Compiling nested project...")
    service = CompilationService()
    result = service.compile_project(project)

    # Validate results
    print(f"\n✓ Compilation successful!")
    print(f"  Total pages: {result.compilation_stats['total_pages']}")
    print(f"  Total widgets: {result.compilation_stats['total_widgets']}")
    print(f"  Sections processed: {result.compilation_stats['sections_processed']}")
    print(f"\n  Pages per section:")
    for section_kind, page_count in result.compilation_stats['pages_generated_per_section'].items():
        print(f"    {section_kind}: {page_count}")

    # Assertions
    # Expected: 1 master index + 5 projects × (1 project page + 10 meeting pages) = 1 + 55 = 56 pages
    assert result.compilation_stats['total_pages'] == 56, \
        f"Expected 56 pages (1 index + 5*(1 project + 10 meetings)), got {result.compilation_stats['total_pages']}"

    assert result.compilation_stats['pages_generated_per_section']['master_index'] == 1, \
        "Master index should generate 1 page"

    # Projects section generates both project index pages AND nested meeting pages
    # So total for "projects" = 5 project pages + 50 meeting pages = 55
    assert result.compilation_stats['pages_generated_per_section']['projects'] == 55, \
        f"Projects section should generate 55 total pages (5 project index + 50 nested meetings), got {result.compilation_stats['pages_generated_per_section']['projects']}"

    assert result.compilation_stats['pages_generated_per_section']['meetings'] == 50, \
        "Meetings section should generate 50 meeting pages (5 projects × 10 meetings)"

    # Check named destinations
    destinations = {dest.id for dest in result.template.navigation.named_destinations}
    print(f"\n  Named destinations created: {len(destinations)}")

    assert "home:index" in destinations, "Home index destination missing"
    assert "project:1" in destinations, "Project 1 destination missing"
    assert "project:5" in destinations, "Project 5 destination missing"
    assert "project:1:meeting:1" in destinations, "Project 1 Meeting 1 destination missing"
    assert "project:5:meeting:10" in destinations, "Project 5 Meeting 10 destination missing"

    # Check that project variables are available in meeting context
    meeting_widgets = [
        w for w in result.template.widgets
        if 'meeting_title' in w.id
    ]
    print(f"\n  Meeting widgets found: {len(meeting_widgets)}")
    assert len(meeting_widgets) == 50, "Should have 50 meeting title widgets"

    # Check a specific meeting title has both project_id and meeting_id resolved
    # Page structure: 1=index, 2=project1, 3-12=project1 meetings, 13=project2, ...
    first_meeting = next(w for w in meeting_widgets if 'page_3' in w.id)  # First meeting (page 3)
    assert "Project 1 - Meeting 1" in first_meeting.content, \
        f"Expected 'Project 1 - Meeting 1', got '{first_meeting.content}'"

    last_meeting = next(w for w in meeting_widgets if 'page_56' in w.id)  # Last meeting (page 56)
    assert "Project 5 - Meeting 10" in last_meeting.content, \
        f"Expected 'Project 5 - Meeting 10', got '{last_meeting.content}'"

    print("\n✓ All assertions passed!")
    print("\nNested section enumeration working correctly:")
    print("  - Parent variables (project_id) inherited by children")
    print("  - Child variables (meeting_id) scoped to child iteration")
    print("  - Hierarchical destination IDs created correctly")


if __name__ == "__main__":
    test_meeting_notepad()
