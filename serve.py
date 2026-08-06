"""
serve.py — Local HTTP server for Studio Scheduler web interface.
Serves the generated schedule web UI and exposes API endpoints for rule toggling.

Usage:
    python3 serve.py --week 2026-05-04 --port 8080
"""
import argparse
import json
import os
import socket
import subprocess
import sys
import threading
import time as _time
import uuid
from datetime import date, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from pathlib import Path
from urllib import error as urlerror
from urllib import request as urlrequest
from urllib.parse import urlparse

from agents.ingestor import DataIngestor
from chat_assistant import build_chat_context
from finalise_schedule import finalise_schedule_document
from rule_config import build_rules_catalog, load_rules_config, update_rules_config

PROJECT_ROOT = Path(__file__).parent
WEB_DIR = PROJECT_ROOT / "web"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"
CONFIG_PATH = PROJECT_ROOT / "config" / "rules_config.json"
SCHEDULE_CONFIG_PATH = PROJECT_ROOT / "config" / "schedule_config.json"
TRAINER_PROFILES_PATH = PROJECT_ROOT / "rules" / "trainer_profiles.json"
DEFAULT_SCHEDULE_CONFIG_PATH = SCHEDULE_CONFIG_PATH
DEFAULT_TRAINER_PROFILES_PATH = TRAINER_PROFILES_PATH
MUMBAI_LOCATIONS = {"Kwality House, Kemps Corner", "Supreme HQ, Bandra", "Courtside"}
BENGALURU_LOCATIONS = {"Kenkere House", "Copper & Cloves"}
MAIN_STUDIOS = {"Kwality House, Kemps Corner", "Supreme HQ, Bandra", "Kenkere House"}
DERIVED_STUDIOS = {"Courtside", "Copper & Cloves"}
DEFAULT_OPENAI_MODEL = "gpt-5.4-mini"
DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"


def load_env_file(path: Path = PROJECT_ROOT / ".env") -> None:
    if not path.exists():
        return
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_env_file()

# Global mutable state (now synced to disk for multi-worker environments)
_run_counter = 0

STATE_DIR = PROJECT_ROOT / "state"
PIPELINE_STATE_FILE = STATE_DIR / "pipeline_status.json"

def _read_pipeline_state() -> dict:
    default_state = {
        "running": False,
        "status": "idle",
        "pid": None,
        "started": None,
        "message": "Idle",
    }
    try:
        if PIPELINE_STATE_FILE.exists():
            with open(PIPELINE_STATE_FILE) as f:
                data = json.load(f)
                return {**default_state, **data}
    except Exception:
        pass
    return default_state

def _write_pipeline_state(state: dict) -> None:
    try:
        PIPELINE_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(PIPELINE_STATE_FILE, "w") as f:
            json.dump(state, f)
    except Exception:
        pass


def _safe_child_path(base: Path, name: str) -> Path | None:
    base_resolved = base.resolve()
    candidate = (base_resolved / name).resolve()
    try:
        candidate.relative_to(base_resolved)
    except ValueError:
        return None
    return candidate


def _schedule_config_path() -> Path:
    if SCHEDULE_CONFIG_PATH != DEFAULT_SCHEDULE_CONFIG_PATH:
        return SCHEDULE_CONFIG_PATH
    return PROJECT_ROOT / "config" / "schedule_config.json"


