"""
Compiler to transform parametric masters + a plan into a resolved template.

This module transforms parametric master templates with plan YAML into fully
resolved templates with concrete named destinations and navigation structure.
"""
from __future__ import annotations

import calendar
from datetime import date, timedelta
from typing import Any, Dict, Iterable, List, Tuple, Optional
import copy
import re
import logging

logger = logging.getLogger(__name__)


# ---- Calendar helpers ----
def months_between(d0: date, d1: date) -> Iterable[Tuple[int, int]]:
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
    return "notes:index"


def dest_notes_page(i: int) -> str:
    return f"notes:page:{i:03d}"


# ---- Composite widget expansion ----
def expand_calendar_month_widget(widget: Dict[str, Any], ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Expand calendar_month composite widget into individual day cell widgets."""
    if widget.get("type") != "calendar_month":
        return [widget]

    props = widget.get("properties", {})
    month_str = props.get("month", "")
    if month_str.startswith("@"):
        month_str = ctx.get(month_str, month_str)

    if not month_str or len(month_str.split("-")) != 2:
        raise ValueError(f"calendar_month widget requires valid month property, got: {month_str}")

    year, month = map(int, month_str.split("-"))
    cal = calendar.Calendar(firstweekday=0)  # Monday = 0
    month_days = cal.monthdaydates(year, month)

    pos = widget["position"]
    cell_width = pos["width"] / 7  # 7 days per week
    cell_height = pos["height"] / len(month_days) * 7  # Approximate rows

    expanded_widgets = []
    cell_link = props.get("cell_link", {})
    min_touch_pt = props.get("min_touch_pt", 44)

    row = 0
    for week in [month_days[i:i+7] for i in range(0, len(month_days), 7)]:
        for col, day_date in enumerate(week):
            if day_date.month != month:
                continue  # Skip days from prev/next month

            cell_x = pos["x"] + col * cell_width
            cell_y = pos["y"] + row * cell_height
            cell_w = max(cell_width, min_touch_pt)
            cell_h = max(cell_height, min_touch_pt)

            # Create context for this cell
            cell_ctx = dict(ctx)
            cell_ctx["@cell_date"] = day_date.isoformat()
            cell_ctx["@cell_date_short"] = day_date.strftime("%d")

            cell_widget = {
                "id": f"{widget['id']}_day_{day_date.day:02d}",
                "type": "internal_link",
                "page": widget.get("page", 1),
                "position": {"x": cell_x, "y": cell_y, "width": cell_w, "height": cell_h},
                "content": str(day_date.day),
                "properties": {}
            }

            # Resolve cell link binding
            if cell_link:
                resolved_bind = resolve_bind(cell_link.get("bind", {}), cell_ctx)
                cell_widget["properties"]["to_dest"] = resolved_bind

            expanded_widgets.append(cell_widget)
        row += 1

    return expanded_widgets


def expand_grid_widget(widget: Dict[str, Any], ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Expand grid composite widget into individual cell widgets."""
    if widget.get("type") != "grid":
        return [widget]

    props = widget.get("properties", {})
    rows = props.get("rows", 1)
    cols = props.get("cols", 1)
    data_source = props.get("data_source", "")
    cell_template = props.get("cell_template", {})

    # Resolve data source
    if isinstance(data_source, str):
        if data_source.startswith("@"):
            data = ctx.get(data_source, [])
        elif data_source.startswith("range("):
            # Parse range(start, end) or range(end)
            match = re.match(r"range\((\d+)(?:,\s*(\d+))?\)", data_source)
            if match:
                start_val = int(match.group(1))
                end_val = int(match.group(2)) if match.group(2) else start_val
                if match.group(2):  # range(start, end)
                    data = list(range(start_val, end_val))
                else:  # range(end)
                    data = list(range(start_val))
            else:
                raise ValueError(f"Invalid range expression: {data_source}")
        else:
            data = [data_source]
    else:
        data = data_source if isinstance(data_source, list) else [data_source]

    pos = widget["position"]
    cell_width = pos["width"] / cols
    cell_height = pos["height"] / rows

    expanded_widgets = []

    for i, cell_value in enumerate(data[:rows * cols]):  # Limit to grid size
        row = i // cols
        col = i % cols

        cell_x = pos["x"] + col * cell_width
        cell_y = pos["y"] + row * cell_height

        # Create context for this cell
        cell_ctx = dict(ctx)
        cell_ctx["@cell_value"] = cell_value
        cell_ctx["@cell_index"] = i

        # Clone and resolve cell template
        cell_widget = copy.deepcopy(cell_template)
        cell_widget["id"] = f"{widget['id']}_cell_{i:02d}"
        cell_widget["page"] = widget.get("page", 1)
        cell_widget["position"] = {"x": cell_x, "y": cell_y, "width": cell_width, "height": cell_height}

        # Apply token substitution to cell
        cell_widget = deep_substitute(cell_widget, cell_ctx)

        # Resolve any bindings in cell
        if "properties" in cell_widget and "bind" in cell_widget["properties"]:
            bind = cell_widget["properties"]["bind"]
            cell_widget["properties"]["to_dest"] = resolve_bind(bind, cell_ctx)
            del cell_widget["properties"]["bind"]

        expanded_widgets.append(cell_widget)

    return expanded_widgets


def expand_composite_widgets(widgets: List[Dict[str, Any]], ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Expand all composite widgets in a widget list."""
    expanded = []
    for widget in widgets:
        widget_type = widget.get("type", "")
        if widget_type == "calendar_month":
            expanded.extend(expand_calendar_month_widget(widget, ctx))
        elif widget_type == "grid":
            expanded.extend(expand_grid_widget(widget, ctx))
        else:
            expanded.append(widget)
    return expanded


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
    """Apply context to master template and resolve all bindings and composite widgets."""
    page = copy.deepcopy(master)
    page = deep_substitute(page, ctx)

    # First expand composite widgets
    widgets = page.get("widgets", [])
    logger.debug(f"Master has {len(widgets)} widgets before expansion")
    expanded_widgets = expand_composite_widgets(widgets, ctx)
    logger.debug(f"After composite expansion: {len(expanded_widgets)} widgets")

    # Then resolve remaining properties
    for w in expanded_widgets:
        props = w.setdefault("properties", {})

        # Resolve anchors with symbolic dest_id
        did = props.get("dest_id")
        if isinstance(did, str):
            if did.startswith("day:@"):
                d = date.fromisoformat(ctx["@date"])
                props["dest_id"] = dest_day(d)
            elif did == "notes:index":
                props["dest_id"] = dest_notes_index()
            elif did == "notes:page:@index_padded":
                props["dest_id"] = dest_notes_page(int(ctx["@index"]))

        # Resolve bind → to_dest (if not already resolved by composite expansion)
        if "bind" in props:
            props["to_dest"] = resolve_bind(props["bind"], ctx)
            del props["bind"]

    # Filter out widgets that didn't pass 'when' conditions
    filtered_widgets = []
    for w in expanded_widgets:
        when_condition = w.get("when")
        if not when_condition or evaluate_when_condition(when_condition, ctx):
            if "when" in w:
                del w["when"]  # Remove condition after evaluation
            filtered_widgets.append(w)
        else:
            logger.debug(f"Widget {w.get('id', 'unnamed')} filtered out by condition: {when_condition}")

    logger.debug(f"After filtering: {len(filtered_widgets)} widgets")
    page["widgets"] = filtered_widgets
    return page


def evaluate_when_condition(condition: str, ctx: Dict[str, Any]) -> bool:
    """Evaluate a simple when condition like '@subpage == 1' or '@subpage == 2'."""
    if not condition:
        return True

    # Simple evaluation for @var == value patterns
    match = re.match(r"@(\w+)\s*(==|!=|<|>|<=|>=)\s*(.+)", condition.strip())
    if not match:
        logger.warning(f"Unsupported when condition: {condition}")
        return True

    var_name, operator, value_str = match.groups()
    ctx_value = ctx.get(f"@{var_name}")

    # Try to parse value as int, float, or string
    try:
        if value_str.isdigit():
            value = int(value_str)
        elif value_str.replace(".", "").isdigit():
            value = float(value_str)
        else:
            value = value_str.strip('"\'')  # Remove quotes
    except:
        value = value_str

    # Evaluate condition
    try:
        if operator == "==":
            return ctx_value == value
        elif operator == "!=":
            return ctx_value != value
        elif operator == "<":
            return ctx_value < value
        elif operator == ">":
            return ctx_value > value
        elif operator == "<=":
            return ctx_value <= value
        elif operator == ">=":
            return ctx_value >= value
    except:
        logger.warning(f"Failed to evaluate condition: {condition}")

    return True


def _as_date(value: Any) -> date:
    """Convert value to date, handling both date objects and ISO strings."""
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    raise ValueError(f"Expected date or ISO string, got {type(value).__name__}")


def generate_outlines(compiled_widgets: List[Dict[str, Any]], plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generate PDF outline structure from compiled widgets and plan."""
    outlines = []

    # Find anchor widgets to create outline structure
    anchors_by_dest = {}
    for widget in compiled_widgets:
        props = widget.get("properties", {})
        dest_id = props.get("dest_id")
        if dest_id and widget.get("type") == "anchor":
            anchors_by_dest[dest_id] = widget

    # Generate month outlines
    cal = plan["plan"]["calendar"]
    start = _as_date(cal["start_date"])
    end = _as_date(cal.get("end_date", start))

    for y, m in months_between(start.replace(day=1), end.replace(day=1)):
        month_dest = dest_month(y, m)
        if month_dest in anchors_by_dest:
            month_name = date(y, m, 1).strftime("%B %Y")
            outlines.append({
                "title": month_name,
                "dest": month_dest,
                "level": 1
            })

    # Generate week outlines (optional, could be level 2 under months)
    for iso_week in iso_weeks_between(start, end):
        week_dest = dest_week(iso_week)
        if week_dest in anchors_by_dest:
            year, wnum = map(int, re.match(r"(\d+)-W(\d+)", iso_week).groups())
            outlines.append({
                "title": f"Week {wnum}",
                "dest": week_dest,
                "level": 2
            })

    # Generate notes outline
    notes_dest = dest_notes_index()
    if notes_dest in anchors_by_dest:
        outlines.append({
            "title": "Notes",
            "dest": notes_dest,
            "level": 1
        })

    return outlines


def generate_named_destinations(compiled_widgets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Generate named destinations from anchor widgets."""
    destinations = []

    for widget in compiled_widgets:
        if widget.get("type") == "anchor":
            props = widget.get("properties", {})
            dest_id = props.get("dest_id")
            if dest_id:
                pos = widget["position"]
                destinations.append({
                    "id": dest_id,
                    "page": widget.get("page", 1),
                    "x": pos["x"],
                    "y": pos["y"],
                    "fit": "FitH"
                })

    return destinations


def collect_internal_links(compiled_widgets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Collect internal links from widgets with to_dest properties."""
    links = []

    for widget in compiled_widgets:
        props = widget.get("properties", {})
        to_dest = props.get("to_dest")
        if to_dest and widget.get("type") in ["internal_link", "checkbox", "text_block"]:
            links.append({
                "from_widget": widget["id"],
                "to_dest": to_dest,
                "padding": props.get("padding", 6.0)
            })

    return links


def build_final_template(plan: Dict[str, Any], masters: Dict[str, Any]) -> Dict[str, Any]:
    """Build final template from plan and masters with complete navigation structure."""
    logger.info("Starting template compilation")

    # Validate required structure
    if "plan" not in plan:
        raise ValueError("Plan must contain 'plan' section")
    if "calendar" not in plan["plan"]:
        raise ValueError("Plan must contain 'plan.calendar' section")
    if "masters" not in masters:
        raise ValueError("Masters must contain 'masters' section")

    cal = plan["plan"]["calendar"]
    start = _as_date(cal["start_date"])
    end = _as_date(cal.get("end_date", start))
    pages_per_day = int(cal.get("pages_per_day", 1))

    logger.info(f"Compiling calendar from {start} to {end} with {pages_per_day} pages per day")

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
            available_masters = [m.get("name", "unnamed") for m in masters.get("masters", [])]
            raise ValueError(f"Master '{master_name}' not found. Available masters: {available_masters}")

        logger.debug(f"Applying master '{master_name}' for page {page_no}")
        page = apply_master(master, ctx)

        # Debug the page structure
        page_widgets = page.get("widgets", [])
        logger.debug(f"Master '{master_name}' produced {len(page_widgets)} widgets")
        if len(page_widgets) == 0:
            logger.warning(f"Master '{master_name}' has no widgets! Master structure: {master}")

        # Assign page numbers and validate
        for w in page_widgets:
            w.setdefault("id", f"w_{page_no}_{len(compiled_widgets)}")
            w["page"] = page_no
            if "type" not in w:
                raise ValueError(f"Master '{master_name}' produced widget without type: {w}")
            if "position" not in w:
                raise ValueError(f"Master '{master_name}' produced widget without position: {w}")

        compiled_widgets.extend(page_widgets)
        logger.debug(f"Added {len(page_widgets)} widgets for page {page_no}")
        page_no += 1

    # Process sections according to plan order
    sections = plan["plan"]["sections"]
    if not isinstance(sections, list):
        raise ValueError("plan.sections must be a list")

    for spec in sections:
        kind = spec.get("kind")
        master = spec.get("master")
        generate = spec.get("generate")

        if not kind or not master:
            raise ValueError(f"Section must have 'kind' and 'master': {spec}")

        logger.info(f"Processing section '{kind}' with master '{master}' (generate={generate})")

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
            raise ValueError(f"Unsupported section kind '{kind}' with generate '{generate}': {spec}")

    logger.info(f"Compilation complete: {len(compiled_widgets)} widgets across {page_no - 1} pages")

    # Generate navigation structure
    named_destinations = generate_named_destinations(compiled_widgets)
    outlines = generate_outlines(compiled_widgets, plan)
    internal_links = collect_internal_links(compiled_widgets)

    logger.info(f"Generated {len(named_destinations)} destinations, {len(outlines)} outlines, {len(internal_links)} links")

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
        "navigation": {
            "named_destinations": named_destinations,
            "outlines": outlines,
            "links": internal_links
        },
        "masters": [],
        "page_assignments": [],
        "export": {"modes": ["flattened"], "default_mode": "flattened"},
    }
