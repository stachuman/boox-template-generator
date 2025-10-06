"""
Test variable collision detection across multiple nesting levels.

Tests:
1. Direct parent-child collision (should fail)
2. Grandparent-grandchild collision (currently NOT validated - potential bug)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from einkpdf.core.project_schema import Plan, PlanSection, GenerateMode, CalendarConfig


def test_direct_parent_child_collision():
    """Test that direct parent-child variable collision is detected."""
    print("Test 1: Direct parent-child collision...")

    try:
        plan = Plan(
            calendar=CalendarConfig(pages_per_day=1),
            sections=[
                PlanSection(
                    kind="projects",
                    master="project",
                    generate=GenerateMode.COUNT,
                    count=5,
                    counters={"id": {"start": 1, "step": 1}},  # Variable: id
                    nested=[
                        PlanSection(
                            kind="meetings",
                            master="meeting",
                            generate=GenerateMode.COUNT,
                            count=10,
                            counters={"id": {"start": 1, "step": 1}}  # COLLISION: redefines 'id'
                        )
                    ]
                )
            ],
            order=["projects"]
        )
        print("  ❌ FAILED: Should have raised ValueError for collision")
        return False
    except ValueError as e:
        if "redefines ancestor variables" in str(e) and "'id'" in str(e):
            print(f"  ✓ PASSED: Caught collision - {e}")
            return True
        else:
            print(f"  ❌ FAILED: Wrong error - {e}")
            return False


def test_grandparent_grandchild_collision():
    """Test that grandparent-grandchild variable collision is detected."""
    print("\nTest 2: Grandparent-grandchild collision (3 levels)...")

    try:
        plan = Plan(
            calendar=CalendarConfig(pages_per_day=1),
            sections=[
                PlanSection(
                    kind="projects",
                    master="project",
                    generate=GenerateMode.COUNT,
                    count=5,
                    counters={"id": {"start": 1, "step": 1}},  # Grandparent variable: id
                    nested=[
                        PlanSection(
                            kind="meetings",
                            master="meeting",
                            generate=GenerateMode.COUNT,
                            count=10,
                            counters={"meeting_id": {"start": 1, "step": 1}},  # OK: unique name
                            nested=[
                                PlanSection(
                                    kind="tasks",
                                    master="task",
                                    generate=GenerateMode.COUNT,
                                    count=20,
                                    counters={"id": {"start": 1, "step": 1}}  # COLLISION with grandparent!
                                )
                            ]
                        )
                    ]
                )
            ],
            order=["projects"]
        )
        print("  ❌ FAILED: Should have raised ValueError for grandparent collision")
        print("  This is a BUG - grandparent variables can be shadowed!")
        return False
    except ValueError as e:
        if "redefines" in str(e) and "'id'" in str(e):
            print(f"  ✓ PASSED: Caught collision - {e}")
            return True
        else:
            print(f"  ❌ FAILED: Wrong error - {e}")
            return False


def test_valid_nested_variables():
    """Test that properly named nested variables are accepted."""
    print("\nTest 3: Valid nested variables (no collision)...")

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
                        PlanSection(
                            kind="meetings",
                            master="meeting",
                            generate=GenerateMode.COUNT,
                            count=10,
                            counters={"meeting_id": {"start": 1, "step": 1}},
                            nested=[
                                PlanSection(
                                    kind="tasks",
                                    master="task",
                                    generate=GenerateMode.COUNT,
                                    count=20,
                                    counters={"task_id": {"start": 1, "step": 1}}
                                )
                            ]
                        )
                    ]
                )
            ],
            order=["projects"]
        )
        print("  ✓ PASSED: Valid nested variables accepted")
        return True
    except ValueError as e:
        print(f"  ❌ FAILED: Should not raise error - {e}")
        return False


if __name__ == "__main__":
    results = [
        test_direct_parent_child_collision(),
        test_grandparent_grandchild_collision(),
        test_valid_nested_variables()
    ]

    print("\n" + "="*60)
    if all(results):
        print("All tests PASSED ✓")
    else:
        print(f"Some tests FAILED: {sum(results)}/{len(results)} passed")
        print("\nBUG FOUND: Grandparent-grandchild variable collisions are NOT detected!")
