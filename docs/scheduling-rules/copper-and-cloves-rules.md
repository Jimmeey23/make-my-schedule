# Copper & Cloves Scheduling Rules

## Current Output Status

- Current detailed output: `outputs/schedule_copper_&_detailed.csv`
- Current scheduled classes: 7
- Current daily counts: Monday 1, Tuesday 1, Wednesday 1, Thursday 0, Friday 2, Saturday 1, Sunday 1
- Configured daily targets: Monday 1, Tuesday 1, Wednesday 1, Thursday 1, Friday 1, Saturday 2, Sunday 2
- Configured daily max: Monday 3, Tuesday 3, Wednesday 3, Thursday 3, Friday 3, Saturday 3, Sunday 3
- Current status: Thursday, Saturday, and Sunday are below target; Friday is above target but within max.

## Location Guardrails

- Copper & Cloves has no separate location rule file in `rules/`.
- It follows the enabled global rules in `global-scheduling-rules.md`.
- It uses only Copper + Cloves-specific formats in the current class mix configuration.
- Standard Studio formats have min 0 and max 0 at this location.
- There are no enabled manual pins for this location.

## Class Mix Targets

| Class format | Minimum | Maximum |
| --- | ---: | ---: |
| Copper + Cloves Barre 57 | 1 | 6 |
| Copper + Cloves Mat 57 | 1 | 6 |
| Copper + Cloves FIT | 1 | 6 |
| All standard Studio formats | 0 | 0 |

