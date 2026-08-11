import base64
import json
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Callable

from report_pdf import build_schedule_report_pdf


PROJECT_ROOT = Path(__file__).parent
WEB_DIR = PROJECT_ROOT / "web"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"


def _week_bounds(schedule_data: dict) -> tuple[str, str, str]:
    rows = [
        row
        for loc_rows in (schedule_data.get("locations") or {}).values()
        for row in (loc_rows or [])
        if row.get("date")
    ]
    first_date = min((row["date"] for row in rows), default=date.today().isoformat())
    start = date.fromisoformat(first_date)
    week_start = start - timedelta(days=start.weekday())
    week_end = week_start + timedelta(days=6)
    label = f"{week_start.strftime('%d %b')} - {week_end.strftime('%d %b %Y')}"
    return week_start.isoformat(), week_end.isoformat(), label


def _summary(schedule_data: dict) -> dict:
    by_location = {}
    trainer_counts = defaultdict(int)
    total = 0
    for location, rows in (schedule_data.get("locations") or {}).items():
        rows = rows or []
        by_location[location] = len(rows)
        total += len(rows)
        for row in rows:
            if row.get("trainer_1"):
                trainer_counts[row["trainer_1"]] += 1
    return {
        "total_classes": total,
        "classes_by_location": by_location,
        "classes_by_trainer": dict(sorted(trainer_counts.items())),
    }


def finalise_schedule_document(
    supabase_request: Callable[..., Any],
    schedule_path: Path | None = None,
    outputs_dir: Path | None = None,
) -> dict:
    schedule_path = schedule_path or (WEB_DIR / "schedule_data.json")
    outputs_dir = outputs_dir or OUTPUTS_DIR
    if not schedule_path.exists():
        raise FileNotFoundError("web/schedule_data.json was not found")

    schedule_data = json.loads(schedule_path.read_text(encoding="utf-8"))
    week_start, week_end, week_label = _week_bounds(schedule_data)
    pdf_bytes = build_schedule_report_pdf(schedule_data, week_label)
    outputs_dir.mkdir(exist_ok=True)
    filename = f"finalised_schedule_{week_start}.pdf"
    local_path = outputs_dir / filename
    local_path.write_bytes(pdf_bytes)

    payload = {
        "week_start": week_start,
        "week_end": week_end,
        "status": "finalised",
        "file_name": filename,
        "mime_type": "application/pdf",
        "file_base64": base64.b64encode(pdf_bytes).decode("ascii"),
        "schedule_data": schedule_data,
        "summary": _summary(schedule_data),
    }
    row = supabase_request(
        "POST",
        "/finalised_schedules?on_conflict=week_start",
        [payload],
        "resolution=merge-duplicates,return=representation",
    )
    public_id = row[0].get("id") if isinstance(row, list) and row else None
    return {
        "week_start": week_start,
        "week_end": week_end,
        "file_name": filename,
        "local_path": str(local_path),
        "supabase_id": public_id,
        "bytes": len(pdf_bytes),
    }
