# Template & Binding Manual (Draft)

This document summarizes the variables, binding grammar, and where each can be used when designing masters, plans, and previewing/compiling PDFs.

## Concepts at a Glance
- Tokens vs. @vars
  - Use {var} in content/labels and in IDs (e.g., Anchor `dest_id`).
  - Use @var only inside bind(...) arguments to build destinations.
- Destinations (IDs) must not contain @ and must match: `^[a-zA-Z0-9_:.{}-]+$`.
- Plan locale controls month/weekday names (currently: `en`, `pl`).
- Section dates: omit to inherit from global plan dates; provide both start and end to override.

## Available Variables (Tokens)

### Basic Variables
- Date/sequence
  - `{year}`, `{month}`, `{month_padded}`, `{month_name}`, `{month_abbr}`, `{month_padded3}`
  - `{day}`, `{day_padded}`, `{weekday}`
  - `{date}` (YYYY-MM-DD), `{date_long}` (localized long date; WIP), `{index}`, `{index_padded}`
  - `{page}`, `{total_pages}` (renderer-side in text_block)
- Context variables
  - Any variables set in a plan section `context` are available as `{var}` and `@var`.
- Locale
  - Plan `locale` (e.g., `en`, `pl`) is injected into context; calendars and month/weekday names follow it.

### Format Specifiers (NEW)
Both `{var}` and `@var` tokens now support Python format specifiers:

**Integer formatting:**
- `{month:02d}` → `01`, `02`, `03`, ..., `12` (zero-padded to 2 digits)
- `{index:03d}` → `001`, `002`, `003` (zero-padded to 3 digits)
- `@page:02d` → `01`, `02`, `03` (in binding expressions)

**Float formatting:**
- `{value:.2f}` → `3.14`, `2.50` (2 decimal places)
- `{ratio:.1%}` → `50.0%` (percentage with 1 decimal)

**String formatting:**
- `{name:>10}` → right-aligned in 10 characters
- `{title:<15}` → left-aligned in 15 characters

**Compatibility:**
- `{month_padded}` is equivalent to `{month:02d}` (padded to 2 digits)
- `{month_padded3}` is equivalent to `{month:03d}` (padded to 3 digits)
- `{index_padded}` respects the `index_pad` property (default 3: `{index:03d}`)

## Where Tokens Are Allowed
- Content/labels: `{...}` only
  - text_block `content`: e.g., `Rok {year}`, `{page}/{total_pages}`
  - link_list `label_template`: `{index}`, `{index_padded}`, `{month_name}`, `{month_abbr}`, `{month_padded}`, `{month_padded3}`, `{year}`
- IDs (Anchor dest_id): `{...}` only
  - Examples: `day:{date}`, `month:{year}-{month_padded}`, `notes:page:{index_padded}`
  - Do not use `@` in IDs.
- Properties (non-ID), e.g., calendar `start_date`/`end_date`:
  - Accept literal dates (`YYYY-MM-DD`) or tokens (`{year}-{month_padded}-01`). `@var` also supported for preview, but prefer `{...}` here.

## Binding Grammar (Destinations)
- Function-like binds (preferred): `func(arg)` or with `#suffix` (optional)
  - Supported helpers:
    - `notes(@index)` → `notes:page:NNN` (padded 3)
    - `year(YYYY)` → `year:YYYY`
    - `month(YYYY-MM)` → `month:YYYY-MM`
    - `day(YYYY-MM-DD)` → `day:YYYY-MM-DD`
    - Generic: `func(value)` → `func:value`
  - `@vars` may appear anywhere inside `arg` (e.g., `month(@year-@index_padded)`).
  - **NEW: Format specifiers supported** in `@vars` (e.g., `notes(@page:02d)` → `notes:01`, `notes:02`)
  - Braces `{...}` should not remain in `bind` after substitution. Prefer `@var` in binds.
- Direct destination literal
  - Example: `month:2026-01`, `year:2026`.
- Where to use
  - link_list `properties.bind` (required)
  - internal_link `properties.bind` (resolved to `to_dest`)
  - tap_zone `properties.bind` (alternative to `to_dest`)

## link_list (Composite)
- Expands to multiple `internal_link` widgets.
- Key properties
  - `count`, `start_index`, `index_pad`, `columns`
  - `gap_x`, `gap_y`, `item_height`
  - `label_template`: supports `{index}`, `{index_padded}`, `{month_name}`, `{month_abbr}`, `{month_padded}`, `{year}`, and format specifiers
  - `bind` (required): function-like or direct destination; resolved per item (tokens and @vars substituted per index)
