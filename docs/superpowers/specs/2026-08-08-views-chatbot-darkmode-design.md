# Views restyle, rule-aware chatbot, dark-mode fixes

Date: 2026-08-08

## 1. Timeline / Trainer / Rooms restyle

- Apply modern-SaaS visual pass to trainer, rooms, timeline views in `web/app.css` / `web/app.js`: consistent card elevation, rounded corners, soft shadows, generous spacing — matching the existing planner-card language already used elsewhere in the app.
- Move hardcoded `background:#fff` on `.room-timeline-outer` (app.js:1390) onto theme CSS vars so it inherits dark mode instead of needing a separate override.
- Timeline mode toggle (`_timelineMode`, app.js:165, existing modes: format/fill/trainer/density) gains two new modes:
  - **Level**: no `level` field exists anywhere in the data. Derive via class-name substring match, checked in this priority order:
    1. Contains "Strength Lab", "Amped Up", "Trainer's Choice", or "HIIT" → Advanced
    2. Contains "Barre 57" (exact, not Express variants unless also matching rule 1), "Recovery", or "PowerCycle" → Beginner
    3. Everything else → Intermediate
  - **Class**: color/group by exact `class_name` instead of format family (reuses existing `timelineColor`/legend plumbing, new grouping key only).

## 2. Chatbot add/swap — rules + historic performance aware

- `_validate_manual_slot` (app.py:582) already hard-blocks rule violations (trainer active/qualified, location/day/time window, room conflict, daily/weekly hour caps, AM/PM shift lock) on every add/replace path. No change to this gate.
- Add a **quality-gate warning** (new helper, e.g. `_quality_gate_warning(slot, metrics)`) invoked from `_add_class_to_schedule`, `_replace_trainer_in_schedule`, and the `nl_edit_apply` per-edit loop:
  - Looks up `class_trainer_slot_metrics` (same source as `_find_best_fit_trainer`) for the trainer+class(+slot) combo.
  - If avg_checkin < 3.0 or fill_rate < 22%, attach a warning string to the response — does **not** block the edit (manual chat action counts as a pin per CLAUDE.md quality-gate rule).
  - Chat reply surfaces the warning inline, e.g. "⚠ Reshma's history at this slot: 2.1 avg check-in, 18% fill."
- Change `parse_nl_schedule_edit` (chat_assistant.py) BEST_FIT resolution: when an edit's trainer or class is unspecified/BEST_FIT, stop auto-resolving to candidate #1. Instead mark `needs_confirmation: true` and return the existing top-3 ranked candidates (`_find_best_fit_trainer`/`_find_best_fit_class`, already scored on fill/checkin/tier/availability).
  - Frontend (chat panel) renders a small picker for `needs_confirmation` edits — 3 candidate cards with score/reason — user taps one.
  - The picked candidate becomes an explicit edit and goes through the normal apply path (still rule-checked + quality-gate-warned).

## 3. Dark mode fixes

- `.theme-dark` block (app.css:11456+, ~350 rules) has zero coverage for `.cr-*` (class report modal, `renderReport` app.js:8345), and only partial coverage for `.hist-*` (top/bottom performers modal) and `.ml-*` (multi-location grid).
- Add `.theme-dark` overrides for these class families using the existing dark palette vars/pattern already established elsewhere in the block.
- Sweep for any other remaining hardcoded white-bg/black-text spots at implementation time (grep for `background:#fff`, `background:white`, `color:#000`, `color:black` in inline styles and non-`.theme-dark`-covered CSS classes) and fix those too.

## Out of scope

- No changes to the hard rule engine (`_validate_manual_slot`) itself.
- No new data fields added to `rules/class_formats.json` — level is derived at render/grouping time only, not persisted.
- No changes to schedule generation/optimizer (`agents/optimiser.py`) — this is chat-driven manual edit paths only.
