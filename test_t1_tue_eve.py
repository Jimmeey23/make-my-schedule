import json


def main():
    with open("rules/trainer_profiles.json") as f:
        profiles = json.load(f)

    for profile in profiles:
        if profile.get("tier", 3) == 1:
            locations = profile.get("locations", {})
            for location_name, location_data in locations.items():
                days = location_data.get("available_days", [])
                window = location_data.get("time_window", {})
                end = window.get("end", "22:00")
                if "Tuesday" in days and end >= "19:00":
                    print(f"{profile['name']} is available at {location_name} on Tuesday until {end}")


if __name__ == "__main__":
    main()
