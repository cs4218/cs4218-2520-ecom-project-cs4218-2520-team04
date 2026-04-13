from __future__ import annotations

import argparse
import os
from pathlib import Path

try:
    from colorama import Fore, Style, init
except ImportError:  # pragma: no cover - fallback for plain python runs without synced deps
    class _ColorFallback:
        BLACK = ""
        BLUE = ""
        CYAN = ""
        GREEN = ""
        MAGENTA = ""
        RED = ""
        WHITE = ""
        YELLOW = ""
        RESET_ALL = ""
        BRIGHT = ""

    Fore = Style = _ColorFallback()

    def init(*args, **kwargs) -> None:
        return None

from .agents import AgentRuntime
from .config import RuntimeConfig, load_project_env
from .graph import build_analyze_graph, build_write_graph
from .interactive import color_priority, confirm_selection, format_gap_item, prompt_for_selection
from .schemas import GapPlanItem

init(autoreset=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Multi-agentic testing system CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    for command in ("analyze", "write"):
        subparser = subparsers.add_parser(command)
        subparser.add_argument("--limit", type=int, default=25)
        subparser.add_argument("--domain", choices=("backend", "frontend", "all"), default="all")
        subparser.add_argument("--suite", choices=("unit", "integration", "all"), default="all")
        subparser.add_argument("--priority", choices=("P0", "P1", "P2"))
        subparser.add_argument("--dry-run", action="store_true")
        subparser.add_argument("--quiet", action="store_true")
        subparser.add_argument("--artifact-dir", type=Path)
        subparser.add_argument("--paths", nargs="*", default=())

    return parser


def config_from_args(args: argparse.Namespace) -> RuntimeConfig:
    project_root = Path(__file__).resolve().parent.parent
    load_project_env(project_root)
    artifact_dir = args.artifact_dir or project_root / "artifacts"
    os.environ.setdefault("UV_CACHE_DIR", str(project_root / ".uv-cache"))
    return RuntimeConfig(
        command=args.command,
        artifact_dir=artifact_dir,
        limit=args.limit,
        domain=args.domain,
        suite=args.suite,
        priority=args.priority,
        dry_run=args.dry_run,
        verbose=not args.quiet,
        paths=tuple(args.paths),
    )


def run_analyze(runtime: AgentRuntime, config: RuntimeConfig) -> int:
    runtime.health_check()
    graph = build_analyze_graph(runtime)
    result = graph.invoke({"config": config})
    gap_plan: list[GapPlanItem] = result["gap_plan"]
    print(
        f"{Fore.GREEN}{Style.BRIGHT}Analyze complete:{Style.RESET_ALL} "
        f"{len(gap_plan)} planned fixes written to {Fore.BLUE}{config.artifact_dir / 'gap_plan.json'}{Style.RESET_ALL}"
    )
    print(f"{Style.BRIGHT}Top planned fixes:{Style.RESET_ALL}")
    for item in gap_plan[:10]:
        print(format_gap_item(item))
    return 0


def run_write(runtime: AgentRuntime, config: RuntimeConfig) -> int:
    runtime.health_check()
    if not config.dry_run and not runtime.llm.is_available():
        raise RuntimeError(
            "OPENAI_API_KEY is not set. The write stage now fails fast instead of generating placeholder tests. "
            "Set the key in your shell or in multi-agentic-system/.env and rerun."
        )
    artifact_path = config.artifact_dir / "gap_plan.json"
    if not artifact_path.exists():
        print(f"{Fore.YELLOW}No gap_plan.json found, running analyze first.{Style.RESET_ALL}")
        run_analyze(runtime, config)

    gap_plan = [GapPlanItem(**item) for item in runtime.artifacts.read_json("gap_plan.json")]
    selected_gap_ids = prompt_for_selection(gap_plan)
    selected_items = [item for item in gap_plan if item.gap_id in selected_gap_ids]
    if not confirm_selection(selected_items):
        print(f"{Fore.YELLOW}Write cancelled.{Style.RESET_ALL}")
        return 0

    graph = build_write_graph(runtime)
    result = graph.invoke(
        {
            "config": config,
            "gap_plan": gap_plan,
            "selected_gap_ids": selected_gap_ids,
            "active_items": selected_items,
            "completed_results": [],
            "failed_gap_ids": [],
            "failure_feedback": {},
            "retry_count": 0,
        }
    )
    write_results = result["write_results"]
    print(f"{Fore.GREEN}{Style.BRIGHT}Write complete:{Style.RESET_ALL} {len(write_results)} fixes processed.")
    for item in write_results:
        print(_format_write_result(item, config))
    return 0


def _format_write_result(item, config: RuntimeConfig) -> str:
    verification = item.verification_status or "not-run"
    verification_color = Fore.GREEN if verification == "passed" else Fore.YELLOW if verification == "not-run" else Fore.RED
    status_color = Fore.GREEN if item.status in {"written", "dry-run"} else Fore.RED
    retry_budget = max(1, config.write_retry_limit)
    attempt_summary = f"attempt {item.attempts}/{retry_budget}"

    if item.status == "dry-run":
        headline = f"{status_color}dry-run{Style.RESET_ALL} ({verification_color}{verification}{Style.RESET_ALL})"
    elif verification == "passed":
        headline = f"{status_color}write succeeded{Style.RESET_ALL} ({verification_color}verification passed{Style.RESET_ALL}, {attempt_summary})"
    elif verification == "failed":
        if item.attempts >= retry_budget and not config.dry_run:
            headline = (
                f"{Fore.RED}write succeeded but verification failed after max retries{Style.RESET_ALL} "
                f"({verification_color}{attempt_summary}{Style.RESET_ALL})"
            )
        else:
            headline = (
                f"{Fore.RED}write succeeded but verification failed{Style.RESET_ALL} "
                f"({verification_color}{attempt_summary}{Style.RESET_ALL})"
            )
    else:
        headline = f"{status_color}{item.status}{Style.RESET_ALL} ({verification_color}{verification}{Style.RESET_ALL}, {attempt_summary})"

    lines = [f"- {Fore.BLUE}{item.target_file}{Style.RESET_ALL}: {headline}"]
    if item.notes:
        detail = " ".join(part.strip() for part in item.notes if part.strip())
        if detail:
            lines.append(f"  {Fore.YELLOW}note:{Style.RESET_ALL} {detail}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    config = config_from_args(args)
    runtime = AgentRuntime(config)
    if args.command == "analyze":
        return run_analyze(runtime, config)
    return run_write(runtime, config)
