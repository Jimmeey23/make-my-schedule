"""Tests that ambiguous chatbot trainer/class picks require user confirmation
rather than silently auto-applying the #1 ranked BEST_FIT candidate."""
import json
import types

from chat_assistant import parse_nl_schedule_edit


def _fake_client(content: str):
    """Fake AI client matching the client.chat.completions.create(...) shape
    used elsewhere in this codebase (see tests/test_ai_provider.py)."""

    class FakeCompletions:
        def create(self, **kwargs):
            return types.SimpleNamespace(
                choices=[
                    types.SimpleNamespace(
                        message=types.SimpleNamespace(content=content)
                    )
                ]
            )

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeClient:
        def __init__(self):
            self.chat = FakeChat()

    return FakeClient()


def test_best_fit_trainer_edit_requires_confirmation(tmp_path):
    metrics_path = tmp_path / "class_metrics.json"
    metrics_path.write_text(json.dumps({
        "class_trainer_slot_metrics": [
            {
                "location": "Kwality House, Kemps Corner",
                "day": 1,
                "time": "18:00",
                "trainer": "Anisha Shah",
                "avg_fill_rate": 0.8,
                "avg_checkin": 8.0,
                "session_count": 20,
            },
            {
                "location": "Kwality House, Kemps Corner",
                "day": 1,
                "time": "18:00",
                "trainer": "Rohan Dahima",
                "avg_fill_rate": 0.6,
                "avg_checkin": 6.0,
                "session_count": 15,
            },
        ]
    }))

    profiles_path = tmp_path / "trainer_profiles.json"
    profiles_path.write_text(json.dumps([
        {
            "name": "Anisha Shah",
            "tier": 1,
            "qualifications": {},
            "locations": {
                "Kwality House, Kemps Corner": {"available_days": ["Tuesday"]}
            },
        },
        {
            "name": "Rohan Dahima",
            "tier": 1,
            "qualifications": {},
            "locations": {
                "Kwality House, Kemps Corner": {"available_days": ["Tuesday"]}
            },
        },
    ]))

    llm_content = json.dumps({
        "edits": [
            {
                "intent": "add",
                "location": "Kwality House, Kemps Corner",
                "new_day": "Tuesday",
                "new_time": "18:00",
                "new_class": "Barre",
                "new_trainer": "BEST_FIT",
            }
        ],
        "warnings": [],
    })
    mock_client = _fake_client(llm_content)

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
    # Auto-fill must NOT happen anymore: the sentinel stays until the user picks.
    assert edit["new_trainer"] == "BEST_FIT"


def test_best_fit_class_edit_requires_confirmation(tmp_path):
    metrics_path = tmp_path / "class_metrics.json"
    metrics_path.write_text(json.dumps({
        "class_trainer_slot_metrics": [
            {
                "location": "Kwality House, Kemps Corner",
                "day": 1,
                "time": "08:00",
                "trainer": "Anisha Shah",
                "class": "Barre",
                "avg_fill_rate": 0.8,
                "avg_checkin": 8.0,
                "session_count": 20,
            },
        ]
    }))
    profiles_path = tmp_path / "trainer_profiles.json"
    profiles_path.write_text(json.dumps([]))

    llm_content = json.dumps({
        "edits": [
            {
                "intent": "swap",
                "location": "Kwality House, Kemps Corner",
                "day": "Monday",
                "time": "08:00",
                "trainer_1": "Anisha Shah",
                "new_class": "BEST_FIT",
            }
        ],
        "warnings": [],
    })
    mock_client = _fake_client(llm_content)

    result = parse_nl_schedule_edit(
        "find the best class for Monday's 8am slot",
        {"locations": {"Kwality House, Kemps Corner": []}},
        {"location": "Kwality House, Kemps Corner", "week": "2026-W20"},
        mock_client,
        "gpt-4",
        metrics_path,
        profiles_path,
    )

    edit = result["edits"][0]
    assert edit["needs_confirmation"] is True
    assert edit["new_class"] == "BEST_FIT"
