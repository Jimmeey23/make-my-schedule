# Views Restyle, Rule-Aware Chatbot, Dark-Mode Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle trainer/rooms/timeline views (modern SaaS look, new Level/Class timeline groupings), make chatbot add/swap operations warn on weak historic performance and confirm ambiguous trainer/class picks, and fix dark-mode coverage gaps on report/multi-location/top-bottom views.

**Architecture:** Three independent subsystems, each touching a different slice of the stack: (1) `web/app.css` + `web/app.js` for styling/timeline grouping, (2) `app.py` + `chat_assistant.py` for chatbot validation/confirmation logic, (3) `web/app.css` for dark-mode selector coverage. No shared state between them — tasks can be done and verified independently.

**Tech Stack:** Flask backend (`app.py`), vanilla JS frontend (`web/app.js`, no build step — edits are live), pytest for backend tests (`tests/`).

## Global Constraints

- Hard rule engine (`_validate_manual_slot`, app.py:582) is not modified — it already enforces CLAUDE.md's availability/cert/hour-cap/shift-lock rules.
- No new persisted data fields — Level grouping is derived at render time, not stored in `rules/class_formats.json`.
- Quality gate (CLAUDE.md: avg check-in < 3.0 or fill < 22%) on chatbot edits is a **warning**, never a block — manual chat edits count as pins.
- `agents/optimiser.py` (generation pipeline) is out of scope — this plan only touches manual/chat-driven edit paths and view rendering.

---

## Task 1: Timeline Level + Class grouping modes

**Files:**
- Modify: `web/app.js:91-165` (`timelineGroup`, `timelineGroupLabel`, `TIMELINE_GROUP_COLOR`, `_timelineMode`)
- Modify: `web/app.js:1235` (mode toggle buttons)
- Modify: `web/app.js:1238-1293` (`renderTimeline` legend + block rendering)
- Test: manual verification via browser (no JS test harness in this repo for `web/app.js`)

**Interfaces:**
- Produces: `classLevel(className)` — new function returning `"beginner" | "intermediate" | "advanced"`.
- Produces: `_timelineMode` now accepts `"level"` and `"class"` as additional values alongside existing `"format" | "fill" | "trainer" | "density"`.

- [ ] **Step 1: Add `classLevel()` helper near `timelineGroup()` (app.js:91)**

```javascript
function classLevel(cn){
  const n=(cn||"").toLowerCase();
  if(/strength lab|amped up|trainer'?s choice|hiit/.test(n))return"advanced";
  if(/barre 57|recovery|powercycle/.test(n))return"beginner";
  return"intermediate";
}
const LEVEL_LABEL={beginner:"Beginner",intermediate:"Intermediate",advanced:"Advanced"};
const LEVEL_COLOR={beginner:"#22C55E",intermediate:"#F59E0B",advanced:"#EF4444"};
```

Note: the regex checks advanced-tier keywords first, so e.g. a hypothetical "Strength Lab Barre 57" combo class would resolve to advanced, not beginner — matches the priority order agreed in the spec.

- [ ] **Step 2: Verify helper against known class names**

Run in browser console on the app page (after Step 1 is saved and page reloaded):

```javascript
["Studio Barre 57","Studio PowerCycle","Studio Recovery","Studio Strength Lab (Push)","Studio Amped Up!","Studio Trainer's Choice","Studio FIT","Studio Mat 57","Studio Back Body Blaze","Studio Cardio Barre Plus"].map(n=>[n,classLevel(n)])
```

Expected output: Barre 57/PowerCycle/Recovery → `beginner`; Strength Lab/Amped Up!/Trainer's Choice → `advanced`; FIT/Mat 57/Back Body Blaze/Cardio Barre Plus → `intermediate`.

- [ ] **Step 3: Add "Level" and "Class" buttons to the timeline mode toggle (app.js:1235)**

Find:
```javascript
    ${[["format","Format"],["fill","Fill"],["trainer","Trainer"],["density","Density"]].map(([k,l])=>`<button class="tl-mode-btn ${_timelineMode===k?"active":""}" onclick="setTimelineMode('${k}')">${l}</button>`).join("")}
```

Replace with:
```javascript
    ${[["format","Format"],["level","Level"],["class","Class"],["fill","Fill"],["trainer","Trainer"],["density","Density"]].map(([k,l])=>`<button class="tl-mode-btn ${_timelineMode===k?"active":""}" onclick="setTimelineMode('${k}')">${l}</button>`).join("")}
```

- [ ] **Step 4: Wire legend + block color/label for the new modes (app.js:1238-1293)**

Find the legend label line:
```javascript
  legEl.insertAdjacentHTML("beforeend",`<span class="tl-legend-label">${_timelineMode==="fill"?"Fill Bands":_timelineMode==="trainer"?"Trainer Load":"Format Groups"}</span>`);
```

