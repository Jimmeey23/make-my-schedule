import json


TRAINERS = {"Richard D'Costa", "Bret Saldanha", "Simonelle De Vitre", "Anmol Sharma"}


def main():
    with open("state/05_draft_schedule.json") as f:
        draft = json.load(f)

    for slot in draft.get("schedule", []):
        trainer = slot.get("trainer_1")
        if trainer in TRAINERS:
            print(f"{slot['day_of_week']} {slot['time']} {trainer} -> {slot.get('scheduling_reason')}")


if __name__ == "__main__":
    main()
