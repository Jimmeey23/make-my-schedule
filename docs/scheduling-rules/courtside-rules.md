# Courtside Scheduling Rules

## Current Output Status

- Current detailed output: `outputs/schedule_courtsid_detailed.csv`
- Current scheduled classes: 4
- Current daily counts: Monday 2, Tuesday 1, Wednesday 1, Thursday 0, Friday 0, Saturday 0, Sunday 0
- Configured daily targets: Monday 1, Tuesday 1, Wednesday 1, Thursday 0, Friday 1, Saturday 1, Sunday 1
- Configured daily max: Monday 1, Tuesday 1, Wednesday 1, Thursday 1, Friday 1, Saturday 1, Sunday 1
- Current status: Monday is above configured max in the current output; Friday, Saturday, and Sunday are below target.

## Location Guardrails

- Courtside has no separate location rule file in `rules/`.
- It follows the enabled global rules in `global-scheduling-rules.md`.
- PowerCycle, Strength Lab, Back Body Blaze, Recovery, Foundations, Amped Up!, HIIT, and Copper + Cloves formats are disabled by class mix max 0.
- There are no enabled manual pins for this location.

## Class Mix Targets

| Class format | Minimum | Maximum |
| --- | ---: | ---: |
| Studio Barre 57 | 1 | 2 |
| Studio Cardio Barre | 0 | 1 |
| Studio Mat 57 | 0 | 1 |
| Studio FIT | 0 | 1 |
| Studio Barre 57 Express | 0 | 1 |
| Studio Mat 57 Express | 0 | 1 |
| Studio Cardio Barre Express | 0 | 1 |
| Studio FIT Express | 0 | 1 |
| Disabled formats | 0 | 0 |