def _write_json_atomic(path: Path, payload) -> None:
    path.parent.mkdir(exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    tmp.replace(path)


def _load_optimizer_scores_context(limit: int = 3000) -> dict:
    scores_path = STATE_DIR / "03_scores.json"
    if not scores_path.exists():
        scores_path = OUTPUTS_DIR / "scorecard.json"
    if not scores_path.exists():
        return {"class_slot_ranking": []}
    try:
        data = json.loads(scores_path.read_text(encoding="utf-8"))
    except Exception:
        return {"class_slot_ranking": []}
    rows = data.get("class_slot_ranking") or []
    if not rows and data.get("locations"):
        return {"scorecard": data.get("locations")}
    compact_rows = []
    for row in rows[:limit]:
        compact_rows.append({
            "location": row.get("location"),
            "day": row.get("day_name") or row.get("day"),
            "time": row.get("time"),
            "class": row.get("class") or row.get("class_name"),
            "trainer": row.get("trainer"),
            "score": row.get("score"),
            "fill": row.get("avg_fill_rate") or row.get("historical_avg_fill"),
            "checkins": row.get("avg_checkin") or row.get("historical_avg_checkin"),
            "sessions": row.get("session_count") or row.get("historical_session_count"),
            "recommendation": row.get("recommendation"),
        })
    return {"class_slot_ranking": compact_rows}


def _optimizer_history_evidence(slot: dict, scores_context: dict) -> list[str]:
    rows = scores_context.get("class_slot_ranking") or []
    if not rows:
        return ["No history score rows were available to the optimiser endpoint."]
    loc = slot.get("location")
    day = slot.get("day_of_week") or slot.get("day")
    time = slot.get("time")
    class_name = slot.get("class_name") or slot.get("class")
    trainer = slot.get("trainer_1") or slot.get("trainer")
    exact_matches = []
    for row in rows:
        if (
            (not loc or row.get("location") == loc)
            and (not day or row.get("day") == day)
            and (not time or row.get("time") == time)
            and (not class_name or row.get("class") == class_name)
            and (not trainer or row.get("trainer") == trainer)
        ):
            exact_matches.append(row)
    exact_matches.sort(key=lambda row: -(float(row.get("score") or 0)))
    if not exact_matches:
        slot_matches = _exact_history_rows(slot, scores_context, ignore_trainer=True)
        if slot_matches:
            slot_matches.sort(key=lambda row: -(float(row.get("score") or 0)))
            row = slot_matches[0]
            fill = row.get("fill")
            fill_text = f"{float(fill):.0%}" if isinstance(fill, (int, float)) else "n/a"
            return [
                "slot-level history checked: "
                f"{row.get('class') or class_name} at {row.get('location') or loc} "
                f"{row.get('day') or day} {row.get('time') or time}; "
                f"best trainer {row.get('trainer', 'n/a')}, score {row.get('score', 'n/a')}, "
                f"fill {fill_text}, check-ins {row.get('checkins', 'n/a')}, sessions {row.get('sessions', 'n/a')}."
            ]
        fill = slot.get("predicted_fill_rate")
        score = slot.get("score")
        fill_text = f"{float(fill):.0%}" if isinstance(fill, (int, float)) else "n/a"
        return [
            f"No class/trainer or class-slot historical evidence found. Current slot metrics: projected fill {fill_text}, optimiser score {score if score is not None else 'n/a'}."
        ]
    row = exact_matches[0]
    fill = row.get("fill")
    fill_text = f"{float(fill):.0%}" if isinstance(fill, (int, float)) else "n/a"
    return [
        "history checked: "
        f"{row.get('class') or class_name} with {row.get('trainer') or trainer} at "
        f"{row.get('location') or loc} {row.get('day') or day} {row.get('time') or time}; "
        f"score {row.get('score', 'n/a')}, fill {fill_text}, "
        f"check-ins {row.get('checkins', 'n/a')}, sessions {row.get('sessions', 'n/a')}."
    ]


def _normalise_ai_add_slot(op: dict) -> dict:
    slot = dict(op.get("slot") or {})
    for key in ("location", "date", "day_of_week", "time", "class_name", "trainer_1", "room", "duration_min", "level", "class_level"):
        if not slot.get(key) and op.get(key) is not None:
            slot[key] = op.get(key)
    return slot


def _slot_metric_text(slot: dict) -> str:
    fill = slot.get("predicted_fill_rate")
    score = slot.get("score")
    parts = []
    if isinstance(fill, (int, float)):
        parts.append(f"projected fill {float(fill):.0%}")
    if score is not None:
        parts.append(f"score {score}")
    return ", ".join(parts) if parts else "no current metric fields"


def _exact_history_rows(slot: dict, scores_context: dict, *, ignore_trainer: bool = False) -> list[dict]:
    rows = scores_context.get("class_slot_ranking") or []
    loc = slot.get("location")
    day = slot.get("day_of_week") or slot.get("day")
    time = slot.get("time")
    class_name = slot.get("class_name") or slot.get("class")
    trainer = slot.get("trainer_1") or slot.get("trainer")
    matches = []
    for row in rows:
        if (
            (not loc or row.get("location") == loc)
            and (not day or row.get("day") == day)
            and (not time or row.get("time") == time)
            and (not class_name or row.get("class") == class_name)
            and (ignore_trainer or not trainer or row.get("trainer") == trainer)
        ):
            matches.append(row)
    return matches


def _history_is_bad_over_time(slot: dict, scores_context: dict) -> bool:
    rows = _exact_history_rows(slot, scores_context) or _exact_history_rows(slot, scores_context, ignore_trainer=True)
    if not rows:
        return False
    total_sessions = sum(int(row.get("sessions") or row.get("session_count") or 0) for row in rows)
    if total_sessions < 4:
        return False
    weighted_fill = 0.0
    weighted_checkins = 0.0
    for row in rows:
        sessions = int(row.get("sessions") or row.get("session_count") or 0)
        weighted_fill += float(row.get("fill") or row.get("avg_fill_rate") or 0) * sessions
        weighted_checkins += float(row.get("checkins") or row.get("avg_checkin") or 0) * sessions
    avg_fill = weighted_fill / total_sessions if total_sessions else 0.0
    avg_checkins = weighted_checkins / total_sessions if total_sessions else 0.0
    return avg_fill < 0.30 or avg_checkins < 4.0


def _history_strength(slot: dict, scores_context: dict, *, allow_slot_fallback: bool = False) -> dict | None:
    rows = _exact_history_rows(slot, scores_context)
    source = "class_day_time_location_trainer"
    if not rows and allow_slot_fallback:
        rows = _exact_history_rows(slot, scores_context, ignore_trainer=True)
        source = "class_day_time_location"
    if not rows:
        return None
    total_sessions = sum(int(row.get("sessions") or row.get("session_count") or 0) for row in rows)
    if total_sessions < 3:
        return None
    weighted_fill = sum(float(row.get("fill") or row.get("avg_fill_rate") or 0) * int(row.get("sessions") or row.get("session_count") or 0) for row in rows)
    weighted_checkins = sum(float(row.get("checkins") or row.get("avg_checkin") or 0) * int(row.get("sessions") or row.get("session_count") or 0) for row in rows)
    best_score = max(float(row.get("score") or 0) for row in rows)
    return {
        "sessions": total_sessions,
        "fill": weighted_fill / total_sessions if total_sessions else 0.0,
        "checkins": weighted_checkins / total_sessions if total_sessions else 0.0,
        "score": best_score,
        "source": source,
    }


def _candidate_has_stronger_history(before: dict, after: dict, scores_context: dict) -> bool:
    after_hist = _history_strength(after, scores_context, allow_slot_fallback=True)
    if not after_hist:
        return True
    before_hist = _history_strength(before, scores_context, allow_slot_fallback=True)
    before_fill = before_hist["fill"] if before_hist else float(before.get("predicted_fill_rate") or 0)
    before_score = before_hist["score"] if before_hist else float(before.get("score") or 0)
    return after_hist["fill"] >= before_fill - 0.02 or after_hist["score"] >= before_score - 5


def _operation_candidate_key(op: dict) -> tuple:
    target = op.get("target") or {}
    slot = op.get("slot") or {}
    return (
        op.get("type"),
        str(op.get("id") or ""),
        op.get("new_class") or "",
        op.get("new_trainer") or "",
        op.get("new_time") or "",
        op.get("new_level") or op.get("level") or "",
        target.get("location") or "",
        target.get("day_of_week") or target.get("day") or "",
        target.get("time") or "",
        slot.get("location") or "",
        slot.get("day_of_week") or slot.get("day") or "",
        slot.get("time") or "",
        slot.get("class_name") or "",
        slot.get("trainer_1") or "",
    )


def _validated_optimizer_candidate_operations(
    schedule_data: dict,
    compact: list,
    valid_trainers: set,
    iteration: str,
    scores_context: dict,
    schedule_config: dict,
    *,
    limit: int = 12,
) -> list[dict]:
    """Build operations the server has already validated.

    The LLM is good at prioritising tradeoffs, but it was inventing nearby-history
    edits that the server had to reject. These candidates keep creativity inside
    the actual validator boundary.
    """
    rows = scores_context.get("class_slot_ranking") or []
    candidates: list[dict] = []
    seen: set[tuple] = set()
    for meta in sorted(compact, key=lambda item: (float(item.get("fill") or 0), float(item.get("score") or 0))):
        current = meta.get("slot") or {}
        current_trainer = current.get("trainer_1")
        current_class = current.get("class_name")
        for row in sorted(rows, key=lambda r: (-(float(r.get("score") or 0)), -(float(r.get("fill") or 0)))):
            if (
                row.get("location") != current.get("location")
                or row.get("day") != current.get("day_of_week")
                or row.get("time") != current.get("time")
                or int(row.get("sessions") or row.get("session_count") or 0) < 3
            ):
                continue
            row_class = row.get("class")
            row_trainer = row.get("trainer")
            if not row_class or not row_trainer:
                continue
            if valid_trainers and row_trainer not in valid_trainers:
                continue
            row_score = float(row.get("score") or 0)
            row_fill = float(row.get("fill") or 0)
            current_score = float(meta.get("score") or current.get("score") or 0)
            current_fill = float(meta.get("fill") or current.get("predicted_fill_rate") or 0)
            if current_fill >= 0.35 and row_score < current_score - 5:
                continue

            if row_class == current_class and row_trainer != current_trainer:
                op = {
                    "type": "swap_trainer",
                    "id": meta["id"],
                    "new_trainer": row_trainer,
                    "reason": (
                        "Server-vetted exact trainer-slot improvement: "
                        f"{row_trainer} has score {row.get('score')} and fill {row_fill:.0%} "
                        f"over {row.get('sessions')} sessions for this class/day/time/location."
                    ),
                }
            elif row_class != current_class:
                op = {
                    "type": "change_class",
                    "id": meta["id"],
                    "new_class": row_class,
                    "new_trainer": row_trainer,
                    "reason": (
                        "Server-vetted class-slot improvement: "
                        f"{row_class} with {row_trainer} has score {row.get('score')} and "
                        f"fill {row_fill:.0%} over {row.get('sessions')} sessions "
                        "for this exact day/time/location."
                    ),
                }
            else:
                continue

            dedupe_key = (
                op["type"],
                op["id"],
                op.get("new_class", ""),
                op.get("new_trainer", ""),
            )
            if dedupe_key in seen:
                continue

            candidate = dict(current)
            if op["type"] == "swap_trainer":
                candidate["trainer_1"] = op["new_trainer"]
            else:
                candidate["class_name"] = op["new_class"]
                candidate["trainer_1"] = op["new_trainer"]
            if not _candidate_has_stronger_history(current, candidate, scores_context):
                continue
            try:
                _validate_ai_trainer_distribution(schedule_data, iteration, candidate, original=current)
                if candidate.get("location") in (MUMBAI_LOCATIONS | BENGALURU_LOCATIONS):
                    _validate_manual_slot(schedule_data, iteration, candidate, original_slot=current)
            except Exception:
                continue

            seen.add(dedupe_key)
            candidates.append({
                "operation": op,
                "slot": {
                    "id": meta["id"],
                    "location": current.get("location"),
                    "day": current.get("day_of_week"),
                    "time": current.get("time"),
                    "current_class": current_class,
                    "current_trainer": current_trainer,
                    "current_fill": meta.get("fill"),
                    "current_score": meta.get("score"),
                },
                "evidence": {
                    "class": row_class,
                    "trainer": row_trainer,
                    "score": row.get("score"),
                    "fill": row.get("fill"),
                    "checkins": row.get("checkins"),
                    "sessions": row.get("sessions"),
                },
            })
            if len(candidates) >= limit:
                return candidates
    return candidates


def _has_direct_room_conflict(slot: dict, locations: dict) -> bool:
    room = slot.get("room")
    if not room:
        return False
    loc = slot.get("location")
    day = slot.get("day_of_week")
    time = slot.get("time")
    for row in locations.get(loc, []) or []:
        if row is slot:
            continue
        if (
            row.get("room") == room
            and row.get("day_of_week") == day
            and row.get("time") == time
            and not _same_schedule_slot(row, slot)
        ):
            return True
    return False


def _all_iteration_rows(schedule_data: dict, iteration: str) -> list[dict]:
    rows = []
    if iteration == "Main":
        source = schedule_data.get("locations") or {}
    else:
        source = ((schedule_data.get("iterations") or {}).get(iteration) or {})
    for loc_rows in source.values():
        rows.extend(loc_rows or [])
    return rows


def _validate_ai_trainer_distribution(schedule_data: dict, iteration: str, slot: dict, original: dict | None = None) -> None:
    trainer = slot.get("trainer_1")
    if not trainer:
        return
    rows = [row for row in _all_iteration_rows(schedule_data, iteration) if not (original and row is original)]
    trainer_rows = [row for row in rows if (row.get("trainer_1") or "") == trainer]
    day_locations = {row.get("location") for row in trainer_rows if row.get("day_of_week") == slot.get("day_of_week") and row.get("location")}
    if day_locations and slot.get("location") not in day_locations:
        raise ValueError(f"{trainer} cannot be scheduled in more than one studio on {slot.get('day_of_week')}")
    assigned_days = {row.get("day_of_week") for row in trainer_rows if row.get("day_of_week")}
    assigned_days.add(slot.get("day_of_week"))
    if len(assigned_days) > 5:
        raise ValueError(f"{trainer} must keep at least 2 days off per week")


def _trainer_load_context(schedule_data: dict, iteration: str, profiles: list[dict]) -> list[dict]:
    rows = _all_iteration_rows(schedule_data, iteration)
    tiers = {p.get("name"): p.get("tier") for p in profiles if p.get("name")}
    result = []
    for trainer in sorted({row.get("trainer_1") for row in rows if row.get("trainer_1")}):
        trainer_rows = [row for row in rows if row.get("trainer_1") == trainer]
        days = sorted({row.get("day_of_week") for row in trainer_rows if row.get("day_of_week")})
        locations_by_day = {}
        for row in trainer_rows:
            day = row.get("day_of_week")
            if not day:
                continue
            locations_by_day.setdefault(day, set()).add(row.get("location"))
        result.append({
            "trainer": trainer,
            "tier": tiers.get(trainer),
            "weekly_hours": round(sum(_slot_duration(row) for row in trainer_rows) / 60, 2),
            "assigned_days": days,
            "days_off_count": max(0, 7 - len(days)),
            "multi_location_days": sorted(day for day, locs in locations_by_day.items() if len({loc for loc in locs if loc}) > 1),
        })
    return result


def _peak_utilisation_context(schedule_data: dict, iteration: str) -> list[dict]:
    rows = _all_iteration_rows(schedule_data, iteration)
    peaks = [("08:00", "10:00"), ("11:00", "12:00"), ("18:00", "19:30")]
    result = []
    for row in rows:
        start = _slot_minutes(row.get("time") or "00:00")
        if not any(_slot_minutes(lo) <= start <= _slot_minutes(hi) for lo, hi in peaks):
            continue
        same_start = [
            other for other in rows
            if other.get("location") == row.get("location")
            and other.get("day_of_week") == row.get("day_of_week")
            and other.get("time") == row.get("time")
        ]
        rooms = sorted({other.get("room") for other in same_start if other.get("room")})
        result.append({
            "location": row.get("location"),
            "day": row.get("day_of_week"),
            "time": row.get("time"),
            "parallel_classes": len(same_start),
            "rooms_used": rooms,
        })
    return result[:80]


def _server_change_reason(op_type: str, before: dict, after: dict, ai_reason: str) -> str:
    if op_type == "remove_class":
        return (
            f"Removed {before.get('class_name', 'class')} at {before.get('day_of_week', '?')} {before.get('time', '?')} "
            f"because the AI explicitly marked this as safe to delete and current slot metrics are weak ({_slot_metric_text(before)})."
        )
    if op_type == "add_class":
        return (
            f"Added {after.get('class_name', 'class')} at {after.get('day_of_week', '?')} {after.get('time', '?')} "
            f"with {after.get('trainer_1', 'trainer')} to fill an available schedule opportunity after validation."
        )
    if op_type in {"move_class", "change_time"}:
        return (
            f"Moved {before.get('class_name', 'class')} from {before.get('day_of_week', '?')} {before.get('time', '?')} "
            f"to {after.get('day_of_week', '?')} {after.get('time', '?')} after validating trainer availability and conflicts."
        )
    if op_type == "change_class":
        return (
            f"Changed class format from {before.get('class_name', '?')} to {after.get('class_name', '?')} "
            f"at {after.get('day_of_week', '?')} {after.get('time', '?')} after validating the assigned trainer and studio constraints. Check the evidence line below for whether exact historical support exists."
        )
    if op_type == "swap_trainer":
        return (
            f"Changed trainer from {before.get('trainer_1', '?')} to {after.get('trainer_1', '?')} "
            f"for {after.get('class_name', 'class')} after validating trainer availability, location rules, and load caps."
        )
    if op_type == "change_level":
        return (
            f"Changed level from {before.get('class_level') or before.get('level') or '?'} to {after.get('class_level') or after.get('level') or '?'} "
            f"for {after.get('class_name', 'class')}."
        )
    return ai_reason or "AI optimisation change."


def _optimizer_rule_evidence(settings_options: dict, schedule_config: dict) -> list[str]:
    custom_rules = schedule_config.get("custom_rules") or []
    manual_protected = schedule_config.get("manual_protected") or []
    manual_excluded = schedule_config.get("manual_excluded") or []
    return [
        "Validated against trainer/studio constraints: active profile, enabled studio, availability, overlaps, shift/location lock, daily max, weekly cap.",
        f"Rules context loaded: {len(custom_rules)} custom, {len(manual_protected)} protected, {len(manual_excluded)} excluded.",
    ]


def _parse_optimizer_ai_json(content: str) -> dict:
    text = str(content or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    try:
        return json.loads(text or "{}")
    except json.JSONDecodeError as exc:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            candidate = text[start:end + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass
        if text.count("{") > text.count("}") or text.count("[") > text.count("]"):
            raise ValueError("AI response appears truncated before valid JSON completed. Try again with a narrower location scope.") from exc
        raise ValueError(str(exc)) from exc


def _slot_from_meta(meta: dict, locations: dict) -> dict:
    slot = meta.get("slot")
    if slot is not None:
        return slot
    return locations.get(meta["loc"], [])[meta["schedule_index"]]


def _remove_meta_slot(meta: dict, locations: dict) -> dict:
    rows = locations.get(meta["loc"], [])
    slot = meta.get("slot")
    if slot in rows:
        rows.remove(slot)
        return slot
    idx = meta.get("schedule_index")
    if isinstance(idx, int) and 0 <= idx < len(rows):
        return rows.pop(idx)
    raise ValueError("Slot index out of range")


def _apply_ai_schedule_operations(schedule_data: dict, operations: list, compact: list, valid_trainers: set, iteration: str, scores_context: dict, schedule_config: dict) -> tuple[list, list]:
    applied, rejected = [], []
    slot_index = {s["id"]: s for s in compact}
    rule_notes = _optimizer_rule_evidence(schedule_config.get("settings_options") or {}, schedule_config)
    locations = schedule_data.get("locations") or {}

    def reject(op, message):
        rejected.append({
            "type": op.get("type"),
            "message": message,
            "reason": op.get("reason") or message,
            "validation": ["Rejected by server validation.", message],
        })

    def validate(slot, original=None):
        _validate_ai_trainer_distribution(schedule_data, iteration, slot, original=original)
        if slot.get("location") in (MUMBAI_LOCATIONS | BENGALURU_LOCATIONS):
            _validate_manual_slot(schedule_data, iteration, slot, original_slot=original)

    for op in operations:
        op_type = op.get("type")
        slot_id = str(op.get("id") or "").strip()
        reason = op.get("reason") or "AI optimisation change."
        meta = slot_index.get(slot_id) if slot_id else None
        try:
            if op_type == "add_class":
                new_slot = _normalise_ai_add_slot(op)
                missing = [k for k in ("location", "day_of_week", "time", "class_name", "trainer_1") if not new_slot.get(k)]
                if missing:
                    reject(op, f"Missing slot field(s): {', '.join(missing)}")
                    continue
                if valid_trainers and new_slot.get("trainer_1") not in valid_trainers:
                    reject(op, f"Trainer '{new_slot.get('trainer_1')}' not in roster")
                    continue
                new_slot.setdefault("recommendation", "AI_OPTIMIZED")
                new_slot["ai_added"] = True
                new_slot["ai_optimized"] = True
                new_slot["scheduling_reason"] = reason
                validate(new_slot)
                locations.setdefault(new_slot["location"], []).append(new_slot)
                applied.append({
                    "type": op_type,
                    "before": {},
                    "after": dict(new_slot),
                    "reason": _server_change_reason(op_type, {}, new_slot, reason),
                    "validation": ["Server validation passed for add_class.", *rule_notes],
                    "evidence": _optimizer_history_evidence(new_slot, scores_context),
                })
                continue

            if not meta:
                reject(op, f"Unknown slot id {slot_id}")
                continue
            current = _slot_from_meta(meta, locations)
            before = dict(current)

            if op_type == "swap_trainer":
                new_trainer = op.get("new_trainer")
                if not new_trainer:
                    reject(op, "Missing new_trainer")
                    continue
                if valid_trainers and new_trainer not in valid_trainers:
                    reject(op, f"Trainer '{new_trainer}' not in roster")
                    continue
                candidate = dict(current)
                candidate["trainer_1"] = new_trainer
                candidate["ai_optimized"] = True
                candidate["scheduling_reason"] = reason
                validate(candidate, original=current)
                current.update(candidate)
            elif op_type == "remove_class":
                if not (op.get("allow_delete") is True or op.get("confirm_delete") is True):
                    reject(op, "Deletion not applied: remove_class requires allow_delete=true. Use change_class, change_time, or move_class when replacing a weak slot.")
                    continue
                if not (_history_is_bad_over_time(current, scores_context) or _has_direct_room_conflict(current, locations)):
                    reject(op, "Deletion not applied: class can only be deleted when exact historical class average/fill is weak over time or a direct studio/room conflict is detected.")
                    continue
                _remove_meta_slot(meta, locations)
            elif op_type in {"move_class", "change_time"}:
                target = op.get("target") or {}
                candidate = dict(current)
                candidate.update({
                    "location": target.get("location") or candidate.get("location"),
                    "date": target.get("date", candidate.get("date", "")),
                    "day_of_week": target.get("day_of_week") or target.get("day") or candidate.get("day_of_week"),
                    "time": target.get("time") or op.get("new_time") or candidate.get("time"),
                    "ai_optimized": True,
                    "ai_moved": True,
                    "scheduling_reason": reason,
                })
                if not _candidate_has_stronger_history(current, candidate, scores_context):
                    reject(op, "Change not applied: proposed time/location does not have stronger class-slot or trainer-slot historical evidence than the current slot.")
                    continue
                validate(candidate, original=current)
                _remove_meta_slot(meta, locations)
                locations.setdefault(candidate["location"], []).append(candidate)
                meta["slot"] = candidate
                meta["loc"] = candidate["location"]
                current = candidate
            elif op_type == "change_class":
                new_class = op.get("new_class") or (op.get("slot") or {}).get("class_name")
                if not new_class:
                    reject(op, "Missing new_class")
                    continue
                candidate = dict(current)
                candidate["class_name"] = new_class
                if op.get("new_trainer"):
                    candidate["trainer_1"] = op.get("new_trainer")
                candidate["ai_optimized"] = True
                candidate["scheduling_reason"] = reason
                if not _candidate_has_stronger_history(current, candidate, scores_context):
                    reject(op, "Change not applied: proposed class format does not have stronger class-slot or trainer-slot historical evidence than the current slot.")
                    continue
                validate(candidate, original=current)
                current.update(candidate)
            elif op_type == "change_level":
                new_level = op.get("new_level") or op.get("level")
                if not new_level:
                    reject(op, "Missing new_level")
                    continue
                current["level"] = new_level
                current["class_level"] = new_level
                current["ai_optimized"] = True
                current["scheduling_reason"] = reason
            else:
                reject(op, "Unsupported or incomplete operation")
                continue

            after = dict(current)
            applied.append({
                "type": op_type,
                "before": before,
                "after": after,
                "reason": _server_change_reason(op_type, before, after, reason),
                "validation": [f"Server validation passed for {op_type}.", *rule_notes],
                "evidence": _optimizer_history_evidence(after if op_type != "remove_class" else before, scores_context),
            })
        except Exception as exc:
            reject(op, str(exc))
    return applied, rejected


def _deterministic_fallback_operations(compact: list, scores_context: dict, valid_trainers: set) -> list[dict]:
    rows = scores_context.get("class_slot_ranking") or []
    operations = []
    for meta in sorted(compact, key=lambda item: (float(item.get("fill") or 0), float(item.get("score") or 0))):
        slot = meta.get("slot") or {}
        current_trainer = slot.get("trainer_1")
        current_score = float(slot.get("score") or 0)
        current_fill = float(slot.get("predicted_fill_rate") or 0)
        candidates = []
        for row in rows:
            if (
                row.get("location") == slot.get("location")
                and row.get("day") == slot.get("day_of_week")
                and row.get("time") == slot.get("time")
                and row.get("class") == slot.get("class_name")
                and row.get("trainer")
                and row.get("trainer") != current_trainer
                and (not valid_trainers or row.get("trainer") in valid_trainers)
            ):
                score = float(row.get("score") or 0)
                fill = float(row.get("fill") or 0)
                sessions = int(row.get("sessions") or 0)
                if sessions >= 3 and (score >= current_score + 10 or fill >= current_fill + 0.05):
                    candidates.append((score, fill, row))
        candidates.sort(key=lambda item: (-item[0], -item[1]))
        if candidates:
            row = candidates[0][2]
            operations.append({
                "type": "swap_trainer",
                "id": meta["id"],
                "new_trainer": row.get("trainer"),
                "reason": (
                    "Deterministic fallback: exact historical trainer-slot evidence "
                    f"score {row.get('score')}, fill {float(row.get('fill') or 0):.0%}, sessions {row.get('sessions')}."
                ),
            })
        if len(operations) >= 3:
            break
    return operations


def _run_optimize_with_ai(payload: dict) -> dict:
    """Synchronous Optimize-with-AI endpoint. OpenAI-only by policy."""
    import os
    schedule_path = WEB_DIR / "schedule_data.json"
    if not schedule_path.exists():
        return {"ok": False, "error": "No active schedule found. Generate one first."}

    cfg_path = _schedule_config_path()
    schedule_config = {}
    settings_options = {}
    if cfg_path.exists():
        try:
            schedule_config = json.loads(cfg_path.read_text())
            settings_options = (schedule_config.get("settings_options") or {})
        except Exception:
            schedule_config = {}
            settings_options = {}

    api_key = (
        str(os.environ.get("OPENAI_API_KEY") or "").strip()
        or str(payload.get("api_key") or "").strip()
        or str(settings_options.get("ai_optimize_api_key") or "").strip()
        or str(settings_options.get("ai_api_key") or "").strip()
    )
    model = os.environ.get("OPENAI_MODEL") or DEFAULT_OPENAI_MODEL
    base_url = (os.environ.get("OPENAI_BASE_URL") or DEFAULT_OPENAI_BASE_URL).rstrip("/")
    if not api_key:
        return {"ok": False, "error": "Add an AI API key in Settings → AI Generation."}

    try:
        schedule_data = json.loads(schedule_path.read_text())
    except Exception as exc:
        return {"ok": False, "error": f"Schedule file unreadable: {exc}"}

    location_filter = str(payload.get("location") or "").strip()
    locations = schedule_data.get("locations") or {}
    if not locations:
        return {"ok": False, "error": "Active schedule has no locations."}

    # Build compact slot list (only essentials)
    compact = []
    for loc_name, slots in locations.items():
        if location_filter and loc_name != location_filter:
            continue
        for i, s in enumerate(slots):
            slot_id = str(len(compact) + 1)
            compact.append({
                "id": slot_id,
                "schedule_index": i,
                "slot": s,
                "loc": loc_name,
                "day": s.get("day_of_week"),
                "time": s.get("time"),
                "class": s.get("class_name"),
                "trainer": s.get("trainer_1"),
                "fill": round(float(s.get("predicted_fill_rate") or 0), 2),
                "score": round(float(s.get("score") or 0), 1),
            })
    if not compact:
        return {"ok": False, "error": "No slots matched the requested scope."}

    scores_context = _load_optimizer_scores_context()

    # Trainer roster summary
    profiles_path = _trainer_profiles_path()
    trainer_summary = []
    try:
        profiles = json.loads(profiles_path.read_text())
        for p in profiles[:60]:
            name = p.get("name")
            tier = p.get("tier")
            quals = [k for k, v in (p.get("qualifications") or {}).items() if v]
            if name:
                trainer_summary.append(f"T{tier} {name} | {','.join(quals[:6])}")
    except Exception:
        pass

    iteration = str(payload.get("iteration") or "Main")
    valid_trainers = {p.get("name") for p in (profiles if 'profiles' in locals() else []) if p.get("name")}
    trainer_load_context = _trainer_load_context(schedule_data, iteration, profiles if 'profiles' in locals() else [])
    peak_context = _peak_utilisation_context(schedule_data, iteration)
    candidate_operations = _validated_optimizer_candidate_operations(
        schedule_data,
        compact,
        valid_trainers,
        iteration,
        scores_context,
        schedule_config,
    )

    system_prompt = (
        "You optimise a studio fitness weekly schedule. Return JSON only. "
        "Propose up to 6 high-impact operations that raise predicted fill rate, improve class mix, fix weak slots, or satisfy rules. "
        'Schema: {"summary":"...","operations":[{"type":"swap_trainer|add_class|remove_class|move_class|change_time|change_class|change_level","id":"<slot id for existing-slot ops>","new_trainer":"<name>","new_class":"<class>","new_time":"HH:MM","new_level":"<level>","target":{"location":"...","day_of_week":"...","time":"HH:MM"},"slot":{"location":"...","day_of_week":"...","time":"HH:MM","class_name":"...","trainer_1":"..."},"reason":"specific rule/history justification"}]} '
        "Use swap_trainer for trainer changes, add_class for new schedule rows, remove_class for removals, move_class/change_time for timing changes, change_class for format changes, and change_level for level changes. "
        "Prefer change_class or move_class/change_time when replacing a weak class. Do not use remove_class unless the class should truly disappear from the schedule; if deleting is intentional, set allow_delete true and explain why no replacement is needed. "
        "Hard delete rule: delete only when exact class/trainer/day/time history is weak over time, or when there is a direct same-room/studio conflict. If the issue is a trainer conflict, use swap_trainer instead of deleting. "
        "Hard change rule: change_class, change_time, and move_class require stronger historical evidence for the proposed after-state than the current slot; trainer-specific evidence is best, class/day/time/location evidence is acceptable when trainer-specific history is missing. Do not propose cosmetic 15-minute moves without evidence. If changing both class and trainer, put new_class and new_trainer in the same operation. "
        "Trainer optimisation goals: move Tier 1 trainers closer to 15 weekly hours where constraints allow; every trainer must retain at least 2 days with no assignments; do not schedule a trainer in more than one studio on the same day or shift. "
        "Peak utilisation goal: during 08:00-10:00, 11:00-12:00, and 18:00-19:30, add validated parallel classes where rooms and trainer constraints allow. "
        "For add_class, put full required fields inside slot: location, day_of_week, time, class_name, trainer_1. "
        "If server_vetted_candidate_operations are non-empty, the operations array must contain only operation objects copied from that list; do not invent add_class, remove_class, move_class, or trainer swaps outside that list. "
        "Use the exact numeric string from each slot's id field for existing-slot operations. "
        "Do not invent ids and do not use row numbers outside the provided id field. Use exact trainer names from the roster. "
        "Never assign a trainer not in the roster. Every operation reason must cite at least one of: historic data, universal rules, studio/trainer custom rules, class mix, trainer qualification, or schedule conflict."
    )
    user_prompt = (
        "Active schedule slots JSON. Use only the id value exactly as shown:\n"
        + json.dumps([
            {
                "id": s["id"],
                "location": s["loc"],
                "day": s["day"],
                "time": s["time"],
                "class": s["class"],
                "trainer": s["trainer"],
                "fill": s["fill"],
                "score": s["score"],
            }
            for s in compact
        ], ensure_ascii=False)
        + "\n\nTrainer roster:\n"
        + "\n".join(trainer_summary)
        + "\n\nSaved schedule rules/config JSON:\n"
        + json.dumps({
            "targets": schedule_config.get("targets", {}),
            "custom_rules": schedule_config.get("custom_rules", []),
            "manual_protected": schedule_config.get("manual_protected", []),
            "manual_excluded": schedule_config.get("manual_excluded", []),
        }, ensure_ascii=False)[:12000]
        + "\n\nHistoric score context JSON:\n"
        + json.dumps(scores_context, ensure_ascii=False)[:18000]
        + "\n\nTrainer load context JSON:\n"
        + json.dumps(trainer_load_context, ensure_ascii=False)[:12000]
        + "\n\nPeak slot utilisation context JSON:\n"
        + json.dumps(peak_context, ensure_ascii=False)[:8000]
        + "\n\nServer-vetted candidate operations JSON. If this list is non-empty, return only these exact operation objects; they already passed server validation:\n"
        + json.dumps(candidate_operations, ensure_ascii=False)[:16000]
        + "\n\nReturn JSON object only."
    )

    try:
        import httpx
    except ImportError:
        return {"ok": False, "error": "httpx not installed on server"}

    url = f"{base_url}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {
        "model": model,
        "temperature": 0,
        "max_completion_tokens": int(settings_options.get("ai_optimize_max_tokens") or 4000),
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    try:
        with httpx.Client(timeout=httpx.Timeout(60.0, connect=10.0)) as http:
            resp = http.post(url, headers=headers, json=body)
            if resp.status_code >= 400:
                return {"ok": False, "error": f"AI provider {resp.status_code}: {resp.text[:300]}"}
            data = resp.json()
    except httpx.TimeoutException:
        return {"ok": False, "error": "Optimize AI request timed out after 60s. Try again or shorten scope."}
    except Exception as exc:
        return {"ok": False, "error": f"Optimize call failed: {exc}"}

    try:
        content = (data.get("choices") or [{}])[0].get("message", {}).get("content") or "{}"
        parsed = _parse_optimizer_ai_json(content)
    except Exception as exc:
        return {"ok": False, "error": f"Could not parse AI response: {exc}"}

    operations = parsed.get("operations") or []
    if len(candidate_operations) >= 3:
        vetted_by_key = {
            _operation_candidate_key(item["operation"]): item["operation"]
            for item in candidate_operations
        }
        operations = [
            vetted_by_key[_operation_candidate_key(op)]
            for op in operations
            if _operation_candidate_key(op) in vetted_by_key
        ]
        if not operations:
            operations = [dict(item["operation"]) for item in candidate_operations[:3]]
    applied, rejected = _apply_ai_schedule_operations(
        schedule_data,
        operations,
        compact,
        valid_trainers,
        iteration,
        scores_context,
        schedule_config,
    )
    if operations and not applied and rejected:
        retry_body = dict(body)
        rejection_feedback = [
            {
                "type": item.get("type"),
                "reason": item.get("message") or item.get("reason"),
            }
            for item in rejected[:8]
        ]
        retry_body["messages"] = [
            *body["messages"],
            {
                "role": "user",
                "content": (
                    "Previous operations were all rejected by server validation. "
                    "Return a new JSON object with only operations that avoid these rejection reasons. "
                    "Prefer safe trainer swaps or peak add_class operations with trainers who have no overlap, no same-day cross-studio assignment, and at least 2 days off. "
                    "Do not repeat any operation shape that was rejected.\n"
                    + json.dumps(rejection_feedback, ensure_ascii=False)
                ),
            },
        ]
        try:
            with httpx.Client(timeout=httpx.Timeout(60.0, connect=10.0)) as http:
                retry_resp = http.post(url, headers=headers, json=retry_body)
                if retry_resp.status_code < 400:
                    retry_data = retry_resp.json()
                    retry_content = (retry_data.get("choices") or [{}])[0].get("message", {}).get("content") or "{}"
                    retry_parsed = _parse_optimizer_ai_json(retry_content)
                    retry_operations = retry_parsed.get("operations") or []
                    retry_applied, retry_rejected = _apply_ai_schedule_operations(
                        schedule_data,
                        retry_operations,
                        compact,
                        valid_trainers,
                        iteration,
                        scores_context,
                        schedule_config,
                    )
                    if retry_applied:
                        parsed = retry_parsed
                        operations = retry_operations
                        applied = retry_applied
                        rejected = rejected + retry_rejected
        except Exception:
            pass
    if operations and not applied and rejected:
        fallback_operations = [dict(item["operation"]) for item in candidate_operations[:3]]
        if not fallback_operations:
            fallback_operations = _deterministic_fallback_operations(compact, scores_context, valid_trainers)
        if fallback_operations:
            fallback_applied, fallback_rejected = _apply_ai_schedule_operations(
                schedule_data,
                fallback_operations,
                compact,
                valid_trainers,
                iteration,
                scores_context,
                schedule_config,
            )
            if fallback_applied:
                parsed = {"summary": "Deterministic fallback applied exact-history trainer swap(s)."}
                operations = fallback_operations
                applied = fallback_applied
                rejected = rejected + fallback_rejected

    if applied:
        _write_json_atomic(schedule_path, schedule_data)

    summary = parsed.get("summary") or f"Applied {len(applied)} schedule change(s)."
    return {
        "ok": True,
        "applied": applied,
        "rejected": rejected,
        "applied_count": len(applied),
        "rejected_count": len(rejected),
        "summary": summary,
        "model": model,
    }


def _optimize_schedule_request(payload: dict) -> dict:
    return _run_optimize_with_ai(payload)


def _trainer_profiles_path() -> Path:
    if TRAINER_PROFILES_PATH != DEFAULT_TRAINER_PROFILES_PATH:
        return TRAINER_PROFILES_PATH
    return PROJECT_ROOT / "rules" / "trainer_profiles.json"


def _normalize_pipeline_week(value: str | None, default_week: str) -> str:
    raw = str(value or "").strip() or default_week
    try:
        selected = date.fromisoformat(raw[:10])
    except ValueError as exc:
        raise ValueError("Please choose a valid schedule date.") from exc
    monday = selected - timedelta(days=selected.weekday())
    return monday.isoformat()


def _saved_ai_api_key() -> str:
    try:
        from ai_provider import load_dotenv_if_present
        load_dotenv_if_present()
    except Exception:
        pass
    env_key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if env_key:
        return env_key
    try:
        data = json.loads(_schedule_config_path().read_text())
        settings = data.get("settings_options") or {}
        cfg_key = str(settings.get("ai_optimize_api_key") or settings.get("ai_api_key") or "").strip()
        if cfg_key:
            return cfg_key
    except Exception:
        pass
    return ""


def _saved_deepseek_api_key() -> str:
    return ""


def _saved_ai_runtime_settings() -> dict:
    try:
        data = json.loads(_schedule_config_path().read_text())
    except Exception:
        return {}
    settings = data.get("settings_options") or {}
    return {
        "provider": "openai",
        "model": DEFAULT_OPENAI_MODEL,
        "backup_model": "",
        "base_url": DEFAULT_OPENAI_BASE_URL,
        "ai_api_key": str(settings.get("ai_optimize_api_key") or settings.get("ai_api_key") or "").strip(),
        "deepseek_model": "",
        "deepseek_base_url": "",
        "deepseek_api_key": "",
    }


def _inject_ai_key_env(child_env: dict, api_key: str, provider: str = "openai") -> None:
    key = str(api_key or "").strip()
    if not key:
        return
    child_env["OPENAI_API_KEY"] = key


def _inject_ai_runtime_env(child_env: dict, runtime: dict) -> None:
    for key in (
        "OPENROUTER_API_KEY",
        "OPENROUTER_MODEL",
        "OPENROUTER_BASE_URL",
        "OPENROUTER_BACKUP_MODEL",
        "DEEPSEEK_API_KEY",
        "DEEPSEEK_MODEL",
        "DEEPSEEK_BASE_URL",
        "DEEPSEEK_BACKUP_MODEL",
        "AI_BACKUP_MODEL",
    ):
        child_env.pop(key, None)
    child_env["OPENAI_MODEL"] = DEFAULT_OPENAI_MODEL
    child_env["OPENAI_BASE_URL"] = DEFAULT_OPENAI_BASE_URL


def _request_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _resolve_pipeline_request_options(payload: dict | None, default_week: str) -> dict:
    payload = payload or {}
    week = _normalize_pipeline_week(
        payload.get("week_start") or payload.get("week") or payload.get("date"),
        default_week,
    )
    use_ai = _request_bool(payload.get("use_ai"))
    child_env = os.environ.copy()
    child_env["PIPELINE_WEEK"] = week
    child_env["PYTHONUNBUFFERED"] = "1"

    if use_ai:
        api_key = (
            str(os.environ.get("OPENAI_API_KEY") or "").strip()
            or str(payload.get("api_key") or "").strip()
            or _saved_ai_api_key()
        )
        runtime = _saved_ai_runtime_settings()
        child_env.pop("SCHEDULER_FORCE_GREEDY", None)
        child_env["SCHEDULER_FORCE_AI_ONLY"] = "1"
        child_env.setdefault("SCHEDULER_AI_VARIANTS_PER_LOCATION", "2")
        _inject_ai_key_env(child_env, api_key)
        _inject_ai_runtime_env(child_env, runtime)
    else:
        child_env["SCHEDULER_FORCE_GREEDY"] = "1"
        child_env.pop("SCHEDULER_FORCE_AI_ONLY", None)

    return {"week": week, "use_ai": use_ai, "child_env": child_env}


def _same_schedule_slot(row, slot):
    keys = ("location", "date", "day_of_week", "time", "class_name", "room", "trainer_1")
    return all((row.get(k) or "") == (slot.get(k) or "") for k in keys)


def _slot_minutes(value):
    if not value:
        return 0
    h, m = str(value).split(":")[:2]
    return int(h) * 60 + int(m)


def _slot_duration(slot):
    return int(slot.get("duration_min") or 57)


def _slot_overlap(a, b):
    if (a.get("day_of_week") or "") != (b.get("day_of_week") or ""):
        return False
    a_start = _slot_minutes(a.get("time") or "00:00")
    b_start = _slot_minutes(b.get("time") or "00:00")
    return a_start < b_start + _slot_duration(b) and b_start < a_start + _slot_duration(a)


def _location_region(location):
    if location in MUMBAI_LOCATIONS:
        return "mumbai"
    if location in BENGALURU_LOCATIONS:
        return "bengaluru"
    return location


def _shift_label(time_str):
    return "AM" if _slot_minutes(time_str) < 13 * 60 else "PM"


def _violates_location_shift_lock(slot, trainer_rows):
    loc = slot.get("location") or ""
    day = slot.get("day_of_week") or ""
    shift = _shift_label(slot.get("time") or "00:00")
    slot_min = _slot_minutes(slot.get("time") or "00:00")
    same_shift = [
        (_slot_minutes(r.get("time") or "00:00"), r.get("location") or "")
        for r in trainer_rows
        if r.get("day_of_week") == day and _shift_label(r.get("time") or "00:00") == shift
    ]
    if not same_shift:
        return ""
    if any(_location_region(existing_loc) != _location_region(loc) for _, existing_loc in same_shift):
        return f"{slot.get('trainer_1')} already has a class in another city on {day} {shift}"
    existing_main = {existing_loc for _, existing_loc in same_shift if existing_loc in MAIN_STUDIOS}
    if loc in MAIN_STUDIOS:
        if existing_main and any(existing_loc != loc for existing_loc in existing_main):
            return f"{slot.get('trainer_1')} is already assigned to another main studio on {day} {shift}"
        if any(existing_loc in DERIVED_STUDIOS for _, existing_loc in same_shift):
            return f"{slot.get('trainer_1')} cannot return to a main studio after a pop-up studio on {day} {shift}"
    elif loc in DERIVED_STUDIOS:
        if any(existing_loc in DERIVED_STUDIOS for _, existing_loc in same_shift):
            return f"{slot.get('trainer_1')} already has a pop-up studio assignment on {day} {shift}"
        if any(existing_min > slot_min for existing_min, _ in same_shift):
            return f"{slot.get('trainer_1')} can only take {loc} if it is their final stop on {day} {shift}"
    return ""


def _trainer_profile(name):
    path = _trainer_profiles_path()
    if not path.exists():
        return None
    target = " ".join(str(name or "").split()).lower()
    profiles = json.loads(path.read_text())
    return next((p for p in profiles if " ".join(str(p.get("name") or "").split()).lower() == target), None)


def _profile_location_data(profile, loc):
    locations = profile.get("locations") or {}
    if loc in locations:
        return locations[loc]
    if loc == "Courtside":
        candidates = [locations.get(l) for l in ("Kwality House, Kemps Corner", "Supreme HQ, Bandra") if locations.get(l)]
    elif loc == "Copper & Cloves":
        candidates = [locations.get(l) for l in ("Copper & Cloves", "Kenkere House") if locations.get(l)]
    else:
        candidates = []
    return max(candidates, key=lambda item: item.get("session_count", 0)) if candidates else None


def _manual_class_base(slot):
    if slot.get("is_private_session") and slot.get("private_session_format"):
        return slot.get("private_session_format") or ""
    return slot.get("class_name") or ""


def _qual_key_for_manual_class(class_name):
    lower = str(class_name or "").lower()
    if "powercycle" in lower or "power cycle" in lower:
        return "powercycle"
    if "strength lab" in lower:
        return "strength_lab"
    if "fit" in lower:
        return "fit"
    if "mat 57" in lower:
        return "mat_57"
    if "foundations" in lower:
        return "foundations"
    if "pre/post" in lower or "pre post" in lower or "natal" in lower:
        return "pre_post_natal"
    if "amped" in lower:
        return "amped_up"
    if "hiit" in lower:
        return "hiit"
    if "recovery" in lower:
        return "recovery"
    if "back body blaze" in lower:
        return "back_body_blaze"
    if "cardio barre" in lower:
        return "cardio_barre"
    return "all_barre"


def _trainer_qualified_for_manual_class(profile, class_name):
    q = profile.get("qualifications") or {}
    if not any(bool(v) for v in q.values()):
        return True
    key = _qual_key_for_manual_class(class_name)
    if q.get(key):
        return True
    aliases = {
        "all_barre": ("barre_57", "studio_barre_57", "barre"),
        "cardio_barre": ("cardio", "studio_cardio_barre"),
        "mat_57": ("mat57", "studio_mat_57"),
    }
    if any(q.get(alias) for alias in aliases.get(key, ())):
        return True
    lower = str(class_name or "").lower()
    if "express" in lower and key == "powercycle" and q.get("express_cycle"):
        return True
    if "express" in lower and key in {"all_barre", "cardio_barre", "mat_57"} and q.get("express_barre"):
        return True
    return False


def _manual_class_allowed_at_location(slot):
    loc = slot.get("location") or ""
    class_name = _manual_class_base(slot)
    if not class_name:
        return True
    if "private session" in str(slot.get("class_name") or "").lower() and not slot.get("private_session_format"):
        return True
    if "PowerCycle" in class_name and loc not in MUMBAI_LOCATIONS:
        raise ValueError(f"{class_name} is not enabled for {loc}")
    if "Strength Lab" in class_name and loc != "Kwality House, Kemps Corner":
        raise ValueError(f"{class_name} is not enabled for {loc}")
    cfg_path = PROJECT_ROOT / "config" / "schedule_config.json"
    try:
        cfg = json.loads(cfg_path.read_text()) if cfg_path.exists() else {}
        entry = ((cfg.get("class_mix") or {}).get(loc) or {}).get(class_name) or {}
        if int(entry.get("min", 0) or 0) == 0 and int(entry.get("max", 1) or 0) == 0:
            raise ValueError(f"{class_name} is disabled for {loc} in class mix settings")
    except ValueError:
        raise
    except Exception:
        pass


def _room_overlaps(slot, rows):
    room = (slot.get("room") or "").strip()
    if not room:
        return None
    for r in rows:
        if (r.get("location") or "") != (slot.get("location") or ""):
            continue
        if (r.get("day_of_week") or "") != (slot.get("day_of_week") or ""):
            continue
        if (r.get("room") or "").strip() != room:
            continue
        if _slot_overlap(slot, r):
            return r
    return None


def _validate_manual_slot(data, iteration, slot, original_slot=None, additional_rows=None):
    trainer = slot.get("trainer_1") or ""
    profile = _trainer_profile(trainer)
    if not profile:
        raise ValueError(f"No active trainer profile found for {trainer}")
    if profile.get("active") is False:
        raise ValueError(f"{trainer} is inactive")
    _manual_class_allowed_at_location(slot)
    base_class = _manual_class_base(slot)
    if base_class and "private session" not in base_class.lower() and not _trainer_qualified_for_manual_class(profile, base_class):
        raise ValueError(f"{trainer} is not qualified for {base_class}")
    loc = slot.get("location") or ""
    loc_profile = _profile_location_data(profile, loc)
    if not loc_profile:
        raise ValueError(f"{trainer} is not enabled for {loc}")
    day = slot.get("day_of_week") or ""
    days = loc_profile.get("available_days") or []
    if days and day not in days:
        raise ValueError(f"{trainer} is not available on {day}")
    tw = loc_profile.get("time_window") or {}
    start = tw.get("start", "06:00")
    end = tw.get("end", "22:00")
    slot_start = _slot_minutes(slot.get("time") or "00:00")
    if slot_start < _slot_minutes(start) or slot_start >= _slot_minutes(end):
        raise ValueError(f"{trainer} is outside their time window {start}-{end}")

    rows = []
    if iteration == "Main":
        for loc_rows in (data.get("locations") or {}).values():
            rows.extend(loc_rows or [])
    else:
        for loc_rows in ((data.get("iterations") or {}).get(iteration) or {}).values():
            rows.extend(loc_rows or [])
    rows.extend(additional_rows or [])
    rows = [r for r in rows if not (original_slot and _same_schedule_slot(r, original_slot))]
    trainer_rows = [r for r in rows if (r.get("trainer_1") or "").strip().lower() == trainer.strip().lower()]
    room_conflict = _room_overlaps(slot, rows)
    if room_conflict:
        raise ValueError(
            f"{slot.get('room')} is already occupied at {slot.get('location')} on "
            f"{slot.get('day_of_week')} {slot.get('time')}"
        )

    max_day = int(loc_profile.get("max_classes_per_day") or 4)
    same_day_loc = [r for r in trainer_rows if r.get("location") == loc and r.get("day_of_week") == day]
    if len(same_day_loc) >= max_day:
        raise ValueError(f"{trainer} already has {len(same_day_loc)}/{max_day} classes at {loc} on {day}")
    if any(_slot_overlap(slot, r) for r in trainer_rows):
        raise ValueError(f"{trainer} has an overlapping class on {day}")
    shift = "AM" if slot_start < 13 * 60 else "PM"
    opposite = "PM" if shift == "AM" else "AM"
    if any((r.get("day_of_week") == day) and (("AM" if _slot_minutes(r.get("time")) < 13 * 60 else "PM") == opposite) for r in trainer_rows):
        raise ValueError(f"{trainer} already has an {opposite} class on {day}")
    location_shift_error = _violates_location_shift_lock(slot, trainer_rows)
    if location_shift_error:
        raise ValueError(location_shift_error)
    weekly_minutes = sum(_slot_duration(r) for r in trainer_rows)
    if weekly_minutes + _slot_duration(slot) > 15 * 60:
        raise ValueError(f"{trainer} would exceed the 15h weekly cap")


def _replace_trainer_in_schedule(payload):
    slot = payload.get("slot") or {}
    new_trainer = str(payload.get("new_trainer") or "").strip()
    iteration = payload.get("iteration") or "Main"
    if not new_trainer:
        raise ValueError("Missing replacement trainer")
    required = ("location", "day_of_week", "time", "class_name", "trainer_1")
    missing = [k for k in required if not slot.get(k)]
    if missing:
        raise ValueError(f"Missing slot field(s): {', '.join(missing)}")

    path = WEB_DIR / "schedule_data.json"
    if not path.exists():
        raise FileNotFoundError("web/schedule_data.json was not found")
    data = json.loads(path.read_text())
    new_slot = dict(slot)
    new_slot["trainer_1"] = new_trainer
    if new_slot.get("location") in (MUMBAI_LOCATIONS | BENGALURU_LOCATIONS):
        _validate_manual_slot(data, iteration, new_slot, original_slot=slot)
    updated = 0

    def update_rows(rows):
        nonlocal updated
        if not isinstance(rows, list):
            return
        for row in rows:
            if _same_schedule_slot(row, slot):
                old_trainer = row.get("trainer_1") or ""
                row["replaced_from_trainer"] = old_trainer
                row["trainer_1"] = new_trainer
                row["recommendation"] = "MANUAL"
                row["scheduling_reason"] = (
                    f"Manual trainer replacement: {old_trainer or '—'} → {new_trainer}"
                )
                updated += 1

    if iteration == "Main":
        update_rows((data.get("locations") or {}).get(slot.get("location")))
    else:
        update_rows(((data.get("iterations") or {}).get(iteration) or {}).get(slot.get("location")))

    if updated == 0:
        raise ValueError("Could not find the selected class in the active schedule")

    _write_schedule_data(data)
    return updated


def _add_class_to_schedule(payload):
    slot = payload.get("slot") or {}
    iteration = payload.get("iteration") or "Main"
    required = ("location", "day_of_week", "time", "class_name", "trainer_1")
    missing = [k for k in required if not slot.get(k)]
    if missing:
        raise ValueError(f"Missing slot field(s): {', '.join(missing)}")

    path = WEB_DIR / "schedule_data.json"
    if not path.exists():
        raise FileNotFoundError("web/schedule_data.json was not found")
    data = json.loads(path.read_text())
    slot = dict(slot)
    slot.setdefault("recommendation", "MANUAL")
    slot.setdefault("manual_added", True)
    slot.setdefault("scheduling_reason", "Manual class added from calendar")
    _validate_manual_slot(data, iteration, slot)

    loc = slot["location"]
    if iteration == "Main":
        data.setdefault("locations", {}).setdefault(loc, []).append(slot)
    else:
        data.setdefault("iterations", {}).setdefault(iteration, {}).setdefault(loc, []).append(slot)

    supabase_saved = _write_schedule_data(data)
    return {"added": 1, "supabase_saved": supabase_saved}


def _add_classes_to_schedule(payload):
    slots = payload.get("slots") or []
    iteration = payload.get("iteration") or "Main"
    if not isinstance(slots, list) or not slots:
        raise ValueError("Missing slots")

    path = WEB_DIR / "schedule_data.json"
    if not path.exists():
        raise FileNotFoundError("web/schedule_data.json was not found")
    data = json.loads(path.read_text())

    prepared = []
    pending = []
    for raw in slots:
        slot = dict(raw or {})
        required = ("location", "day_of_week", "time", "class_name", "trainer_1")
        missing = [k for k in required if not slot.get(k)]
        if missing:
            raise ValueError(f"Missing slot field(s): {', '.join(missing)}")
        slot.setdefault("recommendation", "MANUAL")
        slot.setdefault("manual_added", True)
        slot.setdefault("scheduling_reason", "Manual recurring class added from calendar")
        _validate_manual_slot(data, iteration, slot, additional_rows=pending)
        prepared.append(slot)
        pending.append(slot)

    for slot in prepared:
        loc = slot["location"]
        if iteration == "Main":
            data.setdefault("locations", {}).setdefault(loc, []).append(slot)
        else:
            data.setdefault("iterations", {}).setdefault(iteration, {}).setdefault(loc, []).append(slot)

    supabase_saved = _write_schedule_data(data)
    return {"added": len(prepared), "supabase_saved": supabase_saved}


def _save_schedule_to_supabase(data):
    if not supabase_configured():
        return {"saved": False, "error": "Supabase is not configured"}
    try:
        supabase_upsert("saved_schedule", data)
        return {"saved": True, "error": ""}
    except Exception as exc:
        return {"saved": False, "error": str(exc)}


def _write_schedule_data(data):
    path = WEB_DIR / "schedule_data.json"
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2))
    os.replace(tmp, path)
    _regenerate_index_from_template(data)
    return _save_schedule_to_supabase(data)


def _finalise_schedule_to_supabase():
    return finalise_schedule_document(
        supabase_request,
        schedule_path=WEB_DIR / "schedule_data.json",
        outputs_dir=OUTPUTS_DIR,
    )


def _rows_for_iteration(data, iteration, loc):
    if iteration == "Main":
        return data.setdefault("locations", {}).setdefault(loc, [])
    return data.setdefault("iterations", {}).setdefault(iteration, {}).setdefault(loc, [])


def _clear_schedule(payload):
    iteration = (payload or {}).get("iteration") or "Main"
    path = WEB_DIR / "schedule_data.json"
    data = json.loads(path.read_text())
    if iteration == "Main":
        for loc in list((data.get("locations") or {}).keys()):
            data.setdefault("locations", {})[loc] = []
    else:
        for loc in list(((data.get("iterations") or {}).get(iteration) or {}).keys()):
            data.setdefault("iterations", {}).setdefault(iteration, {})[loc] = []
    supabase_saved = _write_schedule_data(data)
    return {"cleared": True, "supabase_saved": supabase_saved}


def _remove_class_from_schedule(payload):
    slot = payload.get("slot") or {}
    iteration = payload.get("iteration") or "Main"
    path = WEB_DIR / "schedule_data.json"
    data = json.loads(path.read_text())
    rows = _rows_for_iteration(data, iteration, slot.get("location"))
    idx = next((i for i, row in enumerate(rows) if _same_schedule_slot(row, slot)), -1)
    if idx < 0:
        raise ValueError("Could not find the selected class in the active schedule")
    rows.pop(idx)
    supabase_saved = _write_schedule_data(data)
    return {"removed": 1, "supabase_saved": supabase_saved}


def _move_class_in_schedule(payload):
    slot = payload.get("slot") or {}
    target = payload.get("target") or {}
    iteration = payload.get("iteration") or "Main"
    for key in ("location", "day_of_week", "time"):
        if not target.get(key):
            raise ValueError(f"Missing target field: {key}")
    path = WEB_DIR / "schedule_data.json"
    data = json.loads(path.read_text())
    rows = _rows_for_iteration(data, iteration, slot.get("location"))
    idx = next((i for i, row in enumerate(rows) if _same_schedule_slot(row, slot)), -1)
    if idx < 0:
        raise ValueError("Could not find the selected class in the active schedule")
    moved = dict(rows.pop(idx))
    moved.update({
        "location": target["location"],
        "date": target.get("date", moved.get("date", "")),
        "day_of_week": target["day_of_week"],
        "time": target["time"],
        "recommendation": "MANUAL",
        "manual_moved": True,
        "scheduling_reason": (
            f"Manual drag/drop move: {slot.get('day_of_week')} {slot.get('time')} → "
            f"{target.get('day_of_week')} {target.get('time')}"
        ),
    })
    _validate_manual_slot(data, iteration, moved, original_slot=slot)
    _rows_for_iteration(data, iteration, target["location"]).append(moved)
    supabase_saved = _write_schedule_data(data)
    return {"moved": 1, "slot": moved, "supabase_saved": supabase_saved}


_DAY_ALIASES = {
    "mon": "Monday", "monday": "Monday",
    "tue": "Tuesday", "tues": "Tuesday", "tuesday": "Tuesday",
    "wed": "Wednesday", "weds": "Wednesday", "wednesday": "Wednesday",
    "thu": "Thursday", "thur": "Thursday", "thurs": "Thursday", "thursday": "Thursday",
    "fri": "Friday", "friday": "Friday",
    "sat": "Saturday", "saturday": "Saturday",
    "sun": "Sunday", "sunday": "Sunday",
}

_CLASS_ALIASES = {
    "mat57": "Studio Mat 57", "mat 57": "Studio Mat 57",
    "barre57": "Studio Barre 57", "barre 57": "Studio Barre 57",
    "cardio barre": "Studio Cardio Barre", "cardiobarre": "Studio Cardio Barre",
    "cardio barre express": "Studio Cardio Barre Express",
    "cardio barre plus": "Studio Cardio Barre Plus",
    "mat express": "Studio Mat 57 Express", "mat57 express": "Studio Mat 57 Express",
    "back body blaze": "Studio Back Body Blaze",
    "bbe": "Studio Back Body Blaze",
    "fit": "Studio FIT",
    "sweat": "Studio SWEAT In 30", "sweat in 30": "Studio SWEAT In 30",
    "powercycle": "Studio PowerCycle", "power cycle": "Studio PowerCycle",
    "cycle": "Studio PowerCycle",
    "strength lab": "Studio Strength Lab",
    "recovery": "Studio Recovery",
    "foundations": "Studio Foundations",
    "amped up": "Studio Amped Up!", "amped": "Studio Amped Up!",
    "barre express": "Studio Barre 57 Express",
}


def _normalize_day(val: str) -> str:
    return _DAY_ALIASES.get(str(val or "").strip().lower(), str(val or "").strip().title())


def _normalize_time(val: str) -> str:
    """Convert '6pm', '6:00pm', '18:00', '18' → 'HH:MM'."""
    import re
    s = str(val or "").strip().lower().replace(" ", "")
    if not s:
        return ""
    m = re.match(r"^(\d{1,2})(?::(\d{2}))?([ap]m)?$", s)
    if not m:
        return val
    hour = int(m.group(1))
    minute = int(m.group(2) or 0)
    meridiem = m.group(3)
    if meridiem == "pm" and hour < 12:
        hour += 12
    elif meridiem == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _normalize_class(val: str, known_classes: list) -> str:
    s = str(val or "").strip()
    key = s.lower()
    if key in _CLASS_ALIASES:
        return _CLASS_ALIASES[key]
    # exact match against known classes (case-insensitive)
    for c in known_classes:
        if c.lower() == key:
            return c
    # partial match: known class contains the alias or vice versa
    for c in known_classes:
        if key in c.lower() or c.lower() in key:
            return c
    return s


def _normalize_trainer(val: str, known_trainers: list) -> str:
    s = str(val or "").strip()
    key = s.lower()
    # exact match
    for t in known_trainers:
        if t.lower() == key:
            return t
    # first-name match ("karan" → "Karanvir Bhatia")
    for t in known_trainers:
        parts = t.lower().split()
        if parts and (parts[0] == key or parts[0].startswith(key) or key.startswith(parts[0])):
            return t
    # partial match anywhere in name
    for t in known_trainers:
        if key in t.lower():
            return t
    return s


def _normalize_location(val: str, known_locations: list) -> str:
    s = str(val or "").strip()
    if not s:
        return s
    key = s.lower()
    for loc in known_locations:
        if loc.lower() == key or key in loc.lower() or loc.lower() in key:
            return loc
    return s


def _load_known_trainers() -> list:
    try:
        profiles = json.loads(_trainer_profiles_path().read_text())
        return [p["name"] for p in profiles if p.get("active") and p.get("name")]
    except Exception:
        return []


def _load_known_classes() -> list:
    try:
        path = PROJECT_ROOT / "rules" / "class_formats.json"
        data = json.loads(path.read_text())
        return [d["name"] for d in data if d.get("name")]
    except Exception:
        return list(_CLASS_ALIASES.values())


def _nl_edit_plan(payload: dict) -> dict:
    """Use AI to parse a natural-language instruction into structured schedule edits."""
    instruction = str((payload or {}).get("instruction") or "").strip()
    if not instruction:
        return {"error": "Empty instruction"}

    schedule_snapshot = (payload or {}).get("schedule_snapshot") or {}
    context = (payload or {}).get("context") or {}
    active_location = str(context.get("location") or "").strip()

    # Load trainer names, availability, and class names for the prompt
    known_trainers = _load_known_trainers()
    known_classes = _load_known_classes()

    # Build trainer availability map: name → {available_days, week_off_days} for active location
    trainer_availability = {}
    try:
        profiles = json.loads(_trainer_profiles_path().read_text())
        for p in profiles:
            if not p.get("active") or not p.get("name"):
                continue
            loc_data = (p.get("locations") or {}).get(active_location) or {}
            if not loc_data and p.get("locations"):
                # fallback: any location
                loc_data = next(iter(p["locations"].values()), {})
            avail = loc_data.get("available_days") or []
            off = loc_data.get("week_off_days") or []
            trainer_availability[p["name"]] = {
                "available": avail,
                "off": off,
            }
    except Exception:
        pass

    # Load current schedule from disk (more reliable than frontend snapshot)
    all_rows = []
    known_locations = []
    try:
        sched_path = WEB_DIR / "schedule_data.json"
        if sched_path.exists():
            sched_data = json.loads(sched_path.read_text())
            known_locations = list((sched_data.get("locations") or {}).keys())
            target_locs = [active_location] if active_location else known_locations
            for loc in target_locs:
                for r in (sched_data.get("locations") or {}).get(loc, []):
                    avg = r.get("metric_avg_checkin") or r.get("historical_avg_checkin") or 0.0
                    fill = r.get("metric_avg_fill_rate") or r.get("historical_avg_fill") or r.get("predicted_fill_rate") or 0.0
                    score = r.get("score") or r.get("optimizer_score") or 0.0
                    all_rows.append(
                        f"{r.get('location',loc)} | {r.get('day_of_week','')} {r.get('time','')} | "
                        f"{r.get('class_name','')} | {r.get('trainer_1','')} | avg_checkin={float(avg):.1f} | fill={float(fill):.0%} | score={float(score):.1f}"
                    )
    except Exception:
        pass

    schedule_text = "\n".join(all_rows[:300]) if all_rows else "No schedule loaded."
    class_list = ", ".join(known_classes) if known_classes else "unknown"
    location_list = ", ".join(known_locations) if known_locations else "unknown"
    active_loc_hint = f" Active location: {active_location}." if active_location else ""

    # Compact trainer availability: "Name (off: Wed, Mon)" or "Name (available: Tue–Sun)"
    avail_lines = []
    for name in known_trainers[:40]:
        av = trainer_availability.get(name, {})
        off_days = av.get("off") or []
        if off_days:
            avail_lines.append(f"{name} (off: {', '.join(off_days)})")
        else:
            avail_lines.append(name)
    trainer_list = "\n".join(avail_lines) if avail_lines else "unknown"

    system_prompt = (
        "You are a studio schedule editor. Parse the user's instruction into structured schedule edits.\n"
        "Return ONLY valid JSON — no markdown fences, no explanation.\n\n"
        "SCHEMA (all fields required, use empty string if not applicable):\n"
        '{"summary":"one-line summary","intent":"clear|unclear","confidence":0.0,'
        '"route_to_optimizer":false,"optimizer_scope":{},'
        '"edits":[{"action":"add|remove|move|swap_trainer",'
        '"location":"EXACT location name","day":"","time":"HH:MM 24h","class_name":"EXACT class name","trainer_1":"EXACT trainer full name",'
        '"new_day":"","new_time":"HH:MM 24h","new_class":"","new_trainer":"",'
        '"best_fit_trainer_candidates":[],"best_fit_class_candidates":[]}],'
        '"warnings":[],"constraint_checks":[]}\n\n'
        "RULES:\n"
        "- action=add: all slot details go under new_day/new_time/new_class/new_trainer; location is required\n"
        "- If user asks to add MULTIPLE classes (e.g., 'create a schedule with 12 classes', 'add 3 cycle classes'), generate MULTIPLE objects in the 'edits' array with action='add', using reasonable spaced out times (e.g., 08:00, 10:00, 12:00) if exact times aren't given.\n"
        "- If trainer is not specified, leave trainer_1 and new_trainer blank.\n"
        "- action=remove: match existing row using day/time/class_name/trainer_1/location\n"
        "- action=move: source in day/time/class_name/trainer_1; destination in new_day/new_time; keep same location unless stated\n"
        "- action=swap_trainer: source in day/time/class_name/trainer_1; replacement in new_trainer\n"
        "- day/new_day: full English day name, title case: Monday Tuesday Wednesday Thursday Friday Saturday Sunday\n"
        "- time/new_time: 24-hour HH:MM format ONLY (18:00 not 6pm)\n"
        f"- class_name/new_class: use EXACT names from this list: {class_list}\n"
        f"- trainer_1/new_trainer: use EXACT full names. Each entry below shows off-days in parentheses:\n{trainer_list}\n"
        f"- location: use EXACT location name from: {location_list}{active_loc_hint}\n"
        "- Resolve short names: 'karan'→'Karanvir Bhatia', 'anisha'→'Anisha Shah', 'rohan'→'Rohan Dahima', 'reshma'→'Reshma Sharma', 'atulan'→'Atulan Purohit', 'pranjali'→'Pranjali Jain', 'vivaran'→'Vivaran Dhasmana', 'mrigakshi'→'Mrigakshi Jaiswal', 'pushyank'→'Pushyank Nahar', 'kajol'→'Kajol Kanchan', 'shruti'→'Shruti Kulkarni'\n"
        "- CRITICAL: If the requested trainer has '(off: <day>)' in their entry and the instruction targets that day, set confidence<0.6, add a warning like 'Karanvir Bhatia is off on Wednesday', and suggest an available alternative in best_fit_trainer_candidates\n"
        "- If location not specified, use the active location\n"
        "- confidence: 0.9+ if all fields unambiguous and trainer is available; 0.5-0.7 if inferred or trainer unavailable; <0.4 if unclear\n"
        "- route_to_optimizer: true ONLY if the user explicitly asks to 'optimize' or 'optimise' a whole day/slot block. DO NOT use this for adding, removing, or creating classes.\n"
        f"\nCURRENT SCHEDULE (location | day time | class | trainer):\n{schedule_text}"
    )

    try:
        from ai_provider import create_ai_client, OPENAI_AVAILABLE
        if not OPENAI_AVAILABLE:
            return {"error": "AI not available"}
        client, settings = create_ai_client()
        if not client:
            return {"error": "AI not configured. Add an OpenAI API key in Settings."}

        resp = client.chat.completions.create(
            model=(settings or {}).get("model") or DEFAULT_OPENAI_MODEL,
            temperature=0.1,
            max_completion_tokens=1500,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": instruction},
            ],
        )
        raw = (resp.choices[0].message.content or "").strip()
        # strip markdown fences if present
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:])
            if raw.endswith("```"):
                raw = raw[:-3].strip()
        result = json.loads(raw)
    except json.JSONDecodeError:
        return {
            "summary": "Could not parse AI response",
            "intent": "unclear",
            "confidence": 0.0,
            "edits": [],
            "warnings": ["AI returned an unstructured response. Try rephrasing your instruction."],
            "constraint_checks": [],
            "route_to_optimizer": False,
        }
    except Exception as exc:
        return {"error": f"AI error: {exc}"}

    # Post-process: normalize fields the AI may have returned in wrong format
    known_trainers_set = known_trainers
    known_classes_set = known_classes
    known_locs = known_locations or [active_location]
    for edit in result.get("edits") or []:
        for day_field in ("day", "new_day"):
            if edit.get(day_field):
                edit[day_field] = _normalize_day(edit[day_field])
        for time_field in ("time", "new_time"):
            if edit.get(time_field):
                edit[time_field] = _normalize_time(edit[time_field])
        for cls_field in ("class_name", "new_class"):
            if edit.get(cls_field):
                edit[cls_field] = _normalize_class(edit[cls_field], known_classes_set)
        for tr_field in ("trainer_1", "new_trainer"):
            if edit.get(tr_field):
                edit[tr_field] = _normalize_trainer(edit[tr_field], known_trainers_set)
        if edit.get("location"):
            edit["location"] = _normalize_location(edit["location"], known_locs)
        else:
            edit["location"] = active_location or (known_locs[0] if known_locs else "")

        # Generate server-side best_fit_trainer_candidates for add/swap actions
        if edit.get("action") in ("add", "swap_trainer"):
            day_target = edit.get("new_day") or edit.get("day") or ""
            time_target = edit.get("new_time") or edit.get("time") or ""
            loc_target = edit.get("location") or ""
            cls_target = edit.get("new_class") or edit.get("class_name") or ""
            requested_trainer = edit.get("new_trainer") or edit.get("trainer_1") or ""
            candidates = _find_trainer_candidates(
                day=day_target, location=loc_target, class_name=cls_target,
                profiles=[], exclude=requested_trainer, time_str=time_target,
            )
            edit["best_fit_trainer_candidates"] = candidates

    return result


