# Global Scheduling Rules

Current sources reviewed:

- `config/schedule_config.json`
- `config/rules_config.json`
- `rules/universal_rules.json`
- `outputs/*_detailed.csv`

These rules apply across all locations unless a location-specific rule or saved setting is stricter.

## Generation Settings

- Exact daily targets are enabled.
- Underfilled days may be auto-repaired.
- Soft class-mix overrides are allowed.
- Hard conflict saves are blocked.
- Pipeline validation is required.
- Pinned classes are protected from repair.
- Inactive trainers are hard-blocked.
- Certified format matching is required.
- Default weekly trainer hours cap is 15.
- Tier 1 trainers have a 13 hour weekly minimum target and 15 hour ideal target.
- Maximum assigned trainer time per day is 4 hours.
- Maximum trainer work days per week is 5, but can go up to 6 occasionally if coverage requires it.
- Default maximum classes per trainer per day is 3.
- Assignment days, leave, and off days are enforced.
- Trainer week-off strategy uses historic lowest days.
- Maximum week-off days setting is 2.
- Morning cap is 60% of daily classes.
- AM/PM split enforcement is currently disabled.
- Peak slots are 08:00, 09:00, 11:00, 11:30, 18:00, and 19:15.
- Current planning order is Supreme, Kwality, Copper & Cloves, Kenkere, Courtside.

## Enabled Universal Rules

- Barre 57 family must be at least 25% of total weekly classes at every location.
- Every active studio day should include AM and PM coverage; midday coverage is used where demand and qualified trainers support it.
- Saturday morning should be a high-load window without violating weekly floors, trainer caps, or quality gates.
- Sunday can carry AM and PM coverage when targets require it, but no Sunday class should start before 10:00.
- Specialist classes require certified trainers.
- Express classes must be paired with a full-length equivalent on the same day.
- Studio Recovery must never be the first class of the day.
- Foundations must never be scheduled.
- No trainer may exceed 4 assigned hours in one day.
- PowerCycle must never be scheduled at Kenkere House.
- Strength Lab is only allowed at Kwality House.
- Pre/Post Natal is not auto-scheduled unless manually pinned or saved as a hard custom rule at an eligible location.
- Peak midday slots must not be empty.
- Every active day should prioritize at least one strong Barre 57 family option in the AM block.
- Weekday PM demand windows should prioritize strong Barre 57 or Cardio Barre coverage.
- Primary peak slots should prioritize Tier 1 trainers where qualified and available.
- Trainer substitution follows the configured substitution hierarchy.
- Specialist classes must not be substituted with non-certified trainers.
- Proven low-performing class/trainer/slot histories should not be scheduled unless manually pinned; unsupported formats require explicit custom rules.
- A trainer cannot be scheduled across two locations in the same shift.
- Same class formats must not be scheduled consecutively.
- No classes before 07:00, between 13:00 and 15:00, or after 20:30.
- Every trainer must have at least one weekly off day; two is preferred when coverage allows.
- No trainer may exceed two days without assignments unless unavoidable.
- Recovery sessions must be the last class in their shift at that location.

## Universal Rules Disabled In Current Settings

- Long trainer run avoidance is present in the rulebook but disabled in `config/rules_config.json`.
- Trainer location history as a preference signal is present in the rulebook but disabled in `config/rules_config.json`.

## Manual Overrides

- There are no current manual exclusions.
- There are no current custom rules.
- There are no current leave periods.
- There are no current off days.
- `config/trainer_overrides.json` currently has no active override entries.
