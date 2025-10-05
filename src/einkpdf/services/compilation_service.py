"""
Master/Plan-based compilation service.

This service takes a project with masters and compilation plan,
then generates a complete template ready for PDF rendering.
Follows CLAUDE.md standards - no dummy implementations.
"""

import copy
import logging
import re
import math
from datetime import date, timedelta, datetime
from typing import Dict, List, Any, Iterator, Tuple, Optional
from calendar import monthrange

from ..core.project_schema import (
    Project, Master, Plan, PlanSection, GenerateMode, BindingContext,
    CompilationResult, DestinationRegistry, LinkResolutionMode
)
from ..core.schema import Template, Widget, NamedDestination, OutlineItem, InternalLink
from ..i18n import get_month_names, get_weekday_names, format_date_long
from ..core.tokens import TokenProcessor, CompilationTokenContext, RenderingTokenContext


logger = logging.getLogger(__name__)


class CompilationServiceError(Exception):
    """Base exception for compilation service errors."""
    pass


class PlanEnumerator:
    """Enumerates plan sections into binding contexts."""

    def enumerate_section(self, section: PlanSection, calendar_start: date,
                         calendar_end: date) -> Iterator[BindingContext]:
        """Enumerate a plan section into binding contexts."""
        iteration = 0  # Track iteration for counter variables

        if section.generate == GenerateMode.ONCE:
            yield self._build_context(section, index=1, iteration=iteration)

        elif section.generate == GenerateMode.COUNT:
            if section.count is None:
                raise CompilationServiceError(f"Count not specified for section {section.kind}")
            for i in range(1, section.count + 1):
                yield self._build_context(section, index=i, total=section.count, iteration=iteration)
                iteration += 1

        elif section.generate == GenerateMode.EACH_DAY:
            start_date = self._parse_date(section.start_date) if section.start_date else calendar_start
            end_date = self._parse_date(section.end_date) if section.end_date else calendar_end

            if start_date is None or end_date is None:
                raise CompilationServiceError(
                    f"Section '{section.kind}' with EACH_DAY generation requires start_date and end_date"
                )

            for current_date in self._date_range(start_date, end_date):
                yield self._build_context(section, date_obj=current_date, iteration=iteration)
                iteration += 1

        elif section.generate == GenerateMode.EACH_WEEK:
            start_date = self._parse_date(section.start_date) if section.start_date else calendar_start
            end_date = self._parse_date(section.end_date) if section.end_date else calendar_end

            if start_date is None or end_date is None:
                raise CompilationServiceError(
                    f"Section '{section.kind}' with EACH_WEEK generation requires start_date and end_date"
                )

            for iso_week, week_start in self._week_range(start_date, end_date):
                yield self._build_context(section, date_obj=week_start, iso_week=iso_week, iteration=iteration)
                iteration += 1

        elif section.generate == GenerateMode.EACH_MONTH:
            start_date = self._parse_date(section.start_date) if section.start_date else calendar_start
            end_date = self._parse_date(section.end_date) if section.end_date else calendar_end

            if start_date is None or end_date is None:
                raise CompilationServiceError(
                    f"Section '{section.kind}' with EACH_MONTH generation requires start_date and end_date"
                )

            for year, month in self._month_range(start_date, end_date):
                month_date = date(year, month, 1)
                yield self._build_context(section, date_obj=month_date, iteration=iteration)
                iteration += 1
        else:
            raise CompilationServiceError(f"Unsupported generate mode: {section.generate}")

    def _build_context(self, section: PlanSection, date_obj: Optional[date] = None,
                      index: Optional[int] = None, total: Optional[int] = None,
                      iso_week: Optional[str] = None, iteration: int = 0) -> BindingContext:
        """Build binding context for template substitution."""
        context = BindingContext()

        # Date context
        if date_obj:
            # Locale from plan (set in compile_project) or fallback
            try:
                plan_locale = getattr(self, 'plan_locale', 'en') or 'en'
            except Exception:
                plan_locale = 'en'
            context.locale = plan_locale

            context.date = date_obj.isoformat()
            context.date_long = format_date_long(date_obj, plan_locale)
            context.year = date_obj.year
            context.month = date_obj.month
            context.month_padded = f"{date_obj.month:02d}"
            context.month_padded3 = f"{date_obj.month:03d}"
            # Localized names
            try:
                context.month_name = get_month_names(plan_locale, short=False)[date_obj.month - 1]
                context.weekday = get_weekday_names(plan_locale, style='full')[date_obj.weekday()]
            except Exception:
                context.month_name = date_obj.strftime("%B")
                context.weekday = date_obj.strftime("%A")
            context.day = date_obj.day
            context.day_padded = f"{date_obj.day:02d}"

        # Sequence context
        if index is not None:
            context.index = index
            context.index_padded = f"{index:03d}"
        if total is not None:
            context.total = total

        # Calendar context
        if iso_week:
            context.iso_week = iso_week

        # Custom context from section (static values)
        context.custom = dict(section.context)

        # Add plan locale to context
        try:
            context.locale = getattr(self, 'plan_locale', 'en')
            context.custom['locale'] = context.locale
        except Exception:
            pass

        # Process counter variables (dynamic values that increment per page)
        counters = getattr(section, 'counters', {}) or {}
        for counter_name, counter_config in counters.items():
            try:
                start = float(counter_config.get('start', 0))
                step = float(counter_config.get('step', 1))
                # Calculate counter value for this iteration
                counter_value = start + (iteration * step)
                # Store as integer if it's a whole number, otherwise float
                if counter_value == int(counter_value):
                    context.custom[counter_name] = int(counter_value)
                else:
                    context.custom[counter_name] = counter_value
            except (ValueError, TypeError, KeyError) as e:
                # Skip invalid counters, log warning
                logger.warning(f"Invalid counter '{counter_name}' in section: {e}")

        return context

    def _parse_date(self, date_str: str) -> date:
        """Parse ISO date string."""
        return date.fromisoformat(date_str)

    def _date_range(self, start_date: date, end_date: date) -> Iterator[date]:
        """Generate date range."""
        current = start_date
        while current <= end_date:
            yield current
            current += timedelta(days=1)

    def _week_range(self, start_date: date, end_date: date) -> Iterator[Tuple[str, date]]:
        """Generate ISO week range with week start dates."""
        seen = set()
        for current_date in self._date_range(start_date, end_date):
            iso = current_date.isocalendar()
            week_key = f"{iso.year}-W{iso.week:02d}"
            if week_key not in seen:
                seen.add(week_key)
                # Find Monday of this week
                week_start = current_date - timedelta(days=current_date.weekday())
                yield week_key, week_start

    def _month_range(self, start_date: date, end_date: date) -> Iterator[Tuple[int, int]]:
        """Generate month range."""
        current = start_date.replace(day=1)
        end = end_date.replace(day=1)

        while current <= end:
            yield current.year, current.month
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)


