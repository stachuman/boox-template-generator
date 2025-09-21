"""
Compile API: build resolved templates from master library + plan YAML.

This endpoint aligns with the project-based compiler by using
CompilationService under the hood for deterministic, validated results.
"""

import sys
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, List
import yaml
from datetime import datetime

# Ensure src is on path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from einkpdf.services.compilation_service import CompilationService, CompilationServiceError
from einkpdf.core.project_schema import (
    Project, ProjectMetadata, Plan as ProjectPlan, PlanSection as ProjectPlanSection,
    GenerateMode, Master as ProjectMaster
)
from einkpdf.core.schema import Widget as TemplateWidget


router = APIRouter()


class CompileRequest(BaseModel):
    masters_yaml: str = Field(..., min_length=1, description="Master library YAML (masters: [...])")
    plan_yaml: str = Field(..., min_length=1, description="Plan YAML (calendar/sections/order)")


class CompileResponse(BaseModel):
    yaml_content: str = Field(..., description="Resolved template YAML")
    parsed_template: dict = Field(..., description="Parsed template object")


def _parse_master_library(masters_data: Dict[str, Any]) -> List[ProjectMaster]:
    """Parse a simple master library dict into ProjectMaster list."""
    masters: List[ProjectMaster] = []
    if not isinstance(masters_data, dict) or "masters" not in masters_data:
        raise ValueError("masters_yaml must be a mapping with a 'masters' list")
    for m in masters_data.get("masters", []):
        name = m.get("name")
        if not name:
            raise ValueError("Master missing 'name'")
        widgets_data = m.get("widgets", [])
        # Coerce widgets to TemplateWidget models (validates structure)
        widgets = [TemplateWidget.model_validate(w) for w in widgets_data]
        masters.append(ProjectMaster(
            name=name,
            description=m.get("description", ""),
            widgets=widgets,
            created_at=m.get("created_at", datetime.now().isoformat()),
            updated_at=m.get("updated_at", datetime.now().isoformat())
        ))
    return masters


def _parse_plan(plan_data: Dict[str, Any]) -> ProjectPlan:
    """Parse plan YAML into ProjectPlan (sections with arbitrary kinds + order)."""
    if not isinstance(plan_data, dict) or "plan" not in plan_data:
        raise ValueError("plan_yaml must contain a top-level 'plan' mapping")
    p = plan_data["plan"]
    cal = p.get("calendar") or {}
    if not cal or "start_date" not in cal or "end_date" not in cal:
        raise ValueError("plan.calendar must include start_date and end_date")
    sections_in: List[Dict[str, Any]] = p.get("sections", [])
    order_in: List[str] = p.get("order", [])
    sections: List[ProjectPlanSection] = []
    for s in sections_in:
        gen = s.get("generate")
        try:
            generate = GenerateMode(gen)
        except Exception:
            raise ValueError(f"Invalid generate mode: {gen}")
        sections.append(ProjectPlanSection(
            kind=s.get("kind", ""),
            master=s.get("master", ""),
            generate=generate,
            start_date=s.get("start_date"),
            end_date=s.get("end_date"),
            count=s.get("count"),
            pages_per_item=s.get("pages_per_item", 1),
            context=s.get("context", {}),
            anchors=s.get("anchors", []),
        ))
    plan = ProjectPlan(
        calendar={
            "start_date": cal["start_date"],
            "end_date": cal["end_date"],
            "pages_per_day": cal.get("pages_per_day", 1)
        },
        sections=sections,
        order=order_in or [s.kind for s in sections]
    )
    return plan


@router.post("/compile/build", response_model=CompileResponse)
def compile_build(req: CompileRequest) -> CompileResponse:
    try:
        masters_data = yaml.safe_load(req.masters_yaml)
        plan_data = yaml.safe_load(req.plan_yaml)

        masters = _parse_master_library(masters_data)
        plan = _parse_plan(plan_data)

        # Build ephemeral project and compile
        project = Project(
            id="adhoc",
            metadata=ProjectMetadata(
                name=plan_data.get("name", "Adhoc Build"),
                description=plan_data.get("description", ""),
                category=plan_data.get("category", "planner"),
                author=plan_data.get("author", "adhoc"),
                device_profile=plan_data.get("profile", "boox-note-air-4c"),
                created_at=datetime.now().isoformat(),
                updated_at=datetime.now().isoformat(),
            ),
            masters=masters,
            plan=plan,
            link_resolution={},
            default_canvas=plan_data.get("canvas", {
                "dimensions": {"width": 595.2, "height": 841.8, "margins": [72, 72, 72, 72]},
                "coordinate_system": "top_left",
                "background": "#FFFFFF",
            })
        )

        compiled = CompilationService().compile_project(project)

        # Convert enum values to strings and dump YAML
        def convert_enums(obj):
            if isinstance(obj, dict):
                return {k: convert_enums(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_enums(item) for item in obj]
            elif hasattr(obj, 'value'):
                return obj.value
            else:
                return obj

        template_data = convert_enums(compiled.template.model_dump())
        yaml_out = yaml.safe_dump(template_data, sort_keys=False, allow_unicode=True)
        return CompileResponse(yaml_content=yaml_out, parsed_template=template_data)
    except (ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid masters/plan YAML: {e}")
    except CompilationServiceError as e:
        raise HTTPException(status_code=400, detail=f"Compilation failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compilation crashed: {e}")