Replace with:
```javascript
  legEl.insertAdjacentHTML("beforeend",`<span class="tl-legend-label">${_timelineMode==="fill"?"Fill Bands":_timelineMode==="trainer"?"Trainer Load":_timelineMode==="level"?"Class Level":_timelineMode==="class"?"Class Name":"Format Groups"}</span>`);
```

Find the legend items line:
```javascript
  const legendItems=_timelineMode==="fill"
    ...
    : visibleGroups.map(g=>[timelineGroupLabel(g),TIMELINE_GROUP_COLOR[g]||TIMELINE_GROUP_COLOR.full]);
```

Replace the trailing branch (keep the `_timelineMode==="fill"` branch as-is) with:

```javascript
  const visibleLevels=[...new Set(filtered.map(s=>classLevel(s.class_name)))].sort();
  const visibleClasses=[...new Set(filtered.map(s=>s.class_name).filter(Boolean))].sort();
  const legendItems=_timelineMode==="fill"
    ? [[0,.22,'#EF4444'],[.22,.45,'#F59E0B'],[.45,.7,'#3B82F6'],[.7,1,'#22C55E']].map(([a,b,c])=>[`${Math.round(a*100)}–${Math.round(b*100)}%`,c])
    : _timelineMode==="level"
    ? visibleLevels.map(l=>[LEVEL_LABEL[l],LEVEL_COLOR[l]])
    : _timelineMode==="class"
    ? visibleClasses.map(c=>[shortClass(c),timelineColor({class_name:c})])
    : visibleGroups.map(g=>[timelineGroupLabel(g),TIMELINE_GROUP_COLOR[g]||TIMELINE_GROUP_COLOR.full]);
```

(Keep whatever the existing fill-band legend literal was — copy it from the current file rather than retyping if it differs; the array above documents intent only.)

Find the block color assignment:
```javascript
      const clsCol=_timelineMode==="fill"?fillColor(s.predicted_fill_rate||0):timelineColor(s);
```

Replace with:
```javascript
      const clsCol=_timelineMode==="fill"?fillColor(s.predicted_fill_rate||0):_timelineMode==="level"?LEVEL_COLOR[classLevel(s.class_name)]:_timelineMode==="class"?timelineColor({class_name:s.class_name}):timelineColor(s);
```

Find the block label assignment:
```javascript
        const label=_timelineMode==="trainer"?(s.trainer_1||"—").split(" ").pop():shortClass(s.class_name);
```

Replace with:
```javascript
        const label=_timelineMode==="trainer"?(s.trainer_1||"—").split(" ").pop():_timelineMode==="level"?LEVEL_LABEL[classLevel(s.class_name)]:shortClass(s.class_name);
```

- [ ] **Step 5: Manual verification**

Start the app (`python app.py` or existing run command), open Timeline view, click "Level" — blocks recolor by beginner/intermediate/advanced with a 3-item legend. Click "Class" — blocks recolor per distinct class name with a legend listing every class in view. Click back to "Format" — original behavior unchanged.

- [ ] **Step 6: Commit**

```bash
git add web/app.js
git commit -m "feat: add Level and Class grouping modes to timeline view"
```

---

## Task 2: Modern-SaaS restyle of Timeline/Rooms/Trainer views + dark-mode-safe container

**Files:**
- Modify: `web/app.js:1390` (`.room-timeline-outer` inline style)
- Modify: `web/app.css` (add/extend classes for timeline/rooms/trainer card styling; add `.theme-dark` coverage for any new classes)
- Test: manual verification via browser in light and dark mode

**Interfaces:**
- Consumes: `.theme-dark` selector pattern already established at app.css:11456+.
- Produces: no new function signatures — CSS-only + one inline-style-to-class change.

- [ ] **Step 1: Replace hardcoded inline background on the rooms/timeline outer container**

In `web/app.js:1390`, find:
```javascript
    <div class="room-timeline-outer" style="background:#fff;border-radius:18px;border:1px solid #DCE3EB;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,.06)">
```

Replace with:
```javascript
    <div class="room-timeline-outer">
```

- [ ] **Step 2: Add the extracted styles as a real CSS class in `web/app.css`**

Append near the existing `.room-timeline-container` rules (search for `.room-timeline-container` to find the right spot):

```css
.room-timeline-outer{
  background:var(--card-bg,#fff);
  border-radius:18px;
  border:1px solid var(--border-soft,#DCE3EB);
  overflow:hidden;
  box-shadow:0 8px 32px rgba(15,23,42,.06);
}
.theme-dark .room-timeline-outer{
  background:var(--card-bg,#1e2530);
  border-color:var(--border-soft,#2c3340);
  box-shadow:0 8px 32px rgba(0,0,0,.35);
}
```

Check first whether `--card-bg` and `--border-soft` already exist as variable names in the `.theme-dark` block (grep `--card-bg` in `web/app.css`) — if the codebase uses different variable names, use those instead of introducing new ones, so this container matches every other themed panel exactly.

