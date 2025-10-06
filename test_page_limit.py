"""
Test that page limit validation happens BEFORE compilation.

This validates fail-fast behavior: plans exceeding the limit should be
rejected during validation, not after expensive compilation.
"""
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent / "src"))

from einkpdf.services.compilation_service import CompilationService, CompilationServiceError
from einkpdf.core.project_schema import (
    Project, ProjectMetadata, Plan, PlanSection, GenerateMode,
    Master, CalendarConfig
)
from einkpdf.core.schema import Widget


def test_page_limit_validation():
    """Test that page limit is enforced before compilation starts."""

    # Create a simple master
    masters = [
        Master(
            name="page",
            description="Simple page",
            widgets=[
                Widget(
                    id="title",
                    type="text_block",
                    page=1,
                    position={"x": 50, "y": 50, "width": 400, "height": 50},
                    content="Page {index}",
                    styling={"font_size": 16}
                )
            ],
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
    ]

    # Create plan that exceeds limit (1500 pages)
    plan = Plan(
        calendar=CalendarConfig(pages_per_day=1),
        sections=[
            PlanSection(
                kind="pages",
                master="page",
                generate=GenerateMode.COUNT,
                count=1500,  # Exceeds default 1000 limit
                counters={"index": {"start": 1, "step": 1}}
            )
        ],
        order=["pages"]
    )

    project = Project(
        id="test_limit",
        metadata=ProjectMetadata(
            name="Page Limit Test",
            description="Test page limit enforcement",
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

    print("Test 1: Plan exceeding limit (1500 pages, limit 1000)...")
    service = CompilationService()

    try:
        result = service.compile_project(project, max_pages=1000)
        print("  ❌ FAILED: Should have raised CompilationServiceError before compilation")
        return False
    except CompilationServiceError as e:
        error_msg = str(e)
        if "1,500" in error_msg and "1,000" in error_msg and "Maximum allowed" in error_msg:
            print(f"  ✓ PASSED: Caught page limit error - {error_msg}")
            return True
        else:
            print(f"  ❌ FAILED: Wrong error message - {error_msg}")
            return False


def test_nested_page_limit():
    """Test that nested section page estimates are validated."""

    masters = [
        Master(
            name="page",
            description="Simple page",
            widgets=[
                Widget(
                    id="title",
                    type="text_block",
                    page=1,
                    position={"x": 50, "y": 50, "width": 400, "height": 50},
                    content="Page",
                    styling={"font_size": 16}
                )
            ],
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
    ]

    # Nested plan: 10 × 150 = 1500 pages (exceeds 1000 limit)
    plan = Plan(
        calendar=CalendarConfig(pages_per_day=1),
        sections=[
            PlanSection(
                kind="projects",
                master="page",
                generate=GenerateMode.COUNT,
                count=10,
                nested=[
                    PlanSection(
                        kind="items",
                        master="page",
                        generate=GenerateMode.COUNT,
                        count=150  # 10 × 150 = 1500 total
                    )
                ]
            )
        ],
        order=["projects"]
    )

    project = Project(
        id="test_nested_limit",
        metadata=ProjectMetadata(
            name="Nested Page Limit Test",
            description="Test nested page limit",
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

    print("\nTest 2: Nested sections exceeding limit (10×150=1500 pages, limit 1000)...")
    service = CompilationService()

    try:
        result = service.compile_project(project, max_pages=1000)
        print("  ❌ FAILED: Should have raised CompilationServiceError for nested page count")
        return False
    except CompilationServiceError as e:
        error_msg = str(e)
        if "1,500" in error_msg and "Maximum allowed" in error_msg:
            print(f"  ✓ PASSED: Caught nested page limit error - {error_msg}")
            return True
        else:
            print(f"  ❌ FAILED: Wrong error message - {error_msg}")
            return False


def test_within_limit():
    """Test that plans within limit compile successfully."""

    masters = [
        Master(
            name="page",
            description="Simple page",
            widgets=[
                Widget(
                    id="title",
                    type="text_block",
                    page=1,
                    position={"x": 50, "y": 50, "width": 400, "height": 50},
                    content="Page {index}",
                    styling={"font_size": 16}
                )
            ],
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
    ]

    # Plan within limit (100 pages)
    plan = Plan(
        calendar=CalendarConfig(pages_per_day=1),
        sections=[
            PlanSection(
                kind="pages",
                master="page",
                generate=GenerateMode.COUNT,
                count=100,
                counters={"index": {"start": 1, "step": 1}}
            )
        ],
        order=["pages"]
    )

    project = Project(
        id="test_valid",
        metadata=ProjectMetadata(
            name="Valid Plan Test",
            description="Test valid plan compiles",
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

    print("\nTest 3: Plan within limit (100 pages)...")
    service = CompilationService()

    try:
        result = service.compile_project(project, max_pages=1000)
        if result.compilation_stats['total_pages'] == 100:
            print(f"  ✓ PASSED: Compiled successfully with {result.compilation_stats['total_pages']} pages")
            return True
        else:
            print(f"  ❌ FAILED: Expected 100 pages, got {result.compilation_stats['total_pages']}")
            return False
    except Exception as e:
        print(f"  ❌ FAILED: Should not raise error - {e}")
        return False


if __name__ == "__main__":
    results = [
        test_page_limit_validation(),
        test_nested_page_limit(),
        test_within_limit()
    ]

    print("\n" + "="*60)
    if all(results):
        print("All tests PASSED ✓")
        print("\nPage limit validation working correctly:")
        print("  - Validates BEFORE compilation (fail-fast)")
        print("  - Handles nested section page estimates")
        print("  - Uses configurable limit from settings")
    else:
        print(f"Some tests FAILED: {sum(results)}/{len(results)} passed")
