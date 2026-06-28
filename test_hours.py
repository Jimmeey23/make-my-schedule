import csv
import json
from pathlib import Path


def main():
    with open("rules/trainer_profiles.json") as f:
        profiles = json.load(f)

    tier_map = {p["name"]: p.get("tier", 3) for p in profiles}
    tier_hours = {1: 0, 2: 0, 3: 0}
    trainer_hours = {p["name"]: 0 for p in profiles}

    if Path("outputs/schedule_combined.csv").exists():
        with open("outputs/schedule_combined.csv") as f:
            reader = csv.DictReader(f)
            for row in reader:
                trainer = row.get("Trainer 1") or row.get("trainer_1")
                duration = int(row.get("Duration Min") or row.get("duration_min") or 0)
                if not duration:
                    class_name = row.get("Class") or row.get("class_name") or ""
                    duration = 57 if "57" in class_name else 45
                if trainer in trainer_hours:
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