- [ ] **Step 3: Apply modern-SaaS elevation/spacing pass to timeline/rooms/trainer card classes**

Grep for the block/card classes used in Timeline (`.tl-block` or similar, search `renderTimeline` in app.js for the class name emitted per slot), Rooms (`.room-cell`, `.room-col`), and Trainer view (search `plannerViewHeader` callers for the trainer-specific view class). For each, increase `border-radius` to at least `10px`, add a subtle `box-shadow` consistent with `.room-timeline-outer` above (`0 2px 8px rgba(15,23,42,.06)` for resting state, slightly stronger on `:hover`), and ensure padding gives blocks visible breathing room (min `6px 8px`). Keep existing color logic (format/fill/trainer/level/class colors from Task 1) untouched — this step only changes shadow/radius/spacing, not colors.

- [ ] **Step 4: Manual verification**

Reload the app, check Timeline, Rooms, and Trainer views in both light mode and dark mode (toggle via existing theme switch). Confirm: no visible pure-white boxes in dark mode, cards have visible shadow/elevation, hover states still work, no layout overflow introduced by the padding/radius changes.

- [ ] **Step 5: Commit**

```bash
git add web/app.js web/app.css
git commit -m "style: modernize timeline/rooms/trainer view cards, fix dark-mode background on rooms outer"
```

---

## Task 3: Dark-mode coverage for report / multi-location / top-bottom views

**Files:**
- Modify: `web/app.css` (extend `.theme-dark` block, currently starting app.css:11456)
- Test: manual verification via browser in dark mode

**Interfaces:**
- Consumes: existing `.theme-dark` dark palette variables already defined in the block (reuse them — do not invent a second palette).

- [ ] **Step 1: Grep for the exact class names used in the three flagged views**

```bash
grep -n "class=\"cr-" web/app.js | head -30
grep -n "class=\"hist-" web/app.js | head -30
grep -n "class=\"ml-" web/app.js | head -30
```

Note every distinct class name found — these are the selectors that need `.theme-dark` coverage.

- [ ] **Step 2: Add `.theme-dark .cr-*` overrides (class report modal, `renderReport`, app.js:8345)**

For each class name found in Step 1 under `cr-` (e.g. `.cr-modal`, `.cr-modal-body`, `.cr-modal-head`, table/row classes inside it), add a `.theme-dark .cr-X { background: ...; color: ...; border-color: ...; }` rule to the `.theme-dark` block, using the same dark background/text/border variable values already used by sibling overrides like `.theme-dark .filter-panel` (app.css:11502) or `.theme-dark .hist-modal-tabs` if present. Pay particular attention to any table `th`/`td` — these are the most common source of "black text on dark bg" since table styles are often set independently of card backgrounds.

- [ ] **Step 3: Extend `.theme-dark .hist-*` overrides (top/bottom performers modal)**

Compare the full list of `.hist-*` classes from Step 1 against what already has `.theme-dark` coverage (`grep -n "theme-dark .hist" web/app.css`). Add overrides for any missing ones, following the same pattern as Step 2.

- [ ] **Step 4: Extend `.theme-dark .ml-*` overrides (multi-location grid)**

Same process: diff the full `.ml-*` class list against existing `.theme-dark .ml-*` coverage, add missing overrides.

- [ ] **Step 5: Sweep for remaining hardcoded light-only colors**

```bash
grep -n 'background:#fff\|background: #fff\|background:white\|background: white' web/app.css | grep -v "theme-dark"
grep -n 'color:#000\|color: #000\|color:black\|color: black' web/app.css
grep -n 'style="[^"]*background:#fff\|style="[^"]*color:#000' web/app.js
```

For any hit found inside a class that appears in a view the user flagged (report, multi-location, top/bottom, "and a few other views" — check any other modal/panel classes rendered site-wide, e.g. settings/config panels), add the corresponding `.theme-dark` override rather than editing the base rule (keep light mode unchanged).

- [ ] **Step 6: Manual verification**