def _qual_key(class_name: str) -> str:
    """Map class name to trainer qualification key."""
    n = class_name.lower()
    if "mat 57" in n or "mat57" in n:
        return "mat_57"
    if "barre 57" in n or "barre57" in n:
        return "all_barre"
    if "cardio barre" in n:
        return "cardio_barre"
    if "powercycle" in n or "power cycle" in n:
        return "powercycle"
    if "strength lab" in n:
        return "strength_lab"
    if "foundations" in n:
        return "foundations"
    if "back body blaze" in n:
        return "back_body_blaze"
    if "sweat" in n:
        return "fit"
    if "fit" in n:
        return "fit"
    if "amped" in n:
        return "amped_up"
    if "recovery" in n:
        return "studio_recovery"
    return ""


def _find_trainer_candidates(day: str, location: str, class_name: str, profiles: list,
                              exclude: str = "", time_str: str = "") -> list:
    """Return up to 5 available, qualified trainers for the given day/location/class."""
    try:
        raw_profiles = json.loads(_trainer_profiles_path().read_text())
    except Exception:
        return []

    # Determine shift of the requested time for AM/PM conflict checking
    target_shift = None
    if time_str:
        try:
            hour = int(time_str.split(":")[0])
            target_shift = "AM" if hour < 12 else "PM"
        except Exception:
            pass

    # Load current schedule to detect conflicts
    existing_assignments: dict[str, list[str]] = {}  # trainer → [shift, ...]
    try:
        sched_path = WEB_DIR / "schedule_data.json"
        if sched_path.exists():
            sched = json.loads(sched_path.read_text())
            for loc_rows in (sched.get("locations") or {}).values():
                for r in (loc_rows or []):
                    if r.get("day_of_week") == day:
                        t = r.get("trainer_1") or ""
                        tm = r.get("time") or ""
                        if t and tm:
                            try:
                                h = int(tm.split(":")[0])
                                shift = "AM" if h < 12 else "PM"
                                existing_assignments.setdefault(t, []).append(shift)
                            except Exception:
                                pass
    except Exception:
        pass

    qual_key = _qual_key(class_name)
    results = []
    for p in raw_profiles:
        if not p.get("active"):
            continue
        name = p.get("name") or ""
        if not name or name == exclude:
            continue
        # Check qualification
        if qual_key:
            quals = p.get("qualifications") or {}
            if not quals.get(qual_key):
                continue
        # Check availability at location on day
        loc_data = (p.get("locations") or {}).get(location) or {}
        if not loc_data:
            continue
        available_days = loc_data.get("available_days") or []
        week_off_days = loc_data.get("week_off_days") or []
        if day and (day not in available_days or day in week_off_days):
            continue
        # Check AM/PM same-day conflict
        if target_shift:
            trainer_shifts = existing_assignments.get(name, [])
            if target_shift in trainer_shifts:
                continue  # already teaching this shift on this day
            if trainer_shifts and target_shift not in trainer_shifts:
                continue  # has the other shift — cross-shift not allowed
        results.append({
            "name": name,
            "tier": p.get("tier") or 3,
            "avg_checkin": round(float(loc_data.get("avg_checkin") or 0), 1),
            "avg_fill_rate": round(float(loc_data.get("avg_fill_rate") or 0), 1),
            "session_count": int(loc_data.get("session_count") or 0),
            "available": True,
        })

    results.sort(key=lambda x: (x["tier"], -x["avg_checkin"]))
    return results[:5]


