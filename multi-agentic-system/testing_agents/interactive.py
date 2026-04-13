from __future__ import annotations

from collections import defaultdict

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

from .schemas import GapPlanItem

init(autoreset=True)


PRIORITY_COLORS = {
    "P0": Fore.RED + Style.BRIGHT,
    "P1": Fore.YELLOW + Style.BRIGHT,
    "P2": Fore.CYAN + Style.BRIGHT,
}


def color_priority(priority: str) -> str:
    return f"{PRIORITY_COLORS.get(priority, Style.BRIGHT)}{priority}{Style.RESET_ALL}"


def format_gap_item(item: GapPlanItem, index: int | None = None) -> str:
    label = f"[{index}] " if index is not None else ""
    suite = f"{Fore.MAGENTA}{item.suite_type}{Style.RESET_ALL}"
    source = f"{Fore.BLUE}{item.source_file}{Style.RESET_ALL}"
    target = f"{Fore.GREEN}{item.target_file}{Style.RESET_ALL}"
    case_color = Fore.RED + Style.BRIGHT if item.case_type == "negative" else Fore.GREEN + Style.BRIGHT
    case_label = f"{case_color}{item.case_type.upper()}{Style.RESET_ALL}"
    title = f"{label}{color_priority(item.priority)} {Style.BRIGHT}{item.behavior_summary}{Style.RESET_ALL}"
    return "\n".join(
        [
            title,
            f"    case:   {case_label}",
            f"    source: {source}",
            f"    target: {target} ({suite})",
            f"    why:    {item.rationale}",
            f"    plan:   {item.scenario_summary}",
        ]
    )


def print_gap_plan(items: list[GapPlanItem]) -> None:
    grouped: dict[str, list[GapPlanItem]] = defaultdict(list)
    for item in items:
        grouped[item.priority].append(item)

    index = 1
    for priority in ("P0", "P1", "P2"):
        bucket = grouped.get(priority, [])
        if not bucket:
            continue
        print(f"\n{color_priority(priority)}")
        print(f"{PRIORITY_COLORS.get(priority, '')}{'-' * len(priority)}{Style.RESET_ALL}")
        for item in bucket:
            print(format_gap_item(item, index=index))
            index += 1


def select_gap_ids(items: list[GapPlanItem], raw: str) -> list[str]:
    token_map = {str(index): item.gap_id for index, item in enumerate(items, start=1)}
    selected: list[str] = []

    for token in [part.strip() for part in raw.split(",") if part.strip()]:
        upper = token.upper()
        if upper == "ALL":
            return [item.gap_id for item in items]
        if upper in {"P0", "P1", "P2"}:
            selected.extend(item.gap_id for item in items if item.priority == upper)
            continue
        if token.startswith("file:"):
            needle = token.split(":", 1)[1]
            selected.extend(item.gap_id for item in items if needle in item.target_file)
            continue
        if token_map.get(token):
            selected.append(token_map[token])

    ordered_unique: list[str] = []
    seen: set[str] = set()
    for gap_id in selected:
        if gap_id not in seen:
            ordered_unique.append(gap_id)
            seen.add(gap_id)
    return ordered_unique


def prompt_for_selection(items: list[GapPlanItem]) -> list[str]:
    print_gap_plan(items)
    print(f"\n{Style.BRIGHT}Selection syntax:{Style.RESET_ALL} 1,3,5 | P0 | P0,P1 | file:controllers/authController | all")
    raw = input(f"{Fore.GREEN}Choose suggested fixes to implement:{Style.RESET_ALL} ").strip()
    return select_gap_ids(items, raw)


def confirm_selection(selected_items: list[GapPlanItem]) -> bool:
    if not selected_items:
        print(f"{Fore.YELLOW}No fixes selected.{Style.RESET_ALL}")
        return False
    print(f"\n{Style.BRIGHT}Selected fixes:{Style.RESET_ALL}")
    for item in selected_items:
        print(f"- {color_priority(item.priority)} {item.gap_id} -> {Fore.GREEN}{item.target_file}{Style.RESET_ALL}")
    answer = input(f"{Fore.GREEN}Apply these fixes? [y/N]:{Style.RESET_ALL} ").strip().lower()
    return answer in {"y", "yes"}
