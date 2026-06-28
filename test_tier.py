import json


def main():
    with open("rules/trainer_profiles.json") as f:
        data = json.load(f)

    for profile in data:
        tier = profile.get("tier")
        print(f"{profile['name']}: tier {tier} type {type(tier)}")


if __name__ == "__main__":
    main()