def _nl_edit_apply(payload: dict) -> dict:
    """Apply a list of structured edits returned by /api/nl-edit."""
    edits = (payload or {}).get("edits") or []
    iteration = str((payload or {}).get("iteration") or "Main")
    known_trainers = _load_known_trainers()
    known_classes = _load_known_classes()

    # Collect known locations from schedule
    known_locations = []
    try:
        sched_path = WEB_DIR / "schedule_data.json"
        if sched_path.exists():
            known_locations = list((json.loads(sched_path.read_text()).get("locations") or {}).keys())
    except Exception:
        pass

    def norm(edit: dict) -> dict:
        """Normalize all fields in an edit dict before applying."""
        e = dict(edit)
        for f in ("day", "new_day"):
            if e.get(f):
                e[f] = _normalize_day(e[f])
        for f in ("time", "new_time"):
            if e.get(f):
                e[f] = _normalize_time(e[f])
        for f in ("class_name", "new_class"):
            if e.get(f):
                e[f] = _normalize_class(e[f], known_classes)
        for f in ("trainer_1", "new_trainer"):
            if e.get(f):
                e[f] = _normalize_trainer(e[f], known_trainers)
        if e.get("location"):
            e["location"] = _normalize_location(e["location"], known_locations)
        return e

    applied = 0
    errors = []

    for raw_edit in edits:
        action = str(raw_edit.get("action") or "").strip()
        edit = norm(raw_edit)
        try:
            if action == "add":
                slot = {
                    "location": edit.get("location") or "",
                    "day_of_week": edit.get("new_day") or edit.get("day") or "",
                    "time": edit.get("new_time") or edit.get("time") or "",
                    "class_name": edit.get("new_class") or edit.get("class_name") or "",
                    "trainer_1": edit.get("new_trainer") or edit.get("trainer_1") or "",
                }
                _add_class_to_schedule({"slot": slot, "iteration": iteration})
                applied += 1
            elif action == "remove":
                slot = {
                    "location": edit.get("location") or "",
                    "day_of_week": edit.get("day") or "",
                    "time": edit.get("time") or "",
                    "class_name": edit.get("class_name") or "",
                    "trainer_1": edit.get("trainer_1") or "",
                }
                _remove_class_from_schedule({"slot": slot, "iteration": iteration})
                applied += 1
            elif action == "move":
                slot = {
                    "location": edit.get("location") or "",
                    "day_of_week": edit.get("day") or "",
                    "time": edit.get("time") or "",
                    "class_name": edit.get("class_name") or "",
                    "trainer_1": edit.get("trainer_1") or "",
                }
                target = {
                    "location": edit.get("new_location") or edit.get("location") or "",
                    "day_of_week": edit.get("new_day") or edit.get("day") or "",
                    "time": edit.get("new_time") or edit.get("time") or "",
                }
                _move_class_in_schedule({"slot": slot, "target": target, "iteration": iteration})
                applied += 1
            elif action == "swap_trainer":
                slot = {
                    "location": edit.get("location") or "",
                    "day_of_week": edit.get("day") or "",
                    "time": edit.get("time") or "",
                    "class_name": edit.get("class_name") or "",
                    "trainer_1": edit.get("trainer_1") or "",
                }
                _replace_trainer_in_schedule({
                    "slot": slot,
                    "new_trainer": edit.get("new_trainer") or "",
                    "iteration": iteration,
                })
                applied += 1
            else:
                errors.append({"action": action, "error": f"Unknown action: {action}"})
        except Exception as exc:
            errors.append({"action": action, "slot": edit, "error": str(exc)})

    return {"applied": applied, "errors": errors}