class BindingResolver:
    """Resolves bindings and links in compiled templates."""

    def __init__(self, destination_registry: DestinationRegistry):
        self.destination_registry = destination_registry

    def resolve_widget_bindings(self, widget: Dict[str, Any], context: BindingContext) -> Dict[str, Any]:
        """Resolve bindings in a widget using context."""
        resolved_widget = copy.deepcopy(widget)

        # Apply token substitution to content
        if "content" in resolved_widget:
            resolved_widget["content"] = self._substitute_tokens(
                resolved_widget["content"], context
            )

        # Apply token substitution to properties, but skip composites that resolve later per-item
        wtype = resolved_widget.get("type")
        composite_types = {"link_list", "grid", "calendar_year", "calendar_month"}
        if "properties" in resolved_widget:
            props = resolved_widget.get("properties")
            if isinstance(props, dict):
                if wtype in composite_types:
                    # Shallow copy; do NOT substitute tokens inside bind/label_template yet
                    resolved_widget["properties"] = props
                else:
                    resolved_widget["properties"] = self._substitute_in_dict(props, context)
            else:
                resolved_widget["properties"] = props

        # Handle special bindings
        props_for_bind = resolved_widget.get("properties") or {}
        # Only resolve bind → to_dest for leaf link widgets.
        # Do NOT consume bind for composite widgets like link_list; they expand later using per-item context.
        if isinstance(props_for_bind, dict) and "bind" in props_for_bind:
            # Ignore empty/whitespace binds
            bind_expr = props_for_bind.get("bind")
            if isinstance(bind_expr, str) and not bind_expr.strip():
                # Remove empty bind to avoid validation errors downstream
                try:
                    del resolved_widget["properties"]["bind"]
                except Exception:
                    pass
            elif wtype in ("internal_link", "tap_zone"):
                if not isinstance(resolved_widget.get("properties"), dict):
                    resolved_widget["properties"] = {}
                resolved_widget["properties"]["to_dest"] = self._resolve_binding(str(bind_expr), context)
                try:
                    del resolved_widget["properties"]["bind"]  # Remove bind after resolving
                except Exception:
                    pass
            # else: keep 'bind' intact for composites

        return resolved_widget

    def _substitute_tokens(self, text: str, context: BindingContext) -> str:
        """Substitute tokens in text using context."""
        if not isinstance(text, str):
            return text

        context_dict = context.to_dict()
        result = text

        # Brace-style tokens with optional format specifiers: {var} or {var:format}
        try:
            import re as _re
            def _brace_repl(m):
                var_name = m.group(1)
                format_spec = m.group(2)  # May be None if no :format part

                value = context_dict.get(var_name)
                if value is None:
                    return m.group(0)  # Return original token if variable not found

                # Apply format specifier if provided
                if format_spec:
                    try:
                        # Handle common format specifiers
                        if format_spec.endswith('d'):
                            # Integer formatting like 02d, 03d
                            return f"{int(value):{format_spec}}"
                        elif format_spec.endswith('f'):
                            # Float formatting like .2f
                            return f"{float(value):{format_spec}}"
                        else:
                            # String formatting
                            return f"{str(value):{format_spec}}"
                    except (ValueError, TypeError):
                        # If formatting fails, return the raw value
                        return str(value)
                else:
                    return str(value)

            # Match {var} or {var:format} where format can contain digits, letters, dots
            result = _re.sub(r'\{([A-Za-z0-9_]+)(?::([A-Za-z0-9._]+))?\}', _brace_repl, result)
        except Exception:
            # Fallback to simple replacement for any regex errors
            for key, value in context_dict.items():
                token = "{" + key + "}"
                if token in result:
                    result = result.replace(token, str(value))

        # At-style tokens with optional format specifiers: @var or @var:format
        try:
            import re as _re
            def _repl(m):
                var_name = m.group(1)
                format_spec = m.group(2)  # May be None if no :format part

                value = context_dict.get(var_name)
                if value is None:
                    return m.group(0)  # Return original token if variable not found

                # Apply format specifier if provided
                if format_spec:
                    try:
                        # Handle common format specifiers
                        if format_spec.endswith('d'):
                            # Integer formatting like 02d, 03d
                            return f"{int(value):{format_spec}}"
                        elif format_spec.endswith('f'):
                            # Float formatting like .2f
                            return f"{float(value):{format_spec}}"
                        else:
                            # String formatting
                            return f"{str(value):{format_spec}}"
                    except (ValueError, TypeError):
                        # If formatting fails, return the raw value
                        return str(value)
                else:
                    return str(value)

            # Match @var or @var:format where format can contain digits, letters, dots
            result = _re.sub(r'@([A-Za-z0-9_]+)(?::([A-Za-z0-9._]+))?', _repl, result)
        except Exception:
            pass

        return result

    def _substitute_in_dict(self, data: Dict[str, Any], context: BindingContext) -> Dict[str, Any]:
        """Recursively substitute tokens in dictionary values."""
        result = {}
        for key, value in data.items():
            if isinstance(value, str):
                result[key] = self._substitute_tokens(value, context)
            elif isinstance(value, dict):
                result[key] = self._substitute_in_dict(value, context)
            elif isinstance(value, list):
                result[key] = self._substitute_in_list(value, context)
            else:
                result[key] = value
        return result

    def _substitute_in_list(self, data: list, context: BindingContext) -> list:
        """Recursively substitute tokens in list items."""
        result = []
        for item in data:
            if isinstance(item, str):
                result.append(self._substitute_tokens(item, context))
            elif isinstance(item, dict):
                result.append(self._substitute_in_dict(item, context))
            elif isinstance(item, list):
                result.append(self._substitute_in_list(item, context))
            else:
                result.append(item)
        return result

    def _resolve_binding(self, bind_expr: str, context: BindingContext) -> str:
        """Resolve binding expression to destination ID."""
        # Validate binding grammar - only function-like patterns allowed
        self._validate_binding_grammar(bind_expr)

        # Handle function-like patterns: func(arg), func(@var), func(literal)
        import re

        # Pattern: word(content) with optional #suffix
        func_pattern = r'^(\w+)\(([^)]+)\)(#.*)?$'
        match = re.match(func_pattern, bind_expr)

        if match:
            func_name = match.group(1)
            arg = match.group(2)
            suffix = match.group(3) or ""

            # Replace any @var or @var:format occurrences within arg using context
            context_dict = context.to_dict()
            def _replace_at_var(m: re.Match) -> str:
                var_name = m.group(1)
                format_spec = m.group(2)  # May be None if no :format part

                value = context_dict.get(var_name)
                if value is None:
                    return m.group(0)  # Return original token if variable not found

                # Apply format specifier if provided
                if format_spec:
                    try:
                        # Handle common format specifiers
                        if format_spec.endswith('d'):
                            # Integer formatting like 02d, 03d
                            return f"{int(value):{format_spec}}"
                        elif format_spec.endswith('f'):
                            # Float formatting like .2f
                            return f"{float(value):{format_spec}}"
                        else:
                            # String formatting
                            return f"{str(value):{format_spec}}"
                    except (ValueError, TypeError):
                        # If formatting fails, return the raw value
                        return str(value)
                else:
                    return str(value)

            arg_expanded = re.sub(r'@([A-Za-z0-9_]+)(?::([A-Za-z0-9._]+))?', _replace_at_var, arg)

            # Substitute {tokens} if any remain (should be resolved earlier)
            resolved_arg = self._substitute_tokens(arg_expanded, context)

            # Build destination based on function name
            if func_name == "notes":
                # notes(N) → notes:page:NNN (padded to 3 digits)
                try:
                    page_num = int(resolved_arg)
                    return f"notes:page:{page_num:03d}{suffix}"
                except ValueError:
                    return f"notes:page:{resolved_arg}{suffix}"

            elif func_name == "year":
                # year(YYYY) → year:YYYY
                return f"year:{resolved_arg}{suffix}"

            elif func_name == "month":
                # month(YYYY-MM) → month:YYYY-MM
                return f"month:{resolved_arg}{suffix}"

            elif func_name == "day":
                # day(YYYY-MM-DD) → day:YYYY-MM-DD
                return f"day:{resolved_arg}{suffix}"

            else:
                # Generic: func(arg) → func:arg
                return f"{func_name}:{resolved_arg}{suffix}"

        # Handle @variable patterns
        if bind_expr.startswith("@"):
            var_name = bind_expr[1:]
            context_dict = context.to_dict()
            if var_name in context_dict:
                return str(context_dict[var_name])

        # Simple substitution for other patterns
        return self._substitute_tokens(bind_expr, context)

    def _validate_binding_grammar(self, bind_expr: str) -> None:
        """
        Validate that binding expression follows allowed grammar.

        Allowed patterns:
        1. Function-like: func(arg), func(@var), func(literal) with optional #suffix
        2. Simple @variable: @var
        3. Direct destination with optional tokens: month:{year}-{index_padded}, year:2026, etc.
        4. Curly brace tokens for template substitution: {var}, {var:format}
        """
        # Valid patterns:
        # 1. Function-like: func(arg), func(@var), func(literal)
        # 2. Simple @variable: @var
        # 3. Direct destination: home:index, year:2026, month:2026-01, month:{year}-{index_padded} etc.
        # 4. Tokens that will be substituted: {var}, @var

        func_pattern = re.compile(r'^(\w+)\(([^)]+)\)(#.*)?$')
        var_pattern = re.compile(r'^@\w+$')
        # Allow destinations with tokens like month:{year}-{index_padded} or already-resolved like month:2026-01
        dest_with_tokens_pattern = re.compile(r'^[a-z0-9][a-z0-9:_\-\{\}@]+$', re.IGNORECASE)

        if not (func_pattern.match(bind_expr) or
                var_pattern.match(bind_expr) or
                dest_with_tokens_pattern.match(bind_expr)):
            raise CompilationServiceError(
                f"Binding '{bind_expr}' uses invalid syntax. "
                f"Valid patterns: func(@var), func(literal), @var, or direct:destination"
            )


