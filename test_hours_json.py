import json


def main():
    with open("rules/trainer_profiles.json") as f:
        profiles = json.load(f)

    tier_map = {p["name"]: p.get("tier", 3) for p in profiles}
    tier_hours = {1: 0, 2: 0, 3: 0}
    trainer_hours = {p["name"]: 0 for p in profiles}

    with open("state/05_draft_schedule.json") as f:
        draft = json.load(f)

    for slot in draft.get("schedule", []):
        trainer = slot.get("trainer_1")
        if trainer in trainer_hours:
            duration = slot.get("duration_min") or 45
            trainer_hours[trainer] += duration
            tier_hours[tier_map[trainer]] += duration

    print(f"Tier 1 Total Hours: {tier_hours[1] / 60:.1f}h")
    print(f"Tier 2 Total Hours: {tier_hours[2] / 60:.1f}h")
    print(f"Tier 3 Total Hours: {tier_hours[3] / 60:.1f}h")

    for trainer in sorted(trainer_hours.keys(), key=lambda x: (-trainer_hours[x], x)):
        if trainer_hours[trainer] > 0:
            print(f"{trainer} (Tier {tier_map[trainer]}): {trainer_hours[trainer] / 60:.1f}h")


if __name__ == "__main__":
    main()