def _regenerate_index_from_template(schedule_data=None):
    from agents.reporter import OPTIMISATION_OPPORTUNITIES, _rules_panel_html

    template_path = WEB_DIR / "template.html"
    schedule_path = WEB_DIR / "schedule_data.json"
    if not template_path.exists() or not schedule_path.exists():
        return
    schedule_json = schedule_path.read_text(encoding="utf-8")
    data = schedule_data or json.loads(schedule_json)
    all_rows = []
    for rows in (data.get("locations") or {}).values():
        all_rows.extend(rows or [])
    first_date = min((r.get("date") for r in all_rows if r.get("date")), default=date.today().isoformat())
    ws = date.fromisoformat(first_date)
    week_start = ws - timedelta(days=ws.weekday())
    week_end = week_start + timedelta(days=6)
    week_label = f"{week_start.strftime('%d %b')} – {week_end.strftime('%d %b %Y')}"
    scorecard_path = OUTPUTS_DIR / "scorecard.json"
    scorecard = json.loads(scorecard_path.read_text(encoding="utf-8")) if scorecard_path.exists() else None
    scorecard_json = json.dumps(scorecard, indent=2) if scorecard else "null"
    html = (
        template_path.read_text(encoding="utf-8")
        .replace("/*INJECT_SCHEDULE_DATA*/", schedule_json)
        .replace("/*INJECT_SCORECARD*/", scorecard_json)
        .replace("/*INJECT_WEEK_LABEL*/", f'"{week_label}"')
        .replace("/*INJECT_OPPORTUNITIES*/", json.dumps(OPTIMISATION_OPPORTUNITIES))
    )
    html = html.replace("</body>", _rules_panel_html() + "\n</body>", 1)
    (WEB_DIR / "index.html").write_text(html, encoding="utf-8")