class CompilationService:
    """Service for compiling projects using master/plan architecture."""

    def __init__(self):
        self.enumerator = PlanEnumerator()

    def compile_project(self, project: Project, device_profile: Optional[Dict[str, Any]] = None) -> CompilationResult:
        """
        Compile project into final template using master/plan approach.

        Args:
            project: Project to compile with masters and plan
            device_profile: Device profile with validation constraints (optional)

        Returns:
            CompilationResult with final template and stats

        Raises:
            CompilationServiceError: If compilation fails
        """
        if not project.masters:
            raise CompilationServiceError("Project has no masters")

        if not project.plan.sections:
            raise CompilationServiceError("Project plan has no sections")

        logger.info(f"Compiling project '{project.metadata.name}' with {len(project.masters)} masters")
        # Set plan locale (default 'en') for enumerator/context
        try:
            self.enumerator.plan_locale = getattr(project.plan, 'locale', 'en') or 'en'
        except Exception:
            self.enumerator.plan_locale = 'en'

        # Parse calendar dates (optional, used as fallback for sections without dates)
        calendar_start = None
        calendar_end = None
        if project.plan.calendar.start_date:
            calendar_start = date.fromisoformat(project.plan.calendar.start_date)
        if project.plan.calendar.end_date:
            calendar_end = date.fromisoformat(project.plan.calendar.end_date)

        # Create destination registry for named destinations
        destination_registry = DestinationRegistry()
        binding_resolver = BindingResolver(destination_registry)

        # Generate all page instances following plan order
        compiled_widgets: List[Widget] = []
        page_number = 1
        compilation_stats = {
            "total_pages": 0,
            "total_widgets": 0,
            "sections_processed": 0,
            "pages_generated_per_section": {}
        }

        for section_kind in project.plan.order:
            # Find the section
            section = None
            for s in project.plan.sections:
                if s.kind == section_kind:
                    section = s
                    break

            if not section:
                raise CompilationServiceError(f"Section '{section_kind}' not found in plan")

            logger.debug(f"Processing section: {section.kind} using master {section.master}")

            # Find the master
            master = None
            for m in project.masters:
                if m.name == section.master:
                    master = m
                    break

            if not master:
                raise CompilationServiceError(f"Master '{section.master}' not found")

            # Generate page instances for this section
            pages_generated = 0

            for context in self.enumerator.enumerate_section(section, calendar_start, calendar_end):
                # Generate pages for this context (might be multiple pages per item)
                for subpage in range(section.pages_per_item):
                    context.subpage = subpage + 1

                    # Apply context to master and create page widgets
                    page_widgets = self._instantiate_master(
                        master, context, binding_resolver, page_number
                    )

                    # Register any anchors as named destinations
                    self._register_anchors(page_widgets, destination_registry, page_number)

                    compiled_widgets.extend(page_widgets)
                    pages_generated += 1
                    page_number += 1

            compilation_stats["sections_processed"] += 1
            compilation_stats["pages_generated_per_section"][section.kind] = pages_generated

        compilation_stats["total_pages"] = page_number - 1
        compilation_stats["total_widgets"] = len(compiled_widgets)

        # Generate navigation structure
        named_destinations = self._build_named_destinations(destination_registry)
        outlines = self._generate_outlines(compiled_widgets, project)
        internal_links = self._collect_internal_links(compiled_widgets)

        # Validate the compiled template
        self._validate_compiled_template(compiled_widgets, destination_registry, internal_links, device_profile)

        # Build final template (enrich validation errors with link context)
        try:
            final_template = Template(
                schema_version="1.0",
                metadata=self._build_template_metadata(project),
                canvas=project.default_canvas or self._default_canvas(),
                widgets=compiled_widgets,
                navigation={
                    "named_destinations": [dest.model_dump() for dest in named_destinations],
                    "outlines": [outline.model_dump() for outline in outlines],
                    "links": [link.model_dump() for link in internal_links]
                },
                masters=[],
                page_assignments=[],
                export={"modes": ["flattened"], "default_mode": "flattened"}
            )
        except Exception as e:
            # Add diagnostics for unknown destinations
            try:
                available = {dest.id for dest in named_destinations}
                bad_links = [lnk for lnk in internal_links if lnk.to_dest not in available]
                if bad_links:
                    # Map widget id -> widget for context (page/type/content)
                    wmap = {w.id: w for w in compiled_widgets}
                    details = []
                    for bl in bad_links[:20]:  # limit to reasonable number
                        w = wmap.get(bl.from_widget)
                        if w is not None:
                            details.append(
                                f"  - from_widget={w.id} (type={w.type}, page={getattr(w, 'page', '?')}, content={getattr(w, 'content', '')!r}) to_dest='{bl.to_dest}'"
                            )
                        else:
                            details.append(f"  - from_widget={bl.from_widget} to_dest='{bl.to_dest}'")
                    hint = "\nLikely cause: a link_list with default bind 'notes(@index)' or an internal_link pointing to an undefined destination."
                    raise CompilationServiceError(
                        "Template validation failed: unknown link destinations found:\n" + "\n".join(details) + hint
                    ) from e
            except Exception:
                pass

            # Convert any remaining validation errors to CompilationServiceError
            from pydantic import ValidationError
            if isinstance(e, ValidationError):
                # Extract meaningful validation errors
                error_details = []
                for error in e.errors():
                    field_path = " -> ".join(str(part) for part in error['loc'])
                    error_msg = error['msg']
                    error_details.append(f"{field_path}: {error_msg}")

                raise CompilationServiceError(
                    f"Template validation failed:\n" + "\n".join(f"  - {detail}" for detail in error_details)
                ) from e

            # Fall back to original error if not a validation error
            raise CompilationServiceError(f"Template creation failed: {str(e)}") from e

        logger.info(f"Compilation complete: {compilation_stats['total_widgets']} widgets across {compilation_stats['total_pages']} pages")

        return CompilationResult(
            project_id=project.id,
            template=final_template,
            compilation_stats=compilation_stats,
            generated_at=datetime.now().isoformat()
        )

    def _instantiate_master(self, master: Master, context: BindingContext,
                           binding_resolver: BindingResolver, page_number: int) -> List[Widget]:
        """Instantiate a master with given context."""
        page_widgets = []

        for widget in master.widgets:
            # Convert widget to dict for processing
            widget_dict = widget.model_dump()

            # Apply context and resolve bindings
            try:
                resolved_widget = binding_resolver.resolve_widget_bindings(widget_dict, context)
            except CompilationServiceError as e:
                wid = widget_dict.get("id", f"index_{len(page_widgets)}")
                wtype = widget_dict.get("type", "?")
                mname = getattr(master, 'name', getattr(master, 'id', '?'))
                raise CompilationServiceError(
                    f"{e} [master={mname}, widget_id={wid}, type={wtype}]"
                ) from e

            # Set page number
            resolved_widget["page"] = page_number

            # Handle composite widgets that expand to multiple widgets
            if resolved_widget.get("type") in ["calendar_year", "calendar_month", "grid", "link_list"]:
                expanded_widgets = self._expand_composite_widget(
                    resolved_widget, context, binding_resolver, page_number, len(page_widgets)
                )
                page_widgets.extend(expanded_widgets)
            else:
                # Ensure unique widget ID across all pages
                original_id = resolved_widget.get("id", f"widget_{len(page_widgets)}")
                resolved_widget["id"] = f"page_{page_number}_{original_id}"

                # Propagate plan locale into calendar widgets if not set
                try:
                    if resolved_widget.get('type') == 'calendar':
                        props = resolved_widget.get('properties') or {}
                        if 'locale' not in props or not str(props.get('locale', '')).strip():
                            loc = getattr(self.enumerator, 'plan_locale', 'en')
                            props['locale'] = loc
                            resolved_widget['properties'] = props
                except Exception:
                    pass

                # Convert back to Widget model
                page_widgets.append(Widget.model_validate(resolved_widget))

        return page_widgets

    def _expand_composite_widget(self, widget_dict: Dict[str, Any], context: BindingContext,
                                binding_resolver: BindingResolver, page_number: int,
                                widget_index: int) -> List[Widget]:
        """Expand composite widgets into multiple standard widgets."""
        widget_type = widget_dict.get("type")
        widgets = []

        if widget_type == "grid":
            widgets = self._expand_grid_widget(widget_dict, context, binding_resolver, page_number, widget_index)
        elif widget_type == "calendar_year":
            widgets = self._expand_calendar_year_widget(widget_dict, context, binding_resolver, page_number, widget_index)
        elif widget_type == "calendar_month":
            widgets = self._expand_calendar_month_widget(widget_dict, context, binding_resolver, page_number, widget_index)
        elif widget_type == "link_list":
            widgets = self._expand_link_list_widget(widget_dict, context, binding_resolver, page_number, widget_index)

        return widgets

    def _expand_grid_widget(self, widget_dict: Dict[str, Any], context: BindingContext,
                           binding_resolver: BindingResolver, page_number: int,
                           widget_index: int) -> List[Widget]:
        """Expand grid widget with data source and cell template."""
        widgets = []
        props = widget_dict.get("properties", {})
        position = widget_dict.get("position", {})
        base_styling = widget_dict.get("styling", {}) or {}

        rows = props.get("rows", 1)
        cols = props.get("cols", 1)
        data_source = props.get("data_source", "")
        cell_template = props.get("cell_template", {})
        base_styling = widget_dict.get("styling", {}) or {}

        # Parse data source
        if data_source.startswith("range(") and data_source.endswith(")"):
            # Handle range(start, end) pattern
            range_content = data_source[6:-1]  # Remove "range(" and ")"
            if "," in range_content:
                start, end = map(int, range_content.split(","))
                data = list(range(start, end))
            else:
                data = list(range(int(range_content)))
        else:
            # Simple list or other formats could be added here
            data = []

        # Calculate cell dimensions
        cell_width = position.get("width", 100) / cols
        cell_height = position.get("height", 100) / rows

        # Generate cells
        for i, value in enumerate(data):
            if i >= rows * cols:
                break  # Don't exceed grid capacity

            row = i // cols
            col = i % cols

            # Calculate cell position
            cell_x = position.get("x", 0) + col * cell_width
            cell_y = position.get("y", 0) + row * cell_height

            # Create cell context
            cell_context = BindingContext()
            cell_context.custom = context.to_dict()
            cell_context.custom["cell_value"] = value

            # Create cell widget from template
            cell_widget = copy.deepcopy(cell_template)
            cell_widget["position"] = {
                "x": cell_x, "y": cell_y,
                "width": cell_width, "height": cell_height
            }
            cell_widget["page"] = page_number
            cell_widget["id"] = f"page_{page_number}_grid_{widget_index}_cell_{i}"
            if not cell_widget.get("styling") and base_styling:
                cell_widget["styling"] = base_styling

            # Resolve cell bindings
            resolved_cell = binding_resolver.resolve_widget_bindings(cell_widget, cell_context)

            widgets.append(Widget.model_validate(resolved_cell))

        return widgets

    def _expand_link_list_widget(self, widget_dict: Dict[str, Any], context: BindingContext,
                                 binding_resolver: BindingResolver, page_number: int,
                                 widget_index: int) -> List[Widget]:
        """Expand a link_list composite into multiple internal_link widgets.

        Properties supported:
          - labels: array of label strings (required)
          - destinations: array of destination IDs (required, must match labels length)
          - columns: layout columns (default 1)
          - orientation: 'horizontal' or 'vertical' (default 'horizontal')
          - gap_x, gap_y: spacing between cells (default 0)
          - item_height: fixed row height (optional); otherwise computed from box height
          - highlight_index: index to highlight (1-based)
          - highlight_color: color for highlighted item
          - background_color: background color for all items
        """
        widgets: List[Widget] = []
        props = widget_dict.get("properties", {}) or {}
        position = widget_dict.get("position", {}) or {}
        base_styling = widget_dict.get("styling", {}) or {}

        # Get required arrays
        labels = props.get("labels", [])
        destinations = props.get("destinations", [])

        # Validation
        if not isinstance(labels, list) or not isinstance(destinations, list):
            wid = widget_dict.get("id", f"page_{page_number}_links_{widget_index}")
            raise CompilationServiceError(
                f"link_list '{wid}': labels and destinations must be arrays"
            )

        if len(labels) == 0:
            return widgets  # Empty link list, nothing to render

        if len(labels) != len(destinations):
            wid = widget_dict.get("id", f"page_{page_number}_links_{widget_index}")
            raise CompilationServiceError(
                f"link_list '{wid}': labels and destinations arrays must have the same length "
                f"(labels: {len(labels)}, destinations: {len(destinations)})"
            )

        # Layout properties
        columns = max(1, int(props.get("columns", 1)))
        orientation_raw = props.get("orientation", "horizontal")
        if orientation_raw == 'vertical':
            orientation = 'vertical_cw'
        elif orientation_raw in ('vertical_cw', 'vertical_ccw'):
            orientation = orientation_raw
        else:
            orientation = 'horizontal'

        # Handle empty strings for numeric properties
        gap_x_raw = props.get("gap_x", 0.0)
        gap_x = float(gap_x_raw) if gap_x_raw not in (None, '') else 0.0

        gap_y_raw = props.get("gap_y", 0.0)
        gap_y = float(gap_y_raw) if gap_y_raw not in (None, '') else 0.0

        item_height_raw = props.get("item_height")
        item_height = None
        if item_height_raw not in (None, ''):
            try:
                item_height = float(item_height_raw)
            except (ValueError, TypeError):
                item_height = None

        # Highlighting - resolve token to number
        highlight_index = props.get("highlight_index")
        if highlight_index is not None:
            # Try to resolve as token first (e.g., {month}, {index})
            if isinstance(highlight_index, str):
                resolved_highlight = binding_resolver._substitute_tokens(highlight_index, context)
                try:
                    highlight_index = int(resolved_highlight)
                except (ValueError, TypeError):
                    # If can't convert to int, ignore highlight
                    highlight_index = None
            else:
                try:
                    highlight_index = int(highlight_index)
                except (ValueError, TypeError):
                    highlight_index = None
        highlight_color = props.get("highlight_color")
        background_color = props.get("background_color")

        # Calculate layout
        count = len(labels)
        rows = int(math.ceil(count / columns))

        total_width = float(position.get("width", 400))
        total_height = float(position.get("height", 300))
        base_cell_w = (total_width - (columns - 1) * gap_x) / columns
        base_cell_h = (total_height - (rows - 1) * gap_y) / rows

        if orientation in ('vertical_cw', 'vertical_ccw'):
            cell_height = base_cell_h
            cell_width = item_height if item_height is not None else base_cell_w
        else:
            cell_width = base_cell_w
            cell_height = item_height if item_height is not None else base_cell_h

        base_x = float(position.get("x", 0))
        base_y = float(position.get("y", 0))

        # Generate link widgets
        for i in range(count):
            row = i // columns
            col = i % columns

            cell_x = base_x + col * (cell_width + gap_x)
            cell_y = base_y + row * (cell_height + gap_y)

            # Get label and destination for this item
            label = str(labels[i])
            destination = str(destinations[i])

            # Apply token substitution to both label and destination
            label_resolved = binding_resolver._substitute_tokens(label, context)
            dest_resolved = binding_resolver._substitute_tokens(destination, context)

            # Build widget
            cell_widget = {
                "type": "internal_link",
                "position": {
                    "x": cell_x,
                    "y": cell_y,
                    "width": cell_width,
                    "height": cell_height
                },
                "content": label_resolved,
                "styling": base_styling,
                "properties": {
                    "bind": dest_resolved,
                    "orientation": orientation,
                    **({"highlight_color": highlight_color} if highlight_color else {}),
                    **({"background_color": background_color} if background_color else {})
                },
                "page": page_number,
                "id": f"page_{page_number}_links_{widget_index}_{i}"
            }

            # Apply highlight if this is the highlighted index (1-based)
            if highlight_index is not None and (i + 1) == highlight_index:
                cell_widget["properties"]["highlight"] = True

            # Resolve bindings (converts bind to to_dest)
            resolved_cell = binding_resolver.resolve_widget_bindings(cell_widget, context)
            widgets.append(Widget.model_validate(resolved_cell))

        return widgets

    def _expand_calendar_year_widget(self, widget_dict: Dict[str, Any], context: BindingContext,
                                    binding_resolver: BindingResolver, page_number: int,
                                    widget_index: int) -> List[Widget]:
        """Expand calendar_year widget into 12 month cells."""
        widgets = []
        props = widget_dict.get("properties", {})
        base_styling = widget_dict.get("styling", {}) or {}
        position = widget_dict.get("position", {})

        year = props.get("year", context.year or 2026)
        if isinstance(year, str) and year.startswith("@"):
            # Resolve @year from context
            var_name = year[1:]
            year = context.to_dict().get(var_name, 2026)

        month_cell_config = props.get("month_cell", {})

        # 3x4 grid for 12 months
        rows, cols = 3, 4
        cell_width = position.get("width", 400) / cols
        cell_height = position.get("height", 300) / rows

        months = [
            "January", "February", "March", "April",
            "May", "June", "July", "August",
            "September", "October", "November", "December"
        ]

        for month_num in range(1, 13):
            row = (month_num - 1) // cols
            col = (month_num - 1) % cols

            cell_x = position.get("x", 0) + col * cell_width
            cell_y = position.get("y", 0) + row * cell_height

            # Create month context
            month_context = BindingContext()
            month_context.custom = context.to_dict()
            month_context.custom["cell_month"] = f"{year}-{month_num:02d}"
            month_context.custom["cell_month_name"] = months[month_num - 1]

            # Create month cell widget
            cell_widget = {
                "type": "internal_link",
                "position": {
                    "x": cell_x, "y": cell_y,
                    "width": cell_width, "height": cell_height
                },
                "content": months[month_num - 1],
                "styling": base_styling,
                "properties": {
                    "font_size": 12,
                    "text_align": "center"
                },
                "page": page_number,
                "id": f"page_{page_number}_year_{widget_index}_month_{month_num}"
            }

            # Add link if specified
            if "link" in month_cell_config:
                link_config = month_cell_config["link"]
                if "bind" in link_config:
                    cell_widget["properties"]["bind"] = link_config["bind"]
                elif "to_dest" in link_config:
                    cell_widget["properties"]["to_dest"] = link_config["to_dest"]

            # Resolve bindings
            resolved_cell = binding_resolver.resolve_widget_bindings(cell_widget, month_context)
            widgets.append(Widget.model_validate(resolved_cell))

        return widgets

    def _expand_calendar_month_widget(self, widget_dict: Dict[str, Any], context: BindingContext,
                                     binding_resolver: BindingResolver, page_number: int,
                                     widget_index: int) -> List[Widget]:
        """Expand calendar_month widget into day cells."""
        widgets = []
        props = widget_dict.get("properties", {})
        position = widget_dict.get("position", {})

        month_str = props.get("month", f"{context.year or 2026}-{context.month or 1:02d}")
        if isinstance(month_str, str) and month_str.startswith("@"):
            # Resolve @month from context
            var_name = month_str[1:]
            month_str = context.to_dict().get(var_name, "2026-01")

        # Parse YYYY-MM format
        try:
            year, month = map(int, month_str.split("-"))
        except ValueError:
            year, month = 2026, 1

        day_cell_config = props.get("day_cell", {})

        # Get days in month
        from calendar import monthrange
        _, days_in_month = monthrange(year, month)

        # Calendar grid: 7 columns (days of week), up to 6 rows
        cols = 7
        max_rows = 6
        cell_width = position.get("width", 400) / cols
        cell_height = position.get("height", 300) / max_rows

        # Find what day of week the 1st falls on (0=Monday, 6=Sunday)
        first_day = date(year, month, 1)
        start_weekday = first_day.weekday()  # 0=Monday

        # Adjust for start_week_on preference
        start_week_on = props.get("start_week_on", "mon")
        if start_week_on == "sun":
            start_weekday = (start_weekday + 1) % 7  # Convert to Sunday start

        for day in range(1, days_in_month + 1):
            # Calculate grid position
            total_days = start_weekday + day - 1
            row = total_days // cols
            col = total_days % cols

            if row >= max_rows:
                break  # Don't exceed calendar bounds

            cell_x = position.get("x", 0) + col * cell_width
            cell_y = position.get("y", 0) + row * cell_height

            # Create day context
            day_date = date(year, month, day)
            day_context = BindingContext()
            day_context.custom = context.to_dict()
            day_context.custom["cell_date"] = day_date.isoformat()
            day_context.custom["cell_day"] = day

            # Create day cell widget
            cell_widget = {
                "type": "internal_link",
                "position": {
                    "x": cell_x, "y": cell_y,
                    "width": cell_width, "height": cell_height
                },
                "content": str(day),
                "styling": base_styling,
                "properties": {
                    "font_size": 10,
                    "text_align": "center"
                },
                "page": page_number,
                "id": f"page_{page_number}_month_{widget_index}_day_{day}"
            }

            # Add link if specified
            if "link" in day_cell_config:
                link_config = day_cell_config["link"]
                if "bind" in link_config:
                    cell_widget["properties"]["bind"] = link_config["bind"]
                elif "to_dest" in link_config:
                    cell_widget["properties"]["to_dest"] = link_config["to_dest"]

            # Resolve bindings
            resolved_cell = binding_resolver.resolve_widget_bindings(cell_widget, day_context)
            widgets.append(Widget.model_validate(resolved_cell))

        return widgets

    def _register_anchors(self, widgets: List[Widget], registry: DestinationRegistry, page_number: int):
        """Register anchor widgets as named destinations."""
        for widget in widgets:
            if widget.type == "anchor" and widget.properties:
                dest_id = widget.properties.get("dest_id")
                if not dest_id or not isinstance(dest_id, str):
                    continue

                resolved_dest = dest_id.strip()
                if not resolved_dest:
                    continue

                resolved_dest = resolved_dest.replace('{PAGE}', '{page}').replace('{TOTAL_PAGES}', '{total_pages}')

                if TokenProcessor.has_tokens(resolved_dest):
                    context = RenderingTokenContext(page_num=page_number, total_pages=page_number)
                    resolved_dest = TokenProcessor.replace_rendering_tokens(resolved_dest, context).strip()
                    if not resolved_dest:
                        continue

                resolved_dest = resolved_dest.lower()

                if widget.properties.get('dest_id') != resolved_dest:
                    widget.properties['dest_id'] = resolved_dest

                registry.add_destination(
                    resolved_dest,
                    page_number,
                    widget.position.x,
                    widget.position.y,
                    getattr(widget, 'id', None)
                )

    def _build_named_destinations(self, registry: DestinationRegistry) -> List[NamedDestination]:
        """Build named destinations from registry, with diagnostics on invalid IDs."""
        destinations: List[NamedDestination] = []
        for dest_id, info in registry.destinations.items():
            try:
                destinations.append(NamedDestination(
                    id=dest_id,
                    page=info["page"],
                    x=info["x"],
                    y=info["y"],
                    fit="FitH"
                ))
            except Exception as e:
                src = info.get('source_widget_id', '?')
                page = info.get('page', '?')
                raise CompilationServiceError(
                    f"Invalid named destination id '{dest_id}' (page={page}, widget_id={src}): {e}"
                ) from e
        return destinations

    def _generate_outlines(self, widgets: List[Widget], project: Project) -> List[OutlineItem]:
        """Generate PDF outline structure."""
        if not project.link_resolution.generate_outlines:
            return []

        outlines: List[OutlineItem] = []

        # Collect anchor destinations present in compiled widgets
        anchor_dests = set()
        for w in widgets:
            if w.type == "anchor" and w.properties and w.properties.get("dest_id"):
                anchor_dests.add(w.properties.get("dest_id"))

        # Index
        if "home:index" in anchor_dests:
            outlines.append(OutlineItem(title="Index", dest="home:index", level=1))

        # Year and months (minimal tree)
        import re
        year_re = re.compile(r"^year:(\d{4})$")
        month_re = re.compile(r"^month:(\d{4})-(\d{2})$")

        # Add year outlines
        years = sorted({m.group(1) for d in anchor_dests for m in [year_re.match(d)] if m})
        for y in years:
            outlines.append(OutlineItem(title=f"{y}", dest=f"year:{y}", level=1))

            # Add months under each year if present
            months = [d for d in anchor_dests if d.startswith(f"month:{y}-")]
            # Sort months chronologically
            months_sorted = sorted(months)
            for md in months_sorted:
                # Title like "March" or "03"; keep simple YYYY-MM for now
                outlines.append(OutlineItem(title=md.split(":", 1)[1], dest=md, level=2))

        # Notes (single top-level outline)
        notes_pages = sorted([d for d in anchor_dests if d.startswith("notes:page:")])
        if notes_pages:
            outlines.append(OutlineItem(title="Notes", dest=notes_pages[0], level=1))

        return outlines

    def _collect_internal_links(self, widgets: List[Widget]) -> List[InternalLink]:
        """Collect internal links from widgets."""
        links = []

        for widget in widgets:
            if widget.properties and widget.properties.get("to_dest"):
                links.append(InternalLink(
                    from_widget=widget.id,
                    to_dest=widget.properties["to_dest"],
                    padding=widget.properties.get("padding", 6.0)
                ))

        return links

    def _build_template_metadata(self, project: Project) -> Dict[str, Any]:
        """Build template metadata from project."""
        return {
            "name": f"{project.metadata.name} (Compiled)",
            "description": project.metadata.description,
            "category": project.metadata.category,
            "version": "1.0",
            "author": project.metadata.author,
            "created": project.metadata.created_at,
            "profile": project.metadata.device_profile
        }

    def _default_canvas(self) -> Dict[str, Any]:
        """Default canvas configuration."""
        return {
            "dimensions": {"width": 595.2, "height": 841.8, "margins": [72, 72, 72, 72]},
            "coordinate_system": "top_left",
            "background": "#FFFFFF",
            "grid_size": 10,
            "snap_enabled": True
        }

    def _validate_compiled_template(self, widgets: List[Widget], registry: DestinationRegistry,
                                   links: List[InternalLink]) -> None:
        """Validate the compiled template for common issues."""
        errors = []
        warnings = []

        # Get available destinations
        available_destinations = set(registry.destinations.keys())

        # 1. Validate link destinations exist
        for link in links:
            if link.to_dest not in available_destinations:
                errors.append(f"Link references unknown destination '{link.to_dest}'")

        # 2. Validate touch targets are reasonable - now profile-driven
        # This validation is now handled in _validate_compiled_template
        pass

        # 3. Check for duplicate destination IDs
        dest_ids = list(registry.destinations.keys())
        duplicates = set([dest for dest in dest_ids if dest_ids.count(dest) > 1])
        for dup in duplicates:
            errors.append(f"Duplicate destination ID: '{dup}'")

        # 4. Validate widgets are within reasonable page bounds
        # (This is a soft check since different device profiles have different sizes)
        for widget in widgets:
            if widget.position.x < 0 or widget.position.y < 0:
                warnings.append(f"Widget {widget.id} has negative position: {widget.position.x}, {widget.position.y}")

        # Log warnings
        for warning in warnings:
            logger.warning(f"Validation warning: {warning}")

        # Raise errors
        if errors:
            error_msg = "Template validation failed:\n" + "\n".join(f"  - {error}" for error in errors)
            raise CompilationServiceError(error_msg)

    def _validate_compiled_template(self, widgets: List[Widget], registry: DestinationRegistry, links: List[InternalLink], device_profile: Optional[Dict[str, Any]] = None) -> None:
        """
        Post-compile validation to ensure template is production-ready.

        Critical checks:
        1. No template tokens remain in destination IDs
        2. All destination IDs follow canonical format
        3. Case normalization compliance
        4. No unresolved bindings
        """
        errors = []
        warnings = []

        # Pattern for template tokens that should not exist in compiled output
        token_pattern = re.compile(r'[{}@]')

        # Canonical destination ID pattern (post-compile)
        canonical_dest_pattern = re.compile(r'^[a-z0-9][a-z0-9:_-]{1,127}$')

        # 1. Check destination IDs for template tokens and canonical format
        for dest_id in registry.destinations.keys():
            # Critical: No template tokens allowed in final destination IDs
            if token_pattern.search(dest_id):
                errors.append(f"Compiled destination ID contains template tokens: '{dest_id}'")

            # Canonical format validation
            if not canonical_dest_pattern.match(dest_id):
                errors.append(f"Destination ID '{dest_id}' does not follow canonical format: ^[a-z0-9][a-z0-9:-_]{{1,127}}$")

            # Case normalization check
            if dest_id != dest_id.lower():
                warnings.append(f"Destination ID '{dest_id}' should be lowercase")

            # Collapse multiple colons
            if '::' in dest_id:
                normalized = re.sub(r':+', ':', dest_id)
                warnings.append(f"Destination ID '{dest_id}' should collapse multiple colons to '{normalized}'")

        # 2. Check link destinations for template tokens
        for link in links:
            if token_pattern.search(link.to_dest):
                errors.append(f"Compiled link destination contains template tokens: '{link.to_dest}'")

            # Check canonical format for link destinations
            if not canonical_dest_pattern.match(link.to_dest):
                errors.append(f"Link destination '{link.to_dest}' does not follow canonical format")

        # 3. Check widget properties for unresolved tokens
        for widget in widgets:
            # Check dest_id properties in anchor widgets
            if hasattr(widget.properties, 'dest_id') and widget.properties.dest_id:
                if token_pattern.search(widget.properties.dest_id):
                    errors.append(f"Widget {widget.id} dest_id contains template tokens: '{widget.properties.dest_id}'")

            # Check to_dest properties in link widgets
            if hasattr(widget.properties, 'to_dest') and widget.properties.to_dest:
                if token_pattern.search(widget.properties.to_dest):
                    errors.append(f"Widget {widget.id} to_dest contains template tokens: '{widget.properties.to_dest}'")

            # Check bind properties should not exist in compiled output
            if hasattr(widget.properties, 'bind') and widget.properties.bind:
                errors.append(f"Widget {widget.id} still has unresolved bind property: '{widget.properties.bind}'")

            # Check widget content for template tokens (outside of allowed content fields)
            if hasattr(widget, 'content') and widget.content:
                # Allow template tokens in text content (for display purposes)
                # but warn if they look like unresolved variables
                if token_pattern.search(widget.content):
                    # Find potential unresolved variables
                    potential_unresolved = re.findall(r'\{[^}]*\}|@\w+', widget.content)
                    if potential_unresolved:
                        # Filter out rendering-time tokens that should remain for PDF generation
                        rendering_tokens = {'{page}', '{total_pages}'}
                        actual_unresolved = [var for var in potential_unresolved if var not in rendering_tokens]

                        if actual_unresolved:
                            warnings.append(f"Widget {widget.id} content may have unresolved variables: {actual_unresolved}")

        # 4. Validate destination uniqueness (enhanced from existing check)
        dest_ids = list(registry.destinations.keys())
        duplicates = set([dest for dest in dest_ids if dest_ids.count(dest) > 1])
        for dup in duplicates:
            errors.append(f"Duplicate destination ID: '{dup}'")

        # 5. Profile-driven touch target validation
        # Default to 44pt for finger use, 20pt for stylus use profiles
        default_min_touch_size = 44.0  # Finger-friendly default
        min_touch_size = default_min_touch_size

        if device_profile:
            # Extract min_touch_target_pt from device profile
            constraints = device_profile.get('constraints', {})
            profile_min_touch = constraints.get('min_touch_target_pt')
            if profile_min_touch:
                min_touch_size = float(profile_min_touch)
                logger.debug(f"Using profile-driven min touch target: {min_touch_size}pt")
            else:
                logger.warning(f"Device profile missing min_touch_target_pt, using default: {default_min_touch_size}pt")

        # Validate touch targets for interactive widgets
        for widget in widgets:
            if widget.type in ["internal_link", "checkbox", "button", "tap_zone"]:
                width = widget.position.width
                height = widget.position.height
                if width < min_touch_size or height < min_touch_size:
                    warnings.append(
                        f"Widget {widget.id} has small touch target: {width}x{height}pt "
                        f"(profile minimum: {min_touch_size}pt)"
                    )

        # Log warnings
        for warning in warnings:
            logger.warning(f"Post-compile validation warning: {warning}")

        # Raise errors - these are critical and must be fixed
        if errors:
            error_msg = "Post-compile validation failed:\n" + "\n".join(f"  - {error}" for error in errors)
            raise CompilationServiceError(error_msg)
