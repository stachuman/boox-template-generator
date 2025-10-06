"""
Test that sibling sections CAN have the same variable names.

Siblings don't inherit from each other, so this should be valid:
- projects (project_id)
  - meetings (meeting_id)
  - tasks (task_id)  ← sibling to meetings, can reuse meeting_id if needed
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from einkpdf.core.project_schema import Plan, PlanSection, GenerateMode, CalendarConfig


def test_sibling_sections_can_reuse_variables():
    """Sibling sections should be allowed to use the same variable names."""
    print("Test: Sibling sections with same variable names...")

    try:
        plan = Plan(
            calendar=CalendarConfig(pages_per_day=1),
            sections=[
                PlanSection(
                    kind="projects",
                    master="project",
                    generate=GenerateMode.COUNT,
                    count=5,
                    counters={"project_id": {"start": 1, "step": 1}},
                    nested=[
                        # Sibling 1: meetings
                        PlanSection(
                            kind="meetings",
                            master="meeting",
                            generate=GenerateMode.COUNT,
                            count=10,
                            counters={"item_id": {"start": 1, "step": 1}}  # Uses item_id
                        ),
                        # Sibling 2: notes (can reuse item_id - they're siblings, not parent-child)
                        PlanSection(
                            kind="notes",
                            master="note",
                            generate=GenerateMode.COUNT,
                            count=20,
                            counters={"item_id": {"start": 1, "step": 1}}  # Same name as sibling
                        )
                    ]
                )
            ],
            order=["projects"]
        )
        print("  ✓ PASSED: Sibling sections can reuse variable names")
        print(f"    Projects has {len(plan.sections[0].nested)} sibling nested sections")
        return True
    except ValueError as e:
        print(f"  ❌ FAILED: Siblings should be allowed to reuse names - {e}")
        return False


if __name__ == "__main__":
    result = test_sibling_sections_can_reuse_variables()
    print("\n" + "="*60)
    if result:
        print("Test PASSED ✓")
        print("Sibling sections are correctly allowed to have same variable names.")
    else:
        print("Test FAILED - Implementation may be too strict")