- Examples
  - Year → months (12 items):
    - `index_pad: 2`, `label_template: "{month_name}"`, `bind: "month(@year-@index:02d)"`
  - Notes index with custom formatting:
    - `label_template: "Note {index:02d}"`, `bind: "notes(@page:02d)"` → creates `notes:01`, `notes:02`, etc.
  - Legacy compatibility:
    - `index_pad: 3`, `label_template: "Note {index_padded}"`, `bind: "notes(@index)"` → creates `notes:page:001`, `notes:page:002`

## Anchor (Named Destination)
- `properties.dest_id`: required
  - Must be a valid ID; use `{...}` tokens, never `@`.
  - Examples: `day:{date}`, `month:{year}-{month_padded}`, `year:{year}`
- Anchors are registered both for ReportLab preview and post-processing navigation.

## Internal Link / Tap Zone
- internal_link
  - Rendered text link; requires `properties.to_dest` (via `bind` or set directly).
- tap_zone
  - Invisible clickable area; use `properties.to_dest` (preferred) or `tap_action` page navigation (`prev_page`, `next_page`, `page_link` with `target_page`).

## Calendar
- Types: `monthly`, `weekly` (custom_range WIP)
- Locale-aware: month header and weekday labels follow plan `locale` or widget `properties.locale`.
- `first_day_of_week`: `monday` | `sunday`
- Link strategies
  - `named_destinations`: links to `day:YYYY-MM-DD` (requires day anchors on target pages)
  - `sequential_pages`: links to page bookmarks `Page_N` computed from `first_page_number` and `pages_per_date`
- Dates
  - `start_date`/`end_date` accept literals (`YYYY-MM-DD`) or tokens (e.g., `{year}-{month_padded}-01`).
  - Section-level dates override plan calendar when both provided; otherwise inherit global plan dates.

## Plan & Sections
- plan.calendar: `start_date`, `end_date`, `pages_per_day`
- plan.locale: overall locale for month/weekday names (`en`, `pl`)
- sections:
  - `generate`: `once` | `count` | `each_month` | `each_day`
  - `context`: per-section variables (available as `{var}` / `@var`)
  - `pages_per_item`: for multi-page items
  - `anchors`: optional fixed destinations for the section

## Validation & Best Practices
- IDs (dest_id) must not contain `@`; use `{...}` tokens only.
- Binds should not contain unresolved `{...}`; prefer `@var` inside function args.
- For months, use `index_pad: 2`; for notes pages, typically `index_pad: 3`.
- Ensure anchors exist for all named destinations referenced by links.
- Locale:
  - Set plan-level `locale` to keep labels and calendars consistent.

## Format Specifiers Reference

### Common Format Patterns
- **Zero-padding integers**: `:02d`, `:03d`, `:04d` (pad with zeros to 2, 3, 4 digits)
- **Decimal places**: `:.1f`, `:.2f` (1 or 2 decimal places for floats)
- **Percentages**: `:.1%` (percentage with 1 decimal place)
- **String alignment**: `:>10` (right), `:<10` (left), `:^10` (center in 10 chars)

### Practical Examples

**Notes with 2-digit padding:**
```yaml
label_template: "Note {index:02d}"
bind: "notes(@page:02d)"
# Creates: notes:01, notes:02, notes:03, ...
```

**Month links with custom format:**
```yaml
label_template: "{month_name}"
bind: "month(@year-@index:02d)"
# Creates: month:2026-01, month:2026-02, ...
```

**Mixed formatting in content:**
```yaml
content: "Page {page:03d} of {total_pages} - {month:02d}/{year}"
# Output: "Page 001 of 365 - 01/2026"
```

### Error Handling
- If format fails (e.g., applying `:02d` to non-numeric value), falls back to string representation
- Unknown variables return the original token unchanged
- Invalid format specifiers are ignored and raw value is used

## Quick Recipes
- Year page: 12 links labeled by month name
  - label_template: `{month_name}`
  - bind: `month(@year-@index:02d)` (NEW: custom format instead of @index_padded)
  - anchor on Month master: `month:{year}-{month:02d}`
- Monthly calendar linking to days
  - calendar: `calendar_type: monthly`, `start_date: {year}-{month:02d}-01`, `link_strategy: named_destinations`
  - anchor on Day master: `day:{date}`
- Weekly calendar on day page
  - calendar: `calendar_type: weekly`, `start_date: {date}`, `link_strategy: named_destinations`
- Notes index with custom padding
  - label_template: `Note {index:02d}` (NEW: replaces {index_padded} approach)
  - bind: `notes(@page:02d)` (NEW: custom format)
  - anchor on Note master: `notes:{index:02d}`

> This is a living document. When adding new helpers/locales, update this file to keep design and compile consistent.