Reload the app, switch to dark mode, open: the class report modal, the multi-location view, and the top/bottom performers modal (search UI for how it's triggered — likely a button near histogram/leaderboard). Confirm no white panels or black-on-dark text remain. Also spot-check any other modal encountered during the sweep in Step 5.

- [ ] **Step 7: Commit**

```bash
git add web/app.css
git commit -m "fix: add dark-mode coverage for class report, multi-location, and top/bottom performer views"
```

---

## Task 4: Quality-gate warning on chatbot add/swap/replace

**Files:**
- Modify: `app.py` (new helper `_quality_gate_warning`, hook into `_add_class_to_schedule` (app.py:691), `_replace_trainer_in_schedule` (app.py:643), and `/api/nl-edit-apply` (app.py:1479))
- Test: `tests/test_schedule_quality.py` (append new tests) or a new `tests/test_quality_gate_warning.py` if that file is reserved for generation-pipeline tests only — check its imports first; if it imports from `agents.*` only (not `app`), create the new file instead.

**Interfaces:**
- Produces: `_quality_gate_warning(slot: dict, metrics: dict) -> str | None` in `app.py` — returns a human-readable warning string or `None` if the trainer/class/slot combo has no weak-history match.
- Produces: `_add_class_to_schedule` and `_replace_trainer_in_schedule` now return `(result, warning)` tuples instead of bare results — every call site must be updated to unpack.

- [ ] **Step 1: Check `tests/test_schedule_quality.py` imports to decide test file placement**

```bash
head -20 tests/test_schedule_quality.py
```

If it imports from `app` (Flask app module), append tests there. If it only imports from `agents.*`/`orchestrator`, create `tests/test_quality_gate_warning.py` with a matching `from app import ...` import style used by other app-level tests (check `tests/test_replace_trainer_modal.py` for the pattern, since it also exercises app.py's schedule-editing functions).

- [ ] **Step 2: Write the failing test for `_quality_gate_warning`**

```python
def test_quality_gate_warning_flags_low_checkin_history():
    from app import _quality_gate_warning
    slot = {
        "location": "Kwality House, Kemps Corner",
        "day_of_week": "Monday",
        "time": "18:00",
        "class_name": "Studio Cardio Barre",
        "trainer_1": "Reshma Sharma",
    }
    metrics = {
        "class_trainer_slot_metrics": [
            {
                "location": "Kwality House, Kemps Corner",
                "day": 0,
                "time": "18:00",
                "class": "Studio Cardio Barre",
                "trainer": "Reshma Sharma",
                "avg_fill_rate": 0.18,
                "avg_checkin": 2.1,
                "session_count": 8,
            }
        ]
    }
    warning = _quality_gate_warning(slot, metrics)
    assert warning is not None
    assert "Reshma Sharma" in warning
    assert "2.1" in warning


def test_quality_gate_warning_silent_for_strong_history():
    from app import _quality_gate_warning
    slot = {
        "location": "Kwality House, Kemps Corner",
        "day_of_week": "Monday",
        "time": "18:00",
        "class_name": "Studio Cardio Barre",
        "trainer_1": "Reshma Sharma",
    }
    metrics = {
        "class_trainer_slot_metrics": [
            {
                "location": "Kwality House, Kemps Corner",
                "day": 0,
                "time": "18:00",
                "class": "Studio Cardio Barre",
                "trainer": "Reshma Sharma",
                "avg_fill_rate": 0.55,
                "avg_checkin": 8.4,
                "session_count": 12,
            }
        ]
    }
    assert _quality_gate_warning(slot, metrics) is None


def test_quality_gate_warning_silent_when_no_history():
    from app import _quality_gate_warning
    slot = {
        "location": "Kwality House, Kemps Corner",
        "day_of_week": "Monday",
        "time": "18:00",
        "class_name": "Studio Cardio Barre",
        "trainer_1": "Brand New Trainer",
    }
    assert _quality_gate_warning(slot, {"class_trainer_slot_metrics": []}) is None
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
pytest tests/test_schedule_quality.py -k quality_gate_warning -v
```

Expected: FAIL with `ImportError: cannot import name '_quality_gate_warning'` (or `AttributeError`).

- [ ] **Step 4: Implement `_quality_gate_warning` in `app.py`, near `_validate_manual_slot` (app.py:582)**

```python
_DAY_TO_INT = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}


def _quality_gate_warning(slot, metrics):
    """Return a warning string if slot's trainer+class+day+time has a proven weak history, else None."""
    trainer = (slot.get("trainer_1") or "").strip()
    class_name = (slot.get("class_name") or "").strip()
    location = slot.get("location") or ""
    day_int = _DAY_TO_INT.get((slot.get("day_of_week") or "").strip().lower(), -1)
    time_str = slot.get("time") or ""
    if not trainer or not class_name:
        return None

    rows = (metrics or {}).get("class_trainer_slot_metrics") or []
    match = None
    for row in rows:
        if row.get("trainer") != trainer:
            continue
        if row.get("class") != class_name:
            continue
        if row.get("location") and row.get("location") != location:
            continue
        if day_int >= 0 and row.get("day") is not None and row.get("day") != day_int:
            continue
        if time_str and row.get("time") and row.get("time") != time_str:
            continue
        match = row
        break

    if not match:
        return None

    fill = match.get("avg_fill_rate", 0.0) or 0.0
    checkin = match.get("avg_checkin", 0.0) or 0.0
    if checkin < 3.0 or fill < 0.22:
        return (
            f"⚠ {trainer}'s history with {class_name} at this slot: "
            f"{checkin:.1f} avg check-in, {round(fill * 100)}% fill — below quality-gate thresholds. "
            "Applied anyway since this is a manual edit."
        )
    return None
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pytest tests/test_schedule_quality.py -k quality_gate_warning -v
```

Expected: 3 passed.

- [ ] **Step 6: Hook the warning into `_add_class_to_schedule` (app.py:691) and its callers**

Find the end of `_add_class_to_schedule`, after `_validate_manual_slot(data, iteration, slot)` (app.py:707) and the rows-append logic that follows it — locate the function's `return` statement(s) by reading app.py:691-720. Load the metrics file the same way `_find_best_fit_trainer` does (check chat_assistant.py's `_load_json`/metrics path usage, and reuse `OUTPUTS_DIR / "scorecard.json"` — already used elsewhere in app.py at line 217/1473) and compute the warning right before returning:

```python
    from chat_assistant import _load_json as _cl_load_json
    metrics = _cl_load_json(OUTPUTS_DIR / "scorecard.json", {})
    warning = _quality_gate_warning(slot, metrics)
```

Change the function's return value to `return slot, warning` (confirm what it currently returns by reading the full function body first — adapt this step to wrap whatever the existing return expression is into a tuple `(existing_return, warning)`).

Update every call site of `_add_class_to_schedule` (grep `_add_class_to_schedule(` across `app.py`) to unpack the tuple, e.g.:
```python
result, warning = _add_class_to_schedule(payload)
response = {"ok": True, "result": result}
if warning:
    response["warning"] = warning
return _json(response)
```

- [ ] **Step 7: Hook the warning into `_replace_trainer_in_schedule` (app.py:643) and its callers**

Same pattern as Step 6: after the existing validation/update logic (app.py:661-687), compute `warning = _quality_gate_warning(new_slot, metrics)` using the same metrics-loading line, change the return to `return updated, warning`, and update all call sites (grep `_replace_trainer_in_schedule(`) to unpack and surface `warning` in their JSON response the same way.

- [ ] **Step 8: Hook the warning into `/api/nl-edit-apply` (app.py:1479)**

In the `nl_edit_apply` view function's edit-processing loop (app.py:1479-1543), after each successful `_add_class_to_schedule(...)` or `_replace_trainer_in_schedule(...)` call, collect the returned warning into a `warnings` list alongside the existing `errors` list, and include it in the final response:
```python
return _json({"applied": applied, "errors": errors, "warnings": warnings})
```

- [ ] **Step 9: Run the full backend test suite to confirm no regressions from the tuple-return change**

```bash
pytest tests/ -v
```

Expected: all tests pass (any pre-existing failures unrelated to this change should be the same before/after — compare against a baseline run if unsure).

- [ ] **Step 10: Commit**

```bash
git add app.py tests/
git commit -m "feat: warn on chatbot add/swap edits with proven weak historic performance"
```

---

## Task 5: Ambiguous trainer/class picks require confirmation, not silent auto-apply

**Files:**
- Modify: `chat_assistant.py:1060-1087` (`parse_nl_schedule_edit` BEST_FIT enrichment block)
- Modify: `web/app.js` (chat panel rendering — find where `/api/nl-edit` response is rendered, search for `nl-edit` or `nl_edit` calls in app.js)
- Test: `tests/test_ai_provider.py` or a new `tests/test_nl_edit_confirmation.py` — check which existing test file already covers `parse_nl_schedule_edit` (grep `parse_nl_schedule_edit` in `tests/`) and add to that one; if none, create `tests/test_nl_edit_confirmation.py`.

**Interfaces:**
- Consumes: `_find_best_fit_trainer`/`_find_best_fit_class` (chat_assistant.py, unchanged signatures) — already return ranked candidate lists.
- Produces: `parse_nl_schedule_edit`'s returned `edits[]` entries now include `"needs_confirmation": true` when a BEST_FIT was requested, instead of auto-filling `new_trainer`/`new_class` with the top candidate's name.

- [ ] **Step 1: Find and read existing tests for `parse_nl_schedule_edit`**

```bash
grep -rn "parse_nl_schedule_edit" tests/
```

Read the matching file to learn the existing mocking pattern for `client` (the AI chat client) before writing new tests — reuse that pattern exactly.

- [ ] **Step 2: Write the failing test for confirmation-required behavior**

Using whatever mock-client pattern Step 1 revealed, write (adapt the mock setup to match that pattern — this shows the assertion, not a full duplicate mock harness):

```python
def test_best_fit_trainer_edit_requires_confirmation(monkeypatch):
    from chat_assistant import parse_nl_schedule_edit

    # Reuse this test file's existing mock-client fixture/pattern to make the
    # LLM call return an edit with new_trainer == "BEST_FIT".
    ...

    result = parse_nl_schedule_edit(
        "add a class Tuesday 6pm at Kwality House",
        {"locations": {"Kwality House, Kemps Corner": []}},
        {"location": "Kwality House, Kemps Corner", "week": "2026-W20"},
        mock_client,
        "gpt-4",
        metrics_path,
        profiles_path,
    )
    edit = result["edits"][0]
    assert edit["needs_confirmation"] is True
    assert len(edit["best_fit_trainer_candidates"]) > 0
    # Auto-fill must NOT happen anymore:
    assert edit["new_trainer"] == "BEST_FIT"
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pytest tests/test_nl_edit_confirmation.py -v
```

Expected: FAIL — `edit["needs_confirmation"]` raises `KeyError` (current code doesn't set this key).

- [ ] **Step 4: Update the BEST_FIT enrichment block in `chat_assistant.py:1060-1087`**

Find:
```python
            if edit.get("new_trainer") == "BEST_FIT":
                candidates = _find_best_fit_trainer(
                    edit_loc, edit_day, edit_time, edit_class,
                    metrics_path, profiles_path,
                )
                edit["new_trainer"] = candidates[0]["name"] if candidates else ""
                edit["best_fit_trainer_candidates"] = candidates
                edit["best_fit_type"] = "trainer"

            if edit.get("new_class") == "BEST_FIT":
                candidates = _find_best_fit_class(
                    edit_loc, edit_day, edit_time, edit_trainer,
                    metrics_path,
                )
                edit["new_class"] = candidates[0]["name"] if candidates else ""
                edit["best_fit_class_candidates"] = candidates
                edit["best_fit_type"] = "class"
```

Replace with:
```python
            if edit.get("new_trainer") == "BEST_FIT":
                candidates = _find_best_fit_trainer(
                    edit_loc, edit_day, edit_time, edit_class,
                    metrics_path, profiles_path,
                )
                edit["best_fit_trainer_candidates"] = candidates
                edit["best_fit_type"] = "trainer"
                edit["needs_confirmation"] = True

            if edit.get("new_class") == "BEST_FIT":
                candidates = _find_best_fit_class(
                    edit_loc, edit_day, edit_time, edit_trainer,
                    metrics_path,
                )
                edit["best_fit_class_candidates"] = candidates
                edit["best_fit_type"] = "class"
                edit["needs_confirmation"] = True
```

Note `new_trainer`/`new_class` are deliberately left as the literal string `"BEST_FIT"` — the frontend must never submit an edit for apply while that sentinel is still present; it must be replaced with the user's picked candidate name first (Step 6).

- [ ] **Step 5: Run the test to verify it passes**

```bash
pytest tests/test_nl_edit_confirmation.py -v
```

Expected: PASS.

- [ ] **Step 6: Update the chat panel frontend to render a confirmation picker**

```bash
grep -n "nl-edit\|nl_edit\|needs_confirmation" web/app.js
```

Find where the `/api/nl-edit` response's `edits` array is rendered into the chat UI (before being sent to `/api/nl-edit-apply`). For each edit where `edit.needs_confirmation` is true, render up to 3 candidate buttons from `edit.best_fit_trainer_candidates` (or `best_fit_class_candidates`), each showing the candidate's `name`, `avg_fill_rate`, `avg_checkin`, and `reason` (all already present in the candidate objects per chat_assistant.py:862-871). On click, set the edit's `new_trainer` (or `new_class`) to the chosen candidate's `name`, clear `needs_confirmation`, and only then allow that edit to be included in the payload sent to `/api/nl-edit-apply`. Do not render an "Apply" action for any edit still carrying `needs_confirmation: true` or the literal string `"BEST_FIT"` in `new_trainer`/`new_class`.

- [ ] **Step 7: Manual verification**

In the running app, use the chat panel to type an add/swap instruction that omits the trainer or class (e.g. "add a class Tuesday 6pm at Kwality House" or "find the best sub for Monday's 8am Barre"). Confirm the reply shows a 3-candidate picker with scores/reasons instead of silently applying, and that clicking a candidate applies that specific choice.

- [ ] **Step 8: Commit**

```bash
git add chat_assistant.py web/app.js tests/
git commit -m "feat: require user confirmation for ambiguous chatbot trainer/class picks"
```

---

## Self-Review Notes

- Spec coverage: Section 1 (styling+grouping) → Tasks 1-2. Section 2 (chatbot rules+history) → Tasks 4-5 (hard rules already covered by existing `_validate_manual_slot`, explicitly left unchanged per Global Constraints). Section 3 (dark mode) → Task 3.
- Tasks 4 and 5 change function return signatures (`_add_class_to_schedule`, `_replace_trainer_in_schedule` now return tuples) — every existing call site must be updated in the same task, not deferred, to avoid leaving the app in a broken intermediate state. Task 4 Steps 6-7 explicitly call out re-grepping and updating all call sites.
- Tasks 1-3 (frontend/CSS) have no existing automated test harness for `web/app.js`/`web/app.css` in this repo — verification is manual/browser-based by design, consistent with how the rest of the frontend is tested in this codebase.

---

## Task 6 (added post-merge-review, user-approved): Port quality-gate + confirmation-required flow to serve.py

**Context:** The final whole-branch review found `serve.py` (the entrypoint `npm run dev` actually launches, per `package.json`) has its own independent, duplicate implementation of the add/swap/NL-edit flow (`_add_class_to_schedule` serve.py:1547, `_replace_trainer_in_schedule` serve.py:1496, `_change_class_in_schedule` serve.py:2131, `_nl_edit_plan` serve.py:1855, `_nl_edit_apply` serve.py:2182, `_find_trainer_candidates` serve.py:2064) that predates and is untouched by Tasks 4-5's app.py/chat_assistant.py work. It has none of the quality-gate warning or confirmation-required-picks behavior, and its `_add_class_to_schedule` (serve.py:1554-1565) silently auto-picks an arbitrary trainer (`cands[0]` or hardcoded `"Karanvir Bhatia"`) whenever the trainer is unspecified — exactly the silent-auto-apply behavior the whole project was meant to eliminate. User explicitly approved porting the same fixes here after being told about the gap.

**Files:**
- Modify: `serve.py` (`_nl_edit_plan`, `_nl_edit_apply`, `_add_class_to_schedule`, `_replace_trainer_in_schedule`, `_change_class_in_schedule`, `_find_trainer_candidates`)
- Test: `tests/test_schedule_quality.py` or a new `tests/test_serve_quality_gate.py` — check existing test file imports first, same approach as Task 4's Step 1.

**Interfaces:**
- Produces: `_quality_gate_warning(slot, metrics)` in serve.py — same signature and threshold logic as app.py's (avg_checkin < 3.0 or fill < 0.22), but sourced from `state/02_metrics.json`'s `class_trainer_slot_metrics` (same file app.py now correctly uses — NOT `trainer_profiles.json`'s `loc_data.avg_checkin`/`avg_fill_rate`, since `avg_fill_rate` does not exist in `rules/trainer_profiles.json` today and would always read as 0).
- `_add_class_to_schedule`, `_replace_trainer_in_schedule`, `_change_class_in_schedule` now return `(result, warning)` tuples, mirroring app.py's Task 4 change — every call site in serve.py must be updated in the same commit (grep all three function names across the whole file first).

- [ ] **Step 1: Add `_quality_gate_warning` to serve.py, plus a `METRICS_PATH` constant**

Add near the top of serve.py (wherever other path constants like `WEB_DIR`/`PROJECT_ROOT` are defined):
```python
METRICS_PATH = PROJECT_ROOT / "state" / "02_metrics.json"
```
(If `PROJECT_ROOT` isn't already defined in serve.py under that exact name, find whatever serve.py already calls its project-root path constant and use that instead — do not introduce a second, differently-named root constant.)

Add the same `_quality_gate_warning` function serve.py needs — same logic as app.py's (session-count floor >= 3, exact-match-preferred, avg_checkin < 3.0 or fill < 0.22 → warning string, else None) — either by duplicating the function body (consistent with how this file already duplicates everything from app.py) or, if serve.py already imports anything from app.py elsewhere (check first — it likely doesn't, these are meant to run standalone), duplicate it. Load metrics via `json.loads(METRICS_PATH.read_text())` guarded by try/except returning `{}` on failure, consistent with serve.py's existing defensive-try/except style seen throughout this file.

- [ ] **Step 2: Remove the silent arbitrary-trainer auto-pick in `_add_class_to_schedule` (serve.py:1554-1565)**

Find:
```python
    if not slot.get("trainer_1") or str(slot.get("trainer_1")).upper() == "BEST_FIT":
        cands = _find_trainer_candidates(
            day=slot["day_of_week"], location=slot["location"],
            class_name=slot["class_name"], profiles=[], time_str=slot["time"]
        )
        if cands:
            slot["trainer_1"] = cands[0]["name"]
        else:
            known_tr = _load_known_trainers()
            slot["trainer_1"] = known_tr[0] if known_tr else "Karanvir Bhatia"
```

Replace with a hard requirement — if the caller (now `_nl_edit_apply`, after Step 4's guard) ever reaches this function without a real trainer name, that's a bug upstream, not something to silently paper over:
```python
    if not slot.get("trainer_1") or str(slot.get("trainer_1")).upper() == "BEST_FIT":
        raise ValueError("A specific trainer must be chosen before this class can be added")
```

- [ ] **Step 3: Wire `_quality_gate_warning` into `_add_class_to_schedule`, `_replace_trainer_in_schedule`, `_change_class_in_schedule`**

For each of the three functions, after the existing write (`_write_schedule_data(data)` / `supabase_saved = _write_schedule_data(data)`) and before the `return`, compute:
```python
    metrics = {}
    try:
        metrics = json.loads(METRICS_PATH.read_text())
    except Exception:
        pass
    warning = _quality_gate_warning(slot if 'slot' in dir() else new_slot, metrics)
```
(Use whichever local variable name — `slot`, `new_slot` — actually holds the final applied slot in that specific function; read the function body first, don't guess.) Change each function's return to include the warning, e.g. `_add_class_to_schedule` currently returns `{"added": 1, "supabase_saved": supabase_saved}` → add `"warning": warning` to that dict (only meaningful if not None — either always include the key with a possibly-`None` value, or only add it when truthy, matching whatever style app.py's Task 4 used). `_replace_trainer_in_schedule` currently returns `updated` (a bare int) — change to return `(updated, warning)` tuple, matching app.py's approach exactly. `_change_class_in_schedule` currently returns `{"updated": updated}` — add `"warning": warning` to that dict.

- [ ] **Step 4: Update every call site of the three changed functions**

Grep `_add_class_to_schedule(`, `_replace_trainer_in_schedule(`, `_change_class_in_schedule(` across the whole of `serve.py` (not just the definitions) and update every caller to handle the new return shape:
- The two dict-returning functions (`_add_class_to_schedule`, `_change_class_in_schedule`) just gained a key — no unpacking changes needed at call sites, but any caller that surfaces the result as JSON (the `/api/add-class`, `/api/add-classes` HTTP handlers, and any caller inside `_nl_edit_apply`) should pass the `warning` key through to its own returned/response dict so it reaches the frontend (which already reads `data.warning` on `/api/add-class` responses per the earlier fix wave).
- `_replace_trainer_in_schedule` now returns a tuple — every caller (the `/api/replace-trainer` HTTP handler, and the `swap_trainer`/`replace_trainer` branch inside `_nl_edit_apply`) must unpack `updated, warning = _replace_trainer_in_schedule(...)` and thread `warning` into its own response/error-collection the same way app.py's Task 4 threaded it into `/api/replace-trainer`'s JSON response and `nl_edit_apply`'s `warnings` list.

- [ ] **Step 5: Give `_nl_edit_plan` and `_nl_edit_apply` the same confirmation-required semantics as chat_assistant.py/app.py**

In `_nl_edit_plan`'s post-processing loop (serve.py:2018-2029, the "Generate server-side best_fit_trainer_candidates for add/swap actions" block): after computing `candidates`, set `edit["needs_confirmation"] = bool(candidates) if not requested_trainer else False` — i.e. only require confirmation when the trainer truly wasn't specified by the user AND there's something to confirm from. If `not requested_trainer and not candidates`, also add a message to the edit (e.g. `edit["no_candidate_note"] = "No historic candidates found for this slot — please name a trainer explicitly."`) so the frontend's existing empty-candidates handling (already built in the earlier fix wave, in `web/app.js`'s `nlEditRender`) has something to show — check what field name that existing frontend code actually reads for this message and match it exactly rather than inventing a new field name.

In `_nl_edit_apply`'s edit-processing loop (serve.py: inside `_nl_edit_apply`, before the `try:` block that dispatches on `action`): add the same server-side guard as app.py's Important-8 fix — skip (append to `errors`, `continue`) any edit where `edit.get("needs_confirmation")` is true. (serve.py doesn't use a `"BEST_FIT"` string sentinel the way chat_assistant.py does — it represents "unspecified" as an empty string — so the guard here only needs the `needs_confirmation` check, not a sentinel-string check.)

Also change `_nl_edit_apply`'s return to include a `warnings` list (currently `{"applied": applied, "errors": errors}`) — append any warning returned by `_add_class_to_schedule`/`_replace_trainer_in_schedule`/`_change_class_in_schedule` calls made inside the loop.

- [ ] **Step 6: Verification**

No automated test harness exists for serve.py's HTTP layer in this repo (confirm by checking `tests/` for any `import serve` or `from serve import` — if none exist, write function-level tests calling `_quality_gate_warning`, `_add_class_to_schedule`, `_nl_edit_apply` directly, following whatever pattern `tests/test_replace_trainer_modal.py` or Task 4's tests used for app.py's equivalent functions). At minimum, add tests mirroring Task 4's three `_quality_gate_warning` cases (weak history warns, strong history silent, no history silent) against serve.py's copy, and one test confirming `_add_class_to_schedule` now raises `ValueError` when `trainer_1` is blank or `"BEST_FIT"` (replacing the old silent-fallback behavior).

Run `python3 -m pytest tests/ -q` — expect the same baseline as the rest of this branch (all passing except the one pre-existing unrelated failure), plus your new tests passing. Run `python3 -c "import serve"` to catch import/syntax errors (this may fail on missing optional dependencies unrelated to your change — any `NameError`/`SyntaxError` from your own edits is what matters).

- [ ] **Step 7: Commit**

```bash
git add serve.py tests/
git commit -m "feat: port quality-gate warning and confirmation-required picks to serve.py"
```
