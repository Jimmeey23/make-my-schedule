"""
Post-generation schedule validator.

Single source of truth for hard-rule compliance, checked against the *final*
draft schedule regardless of whether a slot came from the AI planner or the
greedy fallback (agents/optimiser.py only self-checks slots it produces via
`build_constraint_violations`; AI-produced slots are never checked at all).

Usage:
    from agents.schedule_validator import validate_schedule
    report = validate_schedule(schedule_slots)  # list[dict] as in 05_draft_schedule.json
"""
import json
from pathlib import Path
from typing import Dict, List, Optional
from collections import defaultdict

RULES_DIR = Path("rules")
CONFIG_DIR = Path("config")

DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

MIN_CLASS_START_MIN = 7 * 60
BLOCKED_MIDDAY_START_MIN = 13 * 60
BLOCKED_MIDDAY_END_MIN = 15 * 60
MAX_CLASS_START_MIN = 20 * 60 + 30
SUNDAY_MIN_START_MIN = 10 * 60

BENGALURU_LOCATIONS = {"Kenkere House", "Copper & Cloves"}
KWALITY_LOCATION = "Kwality House, Kemps Corner"

# Fallback defaults if config/schedule_config.json settings_options is missing keys.
DEFAULT_MAX_DAILY_MINUTES = 4 * 60
DEFAULT_LOCATION_WEEKLY_FLOORS = {
    "Kwality House, Kemps Corner": 70,
    "Supreme HQ, Bandra": 65,
    "Kenkere House": 55,
}

# Class-name substring -> qualification key in rules/trainer_profiles.json.
FORMAT_QUALIFICATION_MAP = {
    "strength lab": "strength_lab",
    "powercycle": "powercycle",
    "pre/post natal": "pre_post_natal",
    "foundations": "foundations",
    "amped up": "amped_up",
    "hiit": "hiit",
    "cardio barre": "cardio_barre",
    "fit": "fit",
    "back body blaze": "back_body_blaze",
    "mat 57": "mat_57",
}


def _time_to_min(t: str) -> int:
    h, m = str(t).split(":")
    return int(h) * 60 + int(m)


def _load_json(path: Path, default):
    try:
        if path.exists():
            return json.loads(path.read_text())
    except Exception:
        pass
    return default


def _load_trainer_profiles() -> Dict[str, dict]:
    rows = _load_json(RULES_DIR / "trainer_profiles.json", [])
    return {row.get("name"): row for row in rows if row.get("name")}


def _load_schedule_config() -> dict:
    return _load_json(CONFIG_DIR / "schedule_config.json", {})


def _load_class_formats() -> Dict[str, dict]:
    rows = _load_json(RULES_DIR / "class_formats.json", [])
    return {row.get("name"): row for row in rows if row.get("name")}


def _load_active_hard_rules() -> Dict[str, bool]:
    """Map of rule_id -> enabled, from config/rules_config.json. Rules absent
    from the file (e.g. location-specific KW-*/SU-*/KE-* ids) default to enabled
    since they encode always-on business floors/format bans, not toggleable prefs."""
    cfg = _load_json(CONFIG_DIR / "rules_config.json", {})
    return {rule_id: bool(v.get("enabled", True)) for rule_id, v in (cfg.get("rules") or {}).items()}


def _qualification_key_for(class_name: str) -> Optional[str]:
    lower = str(class_name or "").lower()
    for substr, key in FORMAT_QUALIFICATION_MAP.items():
        if substr in lower:
            return key
    return None


def _class_duration(class_name: str, formats: Dict[str, dict]) -> int:
    row = formats.get(class_name)
    if row and row.get("duration_min") is not None:
        return int(row["duration_min"])
    return 57


def _shift_of(time_str: str) -> str:
    return "AM" if _time_to_min(time_str) < 13 * 60 else "PM"


