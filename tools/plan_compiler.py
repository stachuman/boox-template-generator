#!/usr/bin/env python3
"""
Parametric master template compiler.

Inputs:
- Master library YAML with widgets containing tokens (e.g., {{ @date }}) and optional binds/dest_ids
- Plan YAML describing the structure (months/weeks/days/notes) and ordering

Output:
- A fully resolved template YAML with named destinations and internal links resolved

Usage:
  python tools/plan_compiler.py build \
    --masters templates/master_library.yaml \
    --plan templates/plan_example.yaml \
    --out output/final_compiled.yaml
"""

from __future__ import annotations

import argparse
import calendar
import copy
import json
import logging
import re
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, List, Any, Iterable, Optional

import yaml

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import enhanced compiler from the main package
try:
    from src.einkpdf.compiler.build import (
        build_final_template,
        months_between,
        iso_weeks_between,
        days_between,
        dest_month,
        dest_week,
        dest_day,
        dest_day_page,
        dest_notes_index,
        dest_notes_page,
        resolve_bind,
        deep_substitute,
        apply_master,
        expand_composite_widgets,
        generate_outlines,
        generate_named_destinations,
        collect_internal_links,
        evaluate_when_condition,
        _as_date
    )
    logger.info("Using enhanced compiler from src.einkpdf.compiler.build")
