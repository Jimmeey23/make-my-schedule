from agents.optimiser import ScheduleOptimiser


def main():
    opt1 = ScheduleOptimiser("2026-05-11", ["Supreme HQ, Bandra"], variation_seed=123)
    opt2 = ScheduleOptimiser("2026-05-11", ["Supreme HQ, Bandra"], variation_seed=999)

    out1 = opt1.run()
    out2 = opt2.run()

    for i, (slot1, slot2) in enumerate(zip(out1["schedule"], out2["schedule"])):
        if slot1["trainer_1"] != slot2["trainer_1"]:
            print(f"Slot {i}: Seed 1 picked {slot1['trainer_1']}, Seed 2 picked {slot2['trainer_1']}")


if __name__ == "__main__":
    main()
