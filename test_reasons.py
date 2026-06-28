import csv


TRAINERS = {"Richard D'Costa", "Bret Saldanha", "Simonelle De Vitre", "Anmol Sharma"}


def main():
    with open("outputs/schedule_supreme_detailed.csv") as f:
        reader = csv.DictReader(f)
        for row in reader:
            trainer = row.get("Trainer 1")
            if trainer in TRAINERS:
                reason = row.get("Scheduling Reason") or row.get("Reason") or ""
                print(f"{row['Date']} {row['Time']} {trainer} -> {reason}")


if __name__ == "__main__":
    main()