def _pipeline_process_alive(pid) -> bool:
    if not pid:
        return False
    try:
        pid_int = int(pid)
        os.kill(pid_int, 0)
    except (OSError, TypeError, ValueError):
        return False

    if os.name == "posix":
        try:
            result = subprocess.run(
                ["ps", "-o", "stat=", "-p", str(pid_int)],
                capture_output=True,
                text=True,
                timeout=1,
            )
            stat = result.stdout.strip()
            if stat and stat[0] in {"T", "Z"}:
                return False
        except Exception:
            pass
    return True


def _refresh_pipeline_state() -> None:
    state = _read_pipeline_state()
    if not state.get("running"):
        return
    if _pipeline_process_alive(state.get("pid")):
        return
    
    # Process is no longer alive, but running was still True.
    # We only set it to failed if it wasn't already marked as done or failed.
    state["running"] = False
    if state.get("status") == "running":
        state["status"] = "failed"
        state["message"] = "Previous pipeline process stopped unexpectedly. Generate can be run again."
    state["pid"] = None
    _write_pipeline_state(state)

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
    ".svg": "image/svg+xml",
}


def find_available_port(start_port: int = 8080, host: str = "", max_tries: int = 100) -> int:
    """Return the first bindable port at or above start_port."""
    for port in range(start_port, start_port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, port))
            except OSError:
                continue
            return port
    raise RuntimeError(f"No available port found from {start_port} to {start_port + max_tries - 1}")