def validate_schedule(
    schedule: List[dict],
    trainer_profiles: Optional[Dict[str, dict]] = None,
    schedule_config: Optional[dict] = None,
    class_formats: Optional[Dict[str, dict]] = None,
    active_rules: Optional[Dict[str, bool]] = None,
) -> dict:
    """Validate a full draft schedule (list of slot dicts) against hard rules.

    Returns a report dict:
        {
          "violation_count": int,
          "slots_with_violations": int,
          "violations": [{"rule_id", "reason", "location", "day", "time",
                           "class_name", "trainer", "source"}],
          "by_rule": {rule_id: count},
        }
    Each input slot dict is also mutated in-place: any new violations found
    here are appended (deduped) to its existing `constraint_violations` list.
    """
    trainer_profiles = trainer_profiles if trainer_profiles is not None else _load_trainer_profiles()
    schedule_config = schedule_config if schedule_config is not None else _load_schedule_config()
    class_formats = class_formats if class_formats is not None else _load_class_formats()
    active_rules = active_rules if active_rules is not None else _load_active_hard_rules()

    def rule_on(rule_id: str) -> bool:
        return active_rules.get(rule_id, True)

    opts = schedule_config.get("settings_options", {}) or {}
    max_daily_minutes = int(round(float(opts.get("max_daily_trainer_hours", 4)) * 60))
    weekly_floors = opts.get("location_weekly_floors") or DEFAULT_LOCATION_WEEKLY_FLOORS

    violations: List[dict] = []

    def flag(slot: dict, rule_id: str, reason: str):
        entry = {
            "rule_id": rule_id,
            "reason": reason,
            "location": slot.get("location"),
            "day": slot.get("day_of_week"),
            "time": slot.get("time"),
            "class_name": slot.get("class_name"),
            "trainer": slot.get("trainer_1"),
            "source": slot.get("rationale", "unknown"),
        }
        violations.append(entry)
        text = f"{rule_id}: {reason}"
        existing = slot.setdefault("constraint_violations", [])
        if text not in existing:
            existing.append(text)

    # ---- Per-slot checks -------------------------------------------------
    per_location_day: Dict[tuple, List[dict]] = defaultdict(list)
    for slot in schedule:
        per_location_day[(slot.get("location"), slot.get("day_of_week"))].append(slot)

    for slot in schedule:
        location = slot.get("location")
        day = slot.get("day_of_week")
        time_str = slot.get("time")
        class_name = str(slot.get("class_name") or "")
        cls_lower = class_name.lower()
        start_min = _time_to_min(time_str) if time_str else 0

        if rule_on("UNIV-008") and "foundations" in cls_lower:
            flag(slot, "UNIV-008", "Foundations must never be scheduled")

        if rule_on("UNIV-011") and "powercycle" in cls_lower and location in BENGALURU_LOCATIONS:
            flag(slot, "UNIV-011", "PowerCycle is never scheduled at Bengaluru locations")

        if rule_on("UNIV-012") and "strength lab" in cls_lower and location != KWALITY_LOCATION:
            flag(slot, "UNIV-012", "Strength Lab is only allowed at Kwality House")

        if rule_on("UNIV-013") and "pre/post natal" in cls_lower and not slot.get("is_manual_pin"):
            flag(slot, "UNIV-013", "Pre/Post Natal must be manually pinned or a saved hard rule")

        if rule_on("UNIV-024") and time_str:
            if start_min < MIN_CLASS_START_MIN or start_min > MAX_CLASS_START_MIN:
                flag(slot, "UNIV-024", "Class starts outside 07:00-20:30 window")
            elif BLOCKED_MIDDAY_START_MIN <= start_min < BLOCKED_MIDDAY_END_MIN:
                flag(slot, "UNIV-024", "Class starts inside blocked 13:00-15:00 window")

        if rule_on("UNIV-004") and day == "Sunday" and time_str and start_min < SUNDAY_MIN_START_MIN:
            flag(slot, "UNIV-004", "Sunday classes must not start before 10:00")

        # Certification match
        if rule_on("UNIV-005") and slot.get("trainer_1"):
            qual_key = _qualification_key_for(class_name)
            if qual_key:
                profile = trainer_profiles.get(slot["trainer_1"])
                quals = (profile or {}).get("qualifications", {})
                if not quals.get(qual_key):
                    flag(slot, "UNIV-005", f"Trainer not certified for {qual_key}")

    for (location, day), slots_today in per_location_day.items():
        slots_sorted = sorted(slots_today, key=lambda s: _time_to_min(s.get("time") or "00:00"))

        # Recovery placement (UNIV-007 / UNIV-026)
        recovery_slots = [s for s in slots_sorted if "recovery" in str(s.get("class_name", "")).lower()]
        for rs in recovery_slots:
            shift = _shift_of(rs.get("time"))
            same_shift = [s for s in slots_sorted if _shift_of(s.get("time")) == shift]
            if same_shift and rs is same_shift[0] and rule_on("UNIV-007"):
                flag(rs, "UNIV-007", "Recovery must not be first class of the shift")
            if same_shift and rs is not same_shift[-1] and rule_on("UNIV-026"):
                flag(rs, "UNIV-026", "Recovery must be the last class in its shift")

        # No consecutive identical classes at the same location/day (UNIV-023).
        # "Same class formats" means the same specific class (e.g. two Barre 57
        # sessions back-to-back), not the broader product family — family-level
        # grouping in class_formats.json also covers legitimately different
        # classes (e.g. Barre 57 and Cardio Barre share the "barre_57" family).
        # Parallel rooms running the same class at the *same* start time is
        # legitimate peak-cluster usage, not a "consecutive" violation — only
        # flag genuinely sequential (different start time) same-class pairs.
        if rule_on("UNIV-023"):
            for i in range(1, len(slots_sorted)):
                prev, cur = slots_sorted[i - 1], slots_sorted[i]
                if prev.get("time") == cur.get("time"):
                    continue
                if prev.get("class_name") and prev.get("class_name") == cur.get("class_name"):
                    flag(cur, "UNIV-023", f"Consecutive '{cur.get('class_name')}' classes back-to-back")

    # ---- Trainer-level weekly checks -------------------------------------
    trainer_day_slots: Dict[tuple, List[dict]] = defaultdict(list)
    trainer_week_minutes: Dict[str, int] = defaultdict(int)
    trainer_days_worked: Dict[str, set] = defaultdict(set)
    for slot in schedule:
        trainer = slot.get("trainer_1")
        if not trainer:
            continue
        day = slot.get("day_of_week")
        trainer_day_slots[(trainer, day)].append(slot)
        trainer_week_minutes[trainer] += int(slot.get("duration_min") or _class_duration(slot.get("class_name"), class_formats))
        trainer_days_worked[trainer].add(day)

    for (trainer, day), slots in trainer_day_slots.items():
        day_minutes = sum(int(s.get("duration_min") or _class_duration(s.get("class_name"), class_formats)) for s in slots)
        if rule_on("UNIV-010") and day_minutes > max_daily_minutes:
            for s in slots:
                flag(s, "UNIV-010", f"Trainer assigned {day_minutes} min on {day}, exceeds {max_daily_minutes} min/day cap")

        shifts = {_shift_of(s.get("time")) for s in slots}
        if "AM" in shifts and "PM" in shifts:
            for s in slots:
                flag(s, "UNIV-009", "Trainer assigned both AM and PM shifts on the same day")

        locations_today = {s.get("location") for s in slots}
        by_shift: Dict[str, set] = defaultdict(set)
        for s in slots:
            by_shift[_shift_of(s.get("time"))].add(s.get("location"))
        for shift, locs in by_shift.items():
            if len(locs) > 1:
                for s in slots:
                    if _shift_of(s.get("time")) == shift:
                        flag(s, "UNIV-022", f"Trainer assigned to {len(locs)} locations in the same {shift} shift")

    for trainer, profile in trainer_profiles.items():
        tier = profile.get("tier", 2)
        weekly_cap_min = int(round(float(opts.get("weekly_hours_cap", 15)) * 60)) if tier == 1 else int(round(float(opts.get("weekly_hours_cap", 15)) * 60))
        minutes = trainer_week_minutes.get(trainer, 0)
        if minutes > weekly_cap_min:
            for s in schedule:
                if s.get("trainer_1") == trainer:
                    flag(s, "WEEKLY-HOURS-CAP", f"Trainer weekly minutes {minutes} exceed cap {weekly_cap_min}")

        days_worked = trainer_days_worked.get(trainer, set())
        if days_worked and len(DAY_ORDER) - len(days_worked) < 1 and rule_on("UNIV-025"):
            for s in schedule:
                if s.get("trainer_1") == trainer:
                    flag(s, "UNIV-025", "Trainer has zero weekly off days")

    # ---- Location-level weekly floor ------------------------------------
    location_counts: Dict[str, int] = defaultdict(int)
    for slot in schedule:
        location_counts[slot.get("location")] += 1
    for location, floor in weekly_floors.items():
        count = location_counts.get(location, 0)
        if count < floor:
            violations.append({
                "rule_id": "WEEKLY-FLOOR",
                "reason": f"{location} has {count} assignments, below floor of {floor}",
                "location": location, "day": None, "time": None,
                "class_name": None, "trainer": None, "source": "aggregate",
            })

    by_rule: Dict[str, int] = defaultdict(int)
    slots_with_violations = set()
    for v in violations:
        by_rule[v["rule_id"]] += 1
    for s in schedule:
        if s.get("constraint_violations"):
            slots_with_violations.add(id(s))

    return {
        "violation_count": len(violations),
        "slots_with_violations": len(slots_with_violations),
        "violations": violations,
        "by_rule": dict(by_rule),
    }


def validate_schedule_file(path: str) -> dict:
    """Validate a state/05_draft_schedule*.json file and return the report.
    Also rewrites the file with updated per-slot constraint_violations."""
    file_path = Path(path)
    data = json.loads(file_path.read_text())
    schedule = data.get("schedule") or []
    report = validate_schedule(schedule)
    data["schedule"] = schedule
    file_path.write_text(json.dumps(data, indent=2))
    return report