except ImportError:
    logger.warning("Could not import enhanced compiler, using local implementation")

    # ---- Calendar helpers ----
    def months_between(d0: date, d1: date) -> Iterable[tuple[int, int]]:
        y, m = d0.year, d0.month
        while (y, m) <= (d1.year, d1.month):
            yield y, m
            m = 1 if m == 12 else m + 1
            y = y + 1 if m == 1 else y

    def iso_weeks_between(d0: date, d1: date) -> Iterable[str]:
        d = d0
        seen = set()
        while d <= d1:
            iso = d.isocalendar()
            key = f"{iso.year}-W{iso.week:02d}"
            if key not in seen:
                seen.add(key)
                yield key
            d += timedelta(days=1)

    def days_between(d0: date, d1: date) -> Iterable[date]:
        d = d0
        while d <= d1:
            yield d
            d += timedelta(days=1)

    # ---- Destination ID builders ----
    def dest_month(y: int, m: int) -> str:
        return f"month:{y:04d}-{m:02d}"

    def dest_week(iso_week: str) -> str:
        return f"week:{iso_week}"

    def dest_day(d: date) -> str:
        return f"day:{d:%Y-%m-%d}"

    def dest_day_page(d: date, idx: int) -> str:
        return f"{dest_day(d)}#{idx}"

    def dest_notes_index() -> str:
        return "notes:{index}"

    def dest_notes_page(i: int) -> str:
        return f"notes:page:{i:03d}"

    # ---- Binding resolution ----
    def resolve_bind(bind: Any, ctx: Dict[str, Any]) -> str:
        if isinstance(bind, str):
            m = re.match(r"(\w+)\(([^)]+)\)(?:#(\d+))?", bind)
            if not m:
                raise ValueError(f"Bad bind string: {bind}")
            kind, arg, sub = m.groups()
            b = {"type": kind}
            if kind == "day":
                b["day"] = ctx[arg] if arg.startswith("@") else arg
                if sub:
                    b["page_index"] = int(sub)
            elif kind == "month":
                b["month"] = ctx[arg] if arg.startswith("@") else arg
            elif kind == "week":
                b["week"] = ctx[arg] if arg.startswith("@") else arg
            elif kind == "notes":
                b["notes_index"] = (arg == "index")
            elif kind == "section":
                b["section"] = arg
            else:
                raise ValueError(f"Unsupported bind kind: {kind}")
            bind = b

        if not isinstance(bind, dict) or "type" not in bind:
            raise ValueError(f"Invalid bind: {bind}")

        kind = bind["type"]
        if kind == "day":
            dval = bind.get("day")
            if isinstance(dval, str) and dval.startswith("@"):
                dval = ctx[dval]
            d_obj = date.fromisoformat(dval)
            idx = int(bind.get("page_index", 1))
            return dest_day_page(d_obj, idx)
        if kind == "month":
            m = bind.get("month")
            if isinstance(m, str) and m.startswith("@"):
                m = ctx[m]
            y, mm = map(int, m.split("-"))
            return dest_month(y, mm)
        if kind == "week":
            wk = bind.get("week")
            if isinstance(wk, str) and wk.startswith("@"):
                wk = ctx[wk]
            return dest_week(wk)
        if kind == "notes":
            if bind.get("notes_index"):
                return dest_notes_index()
            i = bind.get("page_index")
            if isinstance(i, str) and i.startswith("@"):
                i = ctx[i]
            return dest_notes_page(int(i))
        if kind == "section":
            return f"section:{bind['section']}"
        raise ValueError(f"Unsupported bind type: {kind}")

    def deep_substitute(obj: Any, ctx: Dict[str, Any]) -> Any:
        def sub_one(s: str) -> str:
            # Replace {{ @var }} and bare @var
            s2 = re.sub(r"\{\{\s*(@\w+)\s*\}\}", lambda m: str(ctx.get(m.group(1), m.group(0))), s)
            s2 = re.sub(r"@(\w+)", lambda m: str(ctx.get(f"@{m.group(1)}", m.group(0))), s2)
            return s2

        if isinstance(obj, str):
            return sub_one(obj)
        if isinstance(obj, list):
            return [deep_substitute(x, ctx) for x in obj]
        if isinstance(obj, dict):
            return {k: deep_substitute(v, ctx) for k, v in obj.items()}
        return obj

    def apply_master(master: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
        page = copy.deepcopy(master)
        page = deep_substitute(page, ctx)

        for w in page.get("widgets", []):
            props = w.setdefault("properties", {})
            # Resolve anchors with symbolic dest_id like day:@date etc.
            did = props.get("dest_id")
            if isinstance(did, str):
                if did.startswith("day:@"):
                    d = date.fromisoformat(ctx["@date"])  # e.g., @date
                    props["dest_id"] = dest_day(d)
                elif did == "notes:{index}":
                    props["dest_id"] = dest_notes_index()
                elif did == "notes:page:@index_padded":
                    props["dest_id"] = dest_notes_page(int(ctx["@index"]))

            # Resolve bind → to_dest
            if "bind" in props:
                props["to_dest"] = resolve_bind(props["bind"], ctx)
                del props["bind"]
        return page

    def _as_date(value: Any) -> date:
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            return date.fromisoformat(value)
        raise ValueError(f"Expected date or ISO string, got {type(value).__name__}")

    def build_final_template(plan: Dict[str, Any], masters: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback build function for when enhanced compiler is not available."""
        logger.warning("Using fallback build_final_template implementation")

        cal = plan["plan"]["calendar"]
        start = _as_date(cal["start_date"])
        end = _as_date(cal.get("end_date", start))
        pages_per_day = int(cal.get("pages_per_day", 1))

        # Prepare sequences
        months = list(months_between(start.replace(day=1), end.replace(day=1)))
        weeks = list(iso_weeks_between(start, end))
        days = list(days_between(start, end))

        compiled_widgets: List[Dict[str, Any]] = []
        page_no = 1

        def add_page(master_name: str, ctx: Dict[str, Any]):
            nonlocal page_no
            master = next((m for m in masters.get("masters", []) if m.get("name") == master_name), None)
            if not master:
                raise ValueError(f"Master '{master_name}' not found")
            page = apply_master(master, ctx)
            # Assign page numbers and validate
            for w in page.get("widgets", []):
                w.setdefault("id", f"w_{page_no}_{len(compiled_widgets)}")
                w["page"] = page_no
                if "type" not in w or "position" not in w:
                    raise ValueError(f"Master '{master_name}' produced invalid widget: {w}")
            compiled_widgets.extend(page.get("widgets", []))
            page_no += 1

        for spec in plan["plan"]["sections"]:
            kind = spec["kind"]
            master = spec["master"]
            generate = spec.get("generate")
            if kind == "month_index" and generate == "each_month":
                for y, m in months:
                    ctx = {
                        "@month": f"{y:04d}-{m:02d}",
                        "@month_name": date(y, m, 1).strftime("%B"),
                        "@year": y,
                    }
                    add_page(master, ctx)
            elif kind == "week_index" and generate == "each_week":
                for wk in weeks:
                    year, wnum = map(int, re.match(r"(\d+)-W(\d+)", wk).groups())
                    start_week = date.fromisocalendar(year, wnum, 1)
                    end_week = start_week + timedelta(days=6)
                    ctx = {
                        "@iso_week": wk,
                        "@week_days": [d.isoformat() for d in days_between(start_week, end_week)],
                        "@week_range": f"{start_week.strftime('%b %d')} – {end_week.strftime('%b %d')}",
                    }
                    add_page(master, ctx)
            elif kind == "day_page" and generate == "each_day":
                ppi = int(spec.get("pages_per_item", pages_per_day))
                for d in days:
                    for idx in range(1, ppi + 1):
                        ctx = {
                            "@date": d.isoformat(),
                            "@date_long": d.strftime("%A, %B %d, %Y"),
                            "@month": d.strftime("%Y-%m"),
                            "@iso_week": f"{d.isocalendar().year}-W{d.isocalendar().week:02d}",
                            "@subpage": idx,
                        }
                        add_page(master, ctx)
            elif kind == "notes_index" and generate == "once":
                ctx = {"@index": 0, "@index_padded": "000"}
                add_page(master, ctx)
            elif kind == "notes_pages" and generate == "count":
                count = int(spec.get("count", 0))
                for i in range(1, count + 1):
                    ctx = {"@index": i, "@index_padded": f"{i:03d}"}
                    add_page(master, ctx)
            else:
                raise ValueError(f"Unsupported section: {spec}")

        return {
            "schema_version": "1.0",
            "metadata": {
                "name": plan.get("name", "Compiled Template"),
                "description": plan.get("description", ""),
                "category": plan.get("category", "planner"),
                "version": "1.0",
                "author": plan.get("author", "plan_compiler"),
                "created": plan.get("created", date.today().isoformat()),
                "profile": plan.get("profile", "boox-note-air-4c"),
            },
            "canvas": plan.get("canvas", {
                "dimensions": {"width": 595.2, "height": 841.8, "margins": [72, 72, 72, 72]},
                "coordinate_system": "top_left",
                "background": "#FFFFFF",
                "grid_size": 10,
                "snap_enabled": True,
            }),
            "widgets": compiled_widgets,
            "navigation": {"named_destinations": [], "outlines": []},
            "masters": [],
            "page_assignments": [],
            "export": {"modes": ["flattened"], "default_mode": "flattened"},
        }


def validate_input_files(masters_path: Path, plan_path: Path):
    """Validate input files exist and contain required structure."""
    if not masters_path.exists():
        raise FileNotFoundError(f"Masters file not found: {masters_path}")
    if not plan_path.exists():
        raise FileNotFoundError(f"Plan file not found: {plan_path}")

    # Basic YAML validation
    try:
        masters = yaml.safe_load(masters_path.read_text())
        if not isinstance(masters, dict) or "masters" not in masters:
            raise ValueError("Masters file must contain 'masters' list")
    except Exception as e:
        raise ValueError(f"Invalid masters YAML: {e}")

    try:
        plan = yaml.safe_load(plan_path.read_text())
        if not isinstance(plan, dict) or "plan" not in plan:
            raise ValueError("Plan file must contain 'plan' section")
    except Exception as e:
        raise ValueError(f"Invalid plan YAML: {e}")

    logger.info("Input file validation passed")


def main() -> None:
    ap = argparse.ArgumentParser(description="Parametric master template compiler")
    sub = ap.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("build", help="Build final template from masters + plan")
    b.add_argument("--masters", required=True, type=Path, help="Master library YAML file")
    b.add_argument("--plan", required=True, type=Path, help="Plan YAML file")
    b.add_argument("--out", required=True, type=Path, help="Output template YAML file")
    b.add_argument("--page-map-json", type=Path, help="Optional debug JSON of page map")
    b.add_argument("--validate", action="store_true", help="Validate inputs with Pydantic schemas")
    b.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")

    args = ap.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        # Validate input files
        validate_input_files(args.masters, args.plan)

        # Load input files
        masters = yaml.safe_load(args.masters.read_text())
        plan = yaml.safe_load(args.plan.read_text())

        if args.validate:
            logger.info("Validating inputs with Pydantic schemas")
            try:
                from src.einkpdf.core.schema import PlanDocument, MasterLibrary
                PlanDocument.model_validate(plan)
                MasterLibrary.model_validate(masters)
                logger.info("Pydantic validation passed")
            except ImportError:
                logger.warning("Pydantic validation skipped - schemas not available")
            except Exception as e:
                logger.error(f"Validation failed: {e}")
                return 1

        # Build final template
        logger.info("Starting template compilation")
        final = build_final_template(plan, masters)

        # Write output
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(yaml.safe_dump(final, sort_keys=False, allow_unicode=True))
        logger.info(f"Template compiled successfully to {args.out}")

        # Write optional page map
        if args.page_map_json:
            page_map = {
                "total_pages": len(set(w.get("page", 1) for w in final.get("widgets", []))),
                "total_widgets": len(final.get("widgets", [])),
                "destinations": len(final.get("navigation", {}).get("named_destinations", [])),
                "outlines": len(final.get("navigation", {}).get("outlines", [])),
                "links": len(final.get("navigation", {}).get("links", [])),
            }
            args.page_map_json.write_text(json.dumps(page_map, indent=2))
            logger.info(f"Page map written to {args.page_map_json}")

    except Exception as e:
        logger.error(f"Compilation failed: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())