#!/usr/bin/env python3
"""
Studio Schedule Optimisation Pipeline — Orchestrator
Runs 6 agents sequentially to produce optimised weekly schedules.
"""
import sys
import json
import traceback
import os
from pathlib import Path

import click
from rich.console import Console

console = Console()

STATE_DIR = Path("state")
DEFAULT_LOCATIONS = [
    "Kwality House, Kemps Corner",
    "Supreme HQ, Bandra",
    "Kenkere House",
    "Courtside",
    "Copper & Cloves",
]


def state_exists(filename: str) -> bool:
    return (STATE_DIR / filename).exists()


@click.command()
@click.option(
    "--csv",
    "csv_path",
    default=os.environ.get(
        "PIPELINE_SOURCE_URL",
        "https://docs.google.com/spreadsheets/d/16wFlke0bHFcmfn-3UyuYlGnImBq0DY7ouVYAlAFTZys/edit?gid=1313838163#gid=1313838163",
    ),
    show_default=True,
    help="Google Sheets URL for sessions data",
)
@click.option(
    "--template",
    "template_path",
    default="Schedule Views - Schedule (6).csv",
    show_default=True,
    help="Schedule template CSV (used for column reference)",
)
@click.option(
    "--week",
    "target_week",
    required=True,
    help="Monday ISO date to schedule (e.g. 2026-05-04)",
)
@click.option(
    "--location",
    "location",
    default=None,
    help="Single location to schedule (omit for all 3)",
)
@click.option(
    "--resume",
    is_flag=True,
    default=False,
    help="Skip agents whose state files already exist",
)
@click.option("--debug", is_flag=True, default=False, help="Enable debug output")
@click.option(
    "--scoring-weights",
    "scoring_weights",
    default=None,
    help='JSON scoring weights override e.g. \'{"fill_rate":0.4,"revenue":0.2,"avg_checkin":0.2,"session_frequency":0.1,"trend":0.1}\'',
)
@click.option(
    "--perf-csv",
    "perf_csv_path",
    default=None,
    show_default=True,
    help="Optional scorer source override. Defaults to the same Google Sheets source passed via --csv.",
)
@click.option(
    "--overrides",
    "overrides_path",
    default=None,
    help="Path to trainer_overrides.json (defaults to config/trainer_overrides.json)",
)
@click.option(
    "--variation-seed",
    "variation_seed",
    type=int,
    default=None,
    help="Optional seed to vary schedule generation (None = auto-seed each run; 0 = deterministic test mode)",
)
@click.option(
    "--output-suffix",
    "output_suffix",
    default="",
    help="Optional suffix for output artifacts",
)
def run_pipeline(
    csv_path, template_path, target_week, location, resume, debug, scoring_weights, overrides_path, perf_csv_path, variation_seed, output_suffix
):
    """Run the full 6-agent studio schedule optimisation pipeline."""
    STATE_DIR.mkdir(exist_ok=True)
    Path("outputs").mkdir(exist_ok=True)

    if location:
        requested_locations = [loc.strip() for loc in str(location).split(",") if loc.strip()]
        locations = requested_locations or DEFAULT_LOCATIONS
    else:
        locations = DEFAULT_LOCATIONS
    perf_csv_path = perf_csv_path or csv_path
    weights = json.loads(scoring_weights) if scoring_weights else None

    console.print(
        f"\n[bold blue]Studio Schedule Optimisation Pipeline[/bold blue]"
    )
    console.print(f"Week: {target_week} | Locations: {len(locations)}\n")

    # Ensure the project root is on sys.path
    sys.path.insert(0, str(Path(__file__).parent))

    # ------------------------------------------------------------------ #
    # Agent 1 — Data Ingestor
    # ------------------------------------------------------------------ #
    if resume and state_exists("01_sessions.json"):
        console.print("[yellow][Agent 1] Ingestor — SKIPPED (resume mode)[/yellow]")
    else:
        try:
            from agents.ingestor import DataIngestor

            ingestor = DataIngestor(csv_path=csv_path)
            ingestor.run()
        except Exception as e:
            console.print(f"[red][Agent 1] FAILED: {e}[/red]")
            if debug:
                traceback.print_exc()
            sys.exit(1)

    # ------------------------------------------------------------------ #
    # Agent 2 — Performance Analyst
    # ------------------------------------------------------------------ #
    if resume and state_exists("02_metrics.json"):
        console.print("[yellow][Agent 2] Analyst — SKIPPED (resume mode)[/yellow]")
    else:
        try:
            from agents.analyst import PerformanceAnalyst

            analyst = PerformanceAnalyst()
            analyst.run()
        except Exception as e:
            console.print(f"[red][Agent 2] FAILED: {e}[/red]")
            if debug:
                traceback.print_exc()
            sys.exit(1)

    # ------------------------------------------------------------------ #
    # Agent 3 — Class Scorer
    # ------------------------------------------------------------------ #
    if resume and state_exists("03_scores.json"):
        console.print("[yellow][Agent 3] Scorer — SKIPPED (resume mode)[/yellow]")
    else:
        try:
            from agents.scorer import ClassScorer

            scorer = ClassScorer(weights=weights, csv_path=perf_csv_path)
            scorer.run()
        except Exception as e:
            console.print(f"[red][Agent 3] FAILED: {e}[/red]")
            if debug:
                traceback.print_exc()
            sys.exit(1)

    # ------------------------------------------------------------------ #
    # Agent 4 — Rule Engine
    # ------------------------------------------------------------------ #
    if resume and state_exists("04_constraints.json"):
        console.print("[yellow][Agent 4] Rule Engine — SKIPPED (resume mode)[/yellow]")
    else:
        try:
            from agents.rule_engine import RuleEngine

            rule_engine = RuleEngine()
            rule_engine.run()
        except Exception as e:
            console.print(f"[red][Agent 4] FAILED: {e}[/red]")
            if debug:
                traceback.print_exc()
            sys.exit(1)

    # ------------------------------------------------------------------ #
    # Agent 5 — AI Schedule Planner (OpenRouter-backed model builds the schedule)
    # Falls back to greedy optimiser if no API key available
    # ------------------------------------------------------------------ #
    if resume and state_exists("05_draft_schedule.json"):
        console.print("[yellow][Agent 5] AI Planner — SKIPPED (resume mode)[/yellow]")
    else:
        console.print("[Agent 5] Running AI Schedule Planner...")
        try:
            from agents.ai_planner import AISchedulePlanner

            planner = AISchedulePlanner(
                target_week_start=target_week,
                locations=locations,
                overrides_path=overrides_path,
                variation_seed=variation_seed,
                output_suffix=output_suffix,
            )
            planner.run()
        except Exception as e:
            console.print(f"[red][Agent 5] AI Planner FAILED: {e}[/red]")
            if debug:
                traceback.print_exc()
            sys.exit(1)

    # ------------------------------------------------------------------ #
    # Agent 5.5 — Hard-rule validator (runs on AI and greedy output alike)
    # ------------------------------------------------------------------ #
    primary_draft = STATE_DIR / f"05_draft_schedule{('_' + output_suffix) if output_suffix else ''}.json"
    if not primary_draft.exists():
        primary_draft = STATE_DIR / "05_draft_schedule.json"
    if not primary_draft.exists():
        console.print("[red][Agent 6] No schedule found — Agent 5 must have failed[/red]")
        sys.exit(1)

    try:
        from agents.schedule_validator import validate_schedule_file

        validation_report = validate_schedule_file(str(primary_draft))
        report_path = STATE_DIR / "06_validation_report.json"
        report_path.write_text(json.dumps(validation_report, indent=2))
        if validation_report["violation_count"]:
            console.print(
                f"[yellow][Agent 5.5] Validator found {validation_report['violation_count']} "
                f"hard-rule violation(s) across {validation_report['slots_with_violations']} slot(s) "
                f"— see {report_path}[/yellow]"
            )
        else:
            console.print("[green][Agent 5.5] Validator — no hard-rule violations found[/green]")
    except Exception as e:
        console.print(f"[red][Agent 5.5] Validator FAILED: {e}[/red]")
        if debug:
            traceback.print_exc()

    # ------------------------------------------------------------------ #
    # Agent 6 — Output Reporter
    # ------------------------------------------------------------------ #
    try:
        from agents.reporter import OutputReporter

        with open(primary_draft) as f:
            draft_data = json.load(f)

        reporter = OutputReporter()
        reporter.run(
            all_schedules=draft_data.get("iterations") or [draft_data],
            primary_draft=draft_data,
        )
    except AssertionError as e:
        console.print(f"[red][Agent 6] Output quality check FAILED: {e}[/red]")
        if debug:
            traceback.print_exc()
        sys.exit(1)
    except Exception as e:
        console.print(f"[red][Agent 6] FAILED: {e}[/red]")
        if debug:
            traceback.print_exc()
        sys.exit(1)

    console.print("\n[bold green]Pipeline complete![/bold green]")
    console.print("Output files:")
    for f in sorted(Path("outputs").iterdir()):
        console.print(f"  {f}")


if __name__ == "__main__":
    run_pipeline()