def resolve_port(port_arg: str) -> int:
    if str(port_arg).lower() == "auto":
        return find_available_port(8080, host="")
    port = int(port_arg)
    if port == 0:
        return find_available_port(8080, host="")
    return port


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def create_server(port_arg: str) -> tuple[HTTPServer, int]:
    """Create the HTTP server, retrying if an auto-selected port is raced."""
    if str(port_arg).lower() not in {"auto", "0"}:
        port = int(port_arg)
        return ThreadedHTTPServer(("", port), RulesHandler), port

    last_error = None
    start_port = 8080
    for _ in range(100):
        port = find_available_port(start_port, host="")
        try:
            return ThreadedHTTPServer(("", port), RulesHandler), port
        except OSError as exc:
            last_error = exc
            start_port = port + 1
    raise RuntimeError("Could not bind an available port") from last_error


def build_pipeline_command(csv_path: str, week: str, variation_seed: int, output_suffix: str) -> list[str]:
    return [
        sys.executable, str(PROJECT_ROOT / "orchestrator.py"),
        "--csv", csv_path,
        "--week", week,
        "--debug",
        "--variation-seed", str(variation_seed),
        "--output-suffix", output_suffix,
    ]


def is_output_artifact_path(path: str) -> bool:
    """Return true only for generated files that live under outputs/."""
    filename = path.lstrip("/")
    if filename in {"ai_insights.json", "scorecard.json"}:
        return True
    if not filename.startswith("schedule_"):
        return False
    if filename.startswith("schedule_data"):
        return False
    return filename.endswith((".csv", ".xlsx", ".json"))


def supabase_settings() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if url.endswith("/rest/v1"):
        url = url[: -len("/rest/v1")]
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    return url, key


def supabase_configured() -> bool:
    url, key = supabase_settings()
    return bool(url and key)


