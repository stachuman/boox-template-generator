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
- Date/sequence
  - `{year}`, `{month}`, `{month_padded}`, `{month_name}`, `{month_abbr}`
  - `{day}`, `{day_padded}`, `{weekday}`
  - `{date}` (YYYY-MM-DD), `{date_long}` (localized long date; WIP), `{index}`, `{index_padded}`
  - `{page}`, `{total_pages}` (renderer-side in text_block)
- Context variables
  - Any variables set in a plan section `context` are available as `{var}` and `@var`.
- Locale
  - Plan `locale` (e.g., `en`, `pl`) is injected into context; calendars and month/weekday names follow it.

## Where Tokens Are Allowed
- Content/labels: `{...}` only
  - text_block `content`: e.g., `Rok {year}`, `{page}/{total_pages}`
  - link_list `label_template`: `{index}`, `{index_padded}`, `{month_name}`, `{month_abbr}`, `{month_padded}`, `{year}`
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
  - `label_template`: supports `{index}`, `{index_padded}`, `{month_name}`, `{month_abbr}`, `{month_padded}`, `{year}`
  - `bind` (required): function-like or direct destination; resolved per item (tokens and @vars substituted per index)
- Examples
  - Year → months (12 items):
    - `index_pad: 2`, `label_template: "{month_name}"`, `bind: "month(@year-@index_padded)"`
  - Notes index (10 items):
    - `index_pad: 3`, `label_template: "Note {index_padded}"`, `bind: "notes(@index)"`

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

## Quick Recipes
- Year page: 12 links labeled by month name
  - label_template: `{month_name}`
  - bind: `month(@year-@index_padded)`
  - anchor on Month master: `month:{year}-{month_padded}`
- Monthly calendar linking to days
  - calendar: `calendar_type: monthly`, `start_date: {year}-{month_padded}-01`, `link_strategy: named_destinations`
  - anchor on Day master: `day:{date}`
- Weekly calendar on day page
  - calendar: `calendar_type: weekly`, `start_date: {date}`, `link_strategy: named_destinations`

> This is a living document. When adding new helpers/locales, update this file to keep design and compile consistent.

