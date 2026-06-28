# Advanced Configurator — Design Spec
**Date:** 2026-06-28  
**Status:** Approved

## Overview

Replace the existing `renderSettingsView()` tab with a full-page split-pane configurator. No new backend routes. All saves use existing APIs: `/api/save-schedule-config`, `/api/save-trainer-profiles`, `/api/save-rules`.

## Files

| File | Role |
|---|---|
| `web/configurator.js` | All configurator logic (new, self-contained) |
| `web/configurator.css` | Configurator styles (new) |
| `web/index.html` | Add `<script>` + `<link>` for new files |
| `web/app.js` | `renderSettingsView()` delegates to `renderConfigurator(area)` |

## Layout

```
┌─ App header (existing) ──────────────────────────────────┐
├─────────────┬────────────────────────────────────────────┤
│  LEFT RAIL  │  BULK TOOLBAR (slides in on multi-select)  │
│  (220px)    ├────────────────────────────────────────────┤
│             │                                            │
│  PEOPLE ▾   │         MAIN CONTENT PANEL                 │
│  · Trainers │  (tables / grids / forms)                  │
│  · Certifs  │                                            │
│  · Avail.   │                                            │
│  · Leave    │                                            │
│             │                                            │
│  SCHEDULE ▾ │                                            │
│  · Targets  │                                            │
│  · Class Mix│                                            │
│  · Formats  │                                            │
│             │                                            │
│  RULES ▾    │                                            │
│  · Custom   │                                            │
│  · Pins     │                                            │
│             │                                            │
│  SYSTEM ▾   │                                            │
│  · AI Config│                                            │
│  · Quality  │                                            │
│  · Locations│                                            │
└─────────────┴────────────────────────────────────────────┘
```

## Sections

### PEOPLE

**Trainers**
- Table: Name, Tier (1/2/3 badge), Active toggle, Location access pills, Week Off tags
- Inline edit: click tier badge → dropdown; click active → toggle; click location → multi-select popover
- Bulk: select rows → set tier, activate/deactivate, add location access
- Search/filter bar. Import CSV button.

**Certifications**
- Trainer × class format checkbox matrix
- Row = trainer, col = format (abbreviate header)
- Multi-select trainer rows → bulk grant/revoke format
- Filter by format column or trainer name

**Availability**
- Per trainer, per location: available days (day-pill checkboxes), time window (start/end), week off days
- Expand row to see per-location breakdown
- Bulk: copy one trainer's availability pattern to selected others

**Leave & Off Days**
- Table: trainer, type (leave/off-day), date range, note
- Add single or range via date picker
- Bulk add same off-day to multiple trainers

### SCHEDULE

**Daily Targets**
- Location × Day grid (5 locations × 7 days = 35 cells)
- Each cell: [target] / [max] inline edit (two small inputs)
- Select range of cells → apply same target/max
- Copy row (location) to another location
- Weekly floor shown per location (read-only from CLAUDE.md rules)

**Class Mix**
- Location × Format grid
- Each cell: min / max
- Select multiple cells → set values
- "Copy location profile" button: mirror one location's mix to another
- Zero-max formats shown greyed

**Formats**
- List of all class formats with metadata: name, duration, intensity, eligible locations, preferred slots, min/max per week
- Toggle eligible locations per format
- Edit preferred slots inline

### RULES

**Custom Rules**
- Table: ID, type, trainer, location, class, priority (hard/soft), enabled toggle
- Inline add row at bottom
- Bulk: enable/disable selected, delete selected, duplicate to other location/day

**Pins (manual_protected)**
- Table: location, day, time, class, trainer, note, enabled toggle
- Sort by location/day
- Bulk: enable/disable, delete, duplicate to another day
- Quick-add form at top

### SYSTEM

**AI & Generation**
- Provider, model, backup model, API key (masked)
- Scoring weights: sliders for each weight category
- AM/PM policy toggles
- Peak slot configuration

**Quality Gates**
- Avg checkin floor (default 3.0)
- Fill rate floor (default 22%)
- Score floor for acceptance (default 50/100)

**Locations**
- Weekly floor targets (read from CLAUDE.md, editable here)
- Peak time clusters per location (editable list of time strings)
- Location active/inactive toggle

## Bulk Toolbar

Slides down from top of content panel when ≥1 row selected.

```
[✓ 3 selected]  [Set Tier ▾]  [Toggle Active]  [Add Location ▾]  [Grant Cert ▾]  [Delete]  [× Clear]
```

Context-sensitive: shows only actions valid for current section.

## State Model

- Load: fetch `/api/schedule-config` + `/api/trainer-profiles` on mount
- Stage changes in memory: `_cfgDraft` (schedule config) + `_profilesDraft` (trainer profiles)
- Unsaved badge per section in left rail
- "Save All" button (top right) commits both drafts
- Per-section "Save" also available
- No optimistic UI — show spinner, confirm on success

## UX Details

- Inline editing: click cell → contenteditable or input appears, blur → stage change
- Row selection: checkbox column on left, shift-click for range
- Search bar in each section filters rows client-side
- Keyboard: Escape cancels edit, Enter confirms, Tab moves to next cell
- Toast on save success/failure (reuse existing `showToast()`)
