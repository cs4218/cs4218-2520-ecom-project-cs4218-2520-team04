from __future__ import annotations

from typing import TypedDict

from .config import RuntimeConfig
from .schemas import GapPlanItem, RepoMap, TestInventory, WriteResult


class GraphState(TypedDict, total=False):
    config: RuntimeConfig
    repo_map: RepoMap
    test_inventory: TestInventory
    gap_plan: list[GapPlanItem]
    selected_gap_ids: list[str]
    active_items: list[GapPlanItem]
    write_results: list[WriteResult]
    completed_results: list[WriteResult]
    failed_gap_ids: list[str]
    failure_feedback: dict[str, str]
    retry_count: int
    notes: list[str]
