import json


def main():
    with open("rules/trainer_profiles.json") as f:
        profiles = json.load(f)

    for profile in profiles:
        if profile.get("qualifications", {}).get("powercycle"):
            print(f"{profile['name']} (Tier {profile.get('tier', 3)})")


if __name__ == "__main__":
    main()