def supabase_request(method: str, path: str, body=None, prefer: str | None = None):
    url, key = supabase_settings()
    if not url or not key:
        raise RuntimeError("Supabase backend config is missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    payload = json.dumps(body).encode() if body is not None else None
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    elif method != "GET":
        headers["Prefer"] = "return=representation"
    req = urlrequest.Request(f"{url}/rest/v1{path}", data=payload, method=method, headers=headers)
    try:
        with urlrequest.urlopen(req, timeout=20) as resp:
            data = resp.read().decode()
    except urlerror.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        raise RuntimeError(detail or str(exc)) from exc
    return json.loads(data) if data else {}


def supabase_upsert(config_key: str, data):
    return supabase_request(
        "POST",
        "/studio_rules?on_conflict=config_key",
        [{"config_key": config_key, "data": data}],
        "resolution=merge-duplicates,return=representation",
    )


def load_json_file(path: Path, fallback):
    if not path.exists():
        return fallback
    with open(path) as f:
        return json.load(f)


def push_supabase_config():
    schedule_config = load_json_file(
        _schedule_config_path(),
        {"targets": {}, "manual_protected": [], "manual_excluded": [], "custom_rules": []},
    )
    trainer_profiles = load_json_file(_trainer_profiles_path(), [])
    rules_catalog = build_rules_catalog(load_rules_config())
    supabase_upsert("schedule_config", schedule_config)
    supabase_upsert("trainer_profiles", trainer_profiles)
    supabase_upsert("rules_catalog", rules_catalog)
    return {"schedule_config": schedule_config, "trainer_profiles": trainer_profiles, "rules_catalog": rules_catalog}


def pull_supabase_config():
    rows = supabase_request("GET", "/studio_rules?select=config_key,data")
    pulled = {row.get("config_key"): row.get("data") for row in rows if isinstance(row, dict)}
    if pulled.get("schedule_config"):
        path = _schedule_config_path()
        path.parent.mkdir(exist_ok=True)
        path.write_text(json.dumps(pulled["schedule_config"], indent=2))
    if pulled.get("trainer_profiles"):
        _trainer_profiles_path().write_text(json.dumps(pulled["trainer_profiles"], indent=2))
    return pulled


class RulesHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    # Set via class variable from CLI arg
    pipeline_week: str = "2026-05-04"
    pipeline_csv: str = os.environ.get(
        "PIPELINE_SOURCE_URL",
        "https://docs.google.com/spreadsheets/d/16wFlke0bHFcmfn-3UyuYlGnImBq0DY7ouVYAlAFTZys/edit?gid=1313838163#gid=1313838163",
    )

    def log_message(self, format, *args):
        print(f"  [{self.address_string()}] {format % args}")

    def _send(self, code: int, content_type: str, body: bytes):
        try:
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            # Browser polling/navigation can close the socket before a small
            # status or static-file response is written. Nothing is wrong with
            # the pipeline in that case, so keep the dev server quiet.
            return

    def _send_json(self, code: int, data: dict):
        body = json.dumps(data).encode()
        self._send(code, "application/json", body)

    def _is_local_client(self) -> bool:
        host = (self.client_address[0] if self.client_address else "") or ""
        return host in {"127.0.0.1", "::1", "localhost"}

    def _authorized_for_unsafe_write(self) -> bool:
        if self._is_local_client():
            return True
        token = os.environ.get("SCHEDULER_ADMIN_TOKEN", "").strip()
        if not token:
            return False
        provided = self.headers.get("X-Scheduler-Admin-Token", "")
        return provided == token

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        # API: get current rules config
        if path == "/api/rules-config":
            self._send_json(200, build_rules_catalog(load_rules_config()))
            return

        if path == "/api/supabase/status":
            url, key = supabase_settings()
            self._send_json(200, {
                "configured": bool(url and key),
                "has_url": bool(url),
                "has_key": bool(key),
                "url_host": urlparse(url).netloc if url else "",
            })
            return

        # API: pipeline status
        if path == "/api/pipeline-status":
            _refresh_pipeline_state()
            state = _read_pipeline_state()
            msg = state.get("message", "Idle")
            running = state.get("running", False)
            status = state.get("status", "running" if running else "idle")
            self._send_json(200, {
                "running": running,
                "status": status,
                "pid": state.get("pid"),
                "started": state.get("started"),
                "message": msg,
            })
            return

        if path == "/api/latest-schedule-file":
            self._send_json(200, {"file": "schedule_data.json"})
            return

        if path == "/api/source-health":
            try:
                self._send_json(200, DataIngestor(self.pipeline_csv).source_health())
            except Exception as exc:
                self._send_json(500, {"ok": False, "source_url": self.pipeline_csv, "error": str(exc)})
            return

        # API: trainer profiles
        if path == "/api/trainer-profiles":
            profiles_path = PROJECT_ROOT / "rules" / "trainer_profiles.json"
            if profiles_path.exists():
                self._send(200, "application/json", profiles_path.read_bytes())
            else:
                self._send_json(200, [])
            return

        # API: historic slot scores (03_scores.json class_slot_ranking)
        if path == "/api/historic-slots":
            scores_path = PROJECT_ROOT / "state" / "03_scores.json"
            if scores_path.exists():
                self._send(200, "application/json", scores_path.read_bytes())
            else:
                self._send_json(200, {"class_slot_ranking": [], "trainer_metrics": [], "class_metrics": []})
            return

        # API: schedule config (targets, manual protections)
        if path == "/api/schedule-config":
            cfg_path = PROJECT_ROOT / "config" / "schedule_config.json"
            if cfg_path.exists():
                self._send(200, "application/json", cfg_path.read_bytes())
            else:
                default = {"targets": {}, "manual_protected": [], "manual_excluded": [], "custom_rules": []}
                self._send_json(200, default)
            return

        # Serve root → web/index.html
        if path == "/":
            self._serve_file(WEB_DIR / "index.html")
            return

        # Serve outputs/ files (schedule CSVs, XLSXs, JSON)
        if is_output_artifact_path(path):
            filename = path.lstrip("/")
            output_path = _safe_child_path(OUTPUTS_DIR, filename)
            if output_path is None:
                self._send_json(404, {"error": f"Not found: {path}"})
                return
            self._serve_file(output_path)
            return

        # Serve web/ static assets
        rel = path.lstrip("/")
        candidate = _safe_child_path(WEB_DIR, rel)
        if candidate is None:
            self._send_json(404, {"error": f"Not found: {path}"})
            return
        if candidate.exists() and candidate.is_file():
            self._serve_file(candidate)
            return

        self._send_json(404, {"error": f"Not found: {path}"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        length = int(self.headers.get("Content-Length", 0))
        body_raw = self.rfile.read(length) if length else b"{}"

        if not self._authorized_for_unsafe_write():
            self._send_json(401, {"error": "Admin token required"})
            return

        if path == "/api/save-rules":
            try:
                payload = json.loads(body_raw)
            except json.JSONDecodeError as e:
                self._send_json(400, {"error": f"Invalid JSON: {e}"})
                return
            current = update_rules_config(payload)
            catalog = build_rules_catalog(current)
            print("  [API] Rules config saved")
            self._send_json(200, {"ok": True, "config": current, "catalog": catalog})
            return

        if path == "/api/supabase/test":
            try:
                supabase_request("GET", "/studio_rules?limit=1")
                self._send_json(200, {"ok": True})
            except Exception as e:
                self._send_json(500, {"ok": False, "error": str(e)})
            return

        if path == "/api/supabase/push":
            try:
                data = push_supabase_config()
                self._send_json(200, {"ok": True, **data})
            except Exception as e:
                self._send_json(500, {"ok": False, "error": str(e)})
            return

        if path == "/api/supabase/pull":
            try:
                data = pull_supabase_config()
                self._send_json(200, {"ok": True, "data": data})
            except Exception as e:
                self._send_json(500, {"ok": False, "error": str(e)})
            return

        if path == "/api/run-pipeline":
            global _run_counter
            _refresh_pipeline_state()
            state = _read_pipeline_state()
            if state.get("running"):
                self._send_json(200, {
                    "ok": True,
                    "already_running": True,
                    "message": "Pipeline is already running. Please wait.",
                })
                return
            try:
                payload = json.loads(body_raw or "{}")
                options = _resolve_pipeline_request_options(payload, self.pipeline_week)
            except json.JSONDecodeError as e:
                self._send_json(400, {"ok": False, "error": f"Invalid JSON: {e}"})
                return
            except ValueError as e:
                self._send_json(400, {"ok": False, "error": str(e)})
                return
            if options["use_ai"] and not options["child_env"].get("OPENAI_API_KEY"):
                ai_key = _saved_ai_api_key()
                if ai_key:
                    _inject_ai_key_env(options["child_env"], ai_key)
                    _inject_ai_runtime_env(options["child_env"], _saved_ai_runtime_settings())
            if options["use_ai"] and not options["child_env"].get("OPENAI_API_KEY"):
                self._send_json(400, {
                    "ok": False,
                    "error": "Add an AI API key in Control Center before using Generate with AI.",
                })
                return
            _run_counter += 1
            csv_path = self.pipeline_csv
            week = options["week"]
            variation_seed = int(_time.time()) % 100000 + _run_counter
            output_suffix = f"run{_run_counter}_{uuid.uuid4().hex[:6]}"
            cmd = build_pipeline_command(csv_path, week, variation_seed, output_suffix)
            print(
                "  [API] run-pipeline mode="
                f"{'ai' if options['use_ai'] else 'standard'} "
                f"openai_key={'yes' if bool(options['child_env'].get('OPENAI_API_KEY')) else 'no'} "
                f"openai_model={options['child_env'].get('OPENAI_MODEL') or '-'} "
                f"week={week}"
            )
            print(f"  [API] Spawning pipeline: {' '.join(cmd)}")
            try:
                proc = subprocess.Popen(
                    cmd,
                    cwd=str(PROJECT_ROOT),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    env=options["child_env"],
                )
                state = _read_pipeline_state()
                state["running"] = True
                state["status"] = "running"
                state["pid"] = proc.pid
                state["started"] = _time.time()
                state["message"] = "Running — Agent 1: Ingesting data..."
                _write_pipeline_state(state)

                def _monitor(p):
                    stage_markers = [
                        ("Agent 1", "Running — Agent 1: Ingesting data..."),
                        ("Agent 2", "Running — Agent 2: Analysing history..."),
                        ("Agent 3", "Running — Agent 3: Scoring slots..."),
                        ("Agent 4", "Running — Agent 4: Applying rules..."),
                        ("Agent 6", "Running — Agent 6: Building report..."),
                    ]
                    tail = []
                    for line in p.stdout or []:
                        clean = line.rstrip()
                        if not clean:
                            continue
                        print(f"  [PIPELINE] {clean}")
                        tail.append(clean)
                        tail = tail[-20:]
                        
                        s = _read_pipeline_state()
                        if "[Agent 5]" in clean:
                            inner = clean.split("[Agent 5]", 1)[-1].strip()
                            s["message"] = f"Optimising schedule — {inner}"
                            _write_pipeline_state(s)
                            continue
                            
                        for marker, message in stage_markers:
                            if marker in clean:
                                s["message"] = message
                                _write_pipeline_state(s)
                                break
                                
                    p.wait()
                    s = _read_pipeline_state()
                    s["running"] = False
                    if p.returncode == 0:
                        s["status"] = "done"
                        s["message"] = "Complete — reload to see new schedule."
                    else:
                        s["status"] = "failed"
                        detail = next((item for item in reversed(tail) if item.strip()), "")
                        s["message"] = f"Failed (exit {p.returncode}). {detail or 'Check server logs.'}"
                    s["running"] = False
                    s["pid"] = None
                    _write_pipeline_state(s)

                t = threading.Thread(target=_monitor, args=(proc,), daemon=True)
                t.start()

                self._send_json(200, {
                    "ok": True,
                    "pid": proc.pid,
                    "message": "Pipeline started. Results ready in ~2 minutes.",
                })
            except Exception as e:
                s = _read_pipeline_state()
                s["running"] = False
                s["status"] = "failed"
                _write_pipeline_state(s)
                self._send_json(500, {"error": str(e)})
            return

        # API: save trainer profiles
        if path == "/api/save-trainer-profiles":
            try:
                payload = json.loads(body_raw)
                _write_json_atomic(_trainer_profiles_path(), payload)
                print("  [API] Trainer profiles saved")
                self._send_json(200, {"ok": True})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        # API: save schedule config
        if path == "/api/save-schedule-config":
            try:
                payload = json.loads(body_raw)
                # Never persist API keys to disk. Keys must live in env vars only.
                opts = payload.get("settings_options")
                if isinstance(opts, dict):
                    for k in ("deepseek_api_key", "ai_api_key", "ai_optimize_api_key"):
                        if k in opts:
                            opts[k] = ""
                _write_json_atomic(_schedule_config_path(), payload)
                print("  [API] Schedule config saved (api_keys scrubbed)")
                self._send_json(200, {"ok": True})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        # API: one-click trainer replacement for the active generated schedule
        if path == "/api/replace-trainer":
            try:
                payload = json.loads(body_raw)
                updated = _replace_trainer_in_schedule(payload)
                print(f"  [API] Trainer replaced in {updated} schedule row(s)")
                self._send_json(200, {"ok": True, "updated": updated})
            except json.JSONDecodeError as e:
                self._send_json(400, {"error": f"Invalid JSON: {e}"})
            except Exception as e:
                self._send_json(400, {"error": str(e)})
            return

        # API: manually add a class to the active generated schedule
        if path == "/api/add-class":
            try:
                payload = json.loads(body_raw)
                result = _add_class_to_schedule(payload)
                print(f"  [API] Manual class added in {result.get('added', 0)} schedule row(s)")
                self._send_json(200, {"ok": True, **result})
            except json.JSONDecodeError as e:
                self._send_json(400, {"error": f"Invalid JSON: {e}"})
            except Exception as e:
                self._send_json(400, {"error": str(e)})
            return

        # API: manually add recurring classes to the active generated schedule
        if path == "/api/add-classes":
            try:
                payload = json.loads(body_raw)
                result = _add_classes_to_schedule(payload)
                print(f"  [API] Manual classes added in {result.get('added', 0)} schedule row(s)")
                self._send_json(200, {"ok": True, **result})
            except json.JSONDecodeError as e:
                self._send_json(400, {"error": f"Invalid JSON: {e}"})
            except Exception as e:
                self._send_json(400, {"error": str(e)})
            return

        # API: remove a class from the active generated schedule
        if path == "/api/remove-class":
            try:
                payload = json.loads(body_raw)
                result = _remove_class_from_schedule(payload)
                print(f"  [API] Manual class removed in {result.get('removed', 0)} schedule row(s)")
                self._send_json(200, {"ok": True, **result})
            except json.JSONDecodeError as e:
                self._send_json(400, {"error": f"Invalid JSON: {e}"})
            except Exception as e:
                self._send_json(400, {"error": str(e)})
            return

        # API: drag/drop move a class in the active generated schedule
        if path == "/api/move-class":
            try:
                payload = json.loads(body_raw)
                result = _move_class_in_schedule(payload)
                print(f"  [API] Manual class moved in {result.get('moved', 0)} schedule row(s)")
                self._send_json(200, {"ok": True, **result})
            except json.JSONDecodeError as e:
                self._send_json(400, {"error": f"Invalid JSON: {e}"})
            except Exception as e:
                self._send_json(400, {"error": str(e)})
            return

        if path in {"/api/clear-schedule", "/api/clear-calendar"}:
            try:
                payload = json.loads(body_raw or "{}")
                result = _clear_schedule(payload)
                print("  [API] Schedule cleared")
                self._send_json(200, {"ok": True, **result})
            except json.JSONDecodeError as e:
                self._send_json(400, {"error": f"Invalid JSON: {e}"})
            except Exception as e:
                self._send_json(400, {"error": str(e)})
            return

        # API: explicitly save current generated schedule to Supabase
        if path == "/api/save-schedule-supabase":
            try:
                data = json.loads((WEB_DIR / "schedule_data.json").read_text())
                self._send_json(200, {"ok": True, "supabase_saved": _save_schedule_to_supabase(data)})
            except Exception as e:
                self._send_json(400, {"error": str(e)})
            return

        if path == "/api/update-rules-config":
            try:
                payload = json.loads(body_raw)
                config = update_rules_config(payload)
                print(f"  [API] Rules config updated: {len(payload.get('rules', {}))} rule(s)")
                self._send_json(200, {"ok": True, "config": config})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        if path in {"/api/finalise-schedule", "/api/finalize-schedule"}:
            try:
                result = _finalise_schedule_to_supabase()
                self._send_json(200, {"ok": True, "finalised": result})
            except Exception as e:
                self._send_json(400, {"error": str(e)})
            return

        if path == "/api/chat":
            try:
                payload = json.loads(body_raw)
                user_msg = str(payload.get("message") or "").strip()
                history = payload.get("history") or []
                if not user_msg:
                    self._send_json(400, {"error": "Empty message"})
                    return

                system_prompt = build_chat_context(
                    WEB_DIR / "schedule_data.json",
                    OUTPUTS_DIR / "scorecard.json",
                    _trainer_profiles_path(),
                    user_msg,
                )

                # Try AI
                try:
                    import sys
                    sys.path.insert(0, str(PROJECT_ROOT))
                    from ai_provider import create_ai_client, OPENAI_AVAILABLE
                    if not OPENAI_AVAILABLE:
                        self._send_json(200, {"reply": "AI client not available. Install the openai package and set an AI API key to enable chat."})
                        return
                    client, settings = create_ai_client()
                    if not client:
                        # Try reading an OpenAI key from schedule_config.
                        cfg_path = _schedule_config_path()
                        if cfg_path.exists():
                            try:
                                cfg = json.loads(cfg_path.read_text())
                                opts = cfg.get("settings_options") or {}
                                api_key = str(opts.get("ai_optimize_api_key") or opts.get("ai_api_key") or "").strip()
                                if api_key:
                                    from openai import OpenAI
                                    client = OpenAI(api_key=api_key, base_url=DEFAULT_OPENAI_BASE_URL,
                                                   default_headers={"HTTP-Referer":"https://studio-scheduler.local","X-Title":"Studio Scheduler"})
                                    settings = {"model": DEFAULT_OPENAI_MODEL}
                            except Exception:
                                pass
                    if not client:
                        self._send_json(200, {"reply": "AI not configured. Add an AI API key in Settings → Advanced."})
                        return

                    messages = [{"role": "system", "content": system_prompt}]
                    for h in (history or [])[-6:]:
                        role = h.get("role","user")
                        content = h.get("content","")
                        if role in ("user","assistant") and content:
                            messages.append({"role": role, "content": content})
                    messages.append({"role": "user", "content": user_msg})

                    resp = client.chat.completions.create(
                        model=settings.get("model") or DEFAULT_OPENAI_MODEL,
                        temperature=0.4,
                        max_completion_tokens=800,
                        messages=messages,
                    )
                    reply = resp.choices[0].message.content.strip() if resp.choices else "No response from AI."
                    self._send_json(200, {"reply": reply})
                except Exception as ai_err:
                    self._send_json(200, {"reply": f"AI error: {ai_err}"})
            except json.JSONDecodeError as e:
                self._send_json(400, {"error": f"Invalid JSON: {e}"})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        if path in {"/api/optimize-schedule", "/api/optimise-schedule"}:
            try:
                payload = json.loads(body_raw) if body_raw else {}
                result = _optimize_schedule_request(payload)
                status = 200 if result.get("ok") else 400
                self._send_json(status, result)
            except json.JSONDecodeError as e:
                self._send_json(400, {"error": f"Invalid JSON: {e}"})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        if path == "/api/nl-edit":
            try:
                payload = json.loads(body_raw)
                result = _nl_edit_plan(payload)
                self._send_json(200, result)
            except json.JSONDecodeError as e:
                self._send_json(400, {"error": f"Invalid JSON: {e}"})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        if path == "/api/nl-edit-apply":
            try:
                payload = json.loads(body_raw)
                result = _nl_edit_apply(payload)
                self._send_json(200, result)
            except json.JSONDecodeError as e:
                self._send_json(400, {"error": f"Invalid JSON: {e}"})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
            return

        self._send_json(404, {"error": f"Unknown endpoint: {path}"})

    def _serve_file(self, file_path: Path):
        if not file_path.exists():
            self._send_json(404, {"error": f"File not found: {file_path.name}"})
            return
        ext = file_path.suffix.lower()
        content_type = MIME_TYPES.get(ext, "application/octet-stream")
        body = file_path.read_bytes()
        self._send(200, content_type, body)


def main():
    parser = argparse.ArgumentParser(description="Studio Scheduler local web server")
    parser.add_argument("--port", default="auto", help="Port to listen on, or 'auto' to choose from 8080 upward")
    parser.add_argument("--week", default="2026-05-04", help="Default week for pipeline re-run")
    parser.add_argument(
        "--csv",
        default=os.environ.get(
            "PIPELINE_SOURCE_URL",
            "https://docs.google.com/spreadsheets/d/16wFlke0bHFcmfn-3UyuYlGnImBq0DY7ouVYAlAFTZys/edit?gid=1313838163#gid=1313838163",
        ),
        help="Google Sheets URL for pipeline re-run",
    )
    args = parser.parse_args()

    RulesHandler.pipeline_week = args.week
    RulesHandler.pipeline_csv = args.csv

    HTTPServer.allow_reuse_address = True
    server, port = create_server(args.port)
    print(f"\n  Studio Scheduler — serving at http://localhost:{port}")
    print(f"  Pipeline week: {args.week} | Source: {args.csv}")
    print(f"  Rule toggles: http://localhost:{port}  (Rules panel)")
    print(f"  Press Ctrl+C to stop\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Server stopped.")


if __name__ == "__main__":
    main()
