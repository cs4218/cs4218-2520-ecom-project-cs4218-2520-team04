from __future__ import annotations

import unittest
from pathlib import Path

from testing_agents.agents import SupervisorAgent
from testing_agents.config import RuntimeConfig
from testing_agents.llm import OpenAILLM
from testing_agents.schemas import GapPlanItem, InventoryItem, RepoMap, TestInventory
from testing_agents.tracing import ConsoleTracer


class SupervisorAgentTests(unittest.TestCase):
    def setUp(self) -> None:
        root = Path(__file__).resolve().parent
        config = RuntimeConfig(
            command="analyze",
            repo_root=root,
            project_root=root,
            artifact_dir=root / "artifacts",
            verbose=False,
        )
        self.supervisor = SupervisorAgent(config, OpenAILLM(config, tracer=ConsoleTracer(enabled=False)), ConsoleTracer(enabled=False))

    def test_orchestrate_analyze_dispatches_repo_map_first(self) -> None:
        result = self.supervisor.orchestrate_analyze({})
        self.assertEqual(result["next_action"], "repo_cartographer")
        self.assertEqual(result["analyze_stage"], "mapping")

    def test_orchestrate_analyze_dispatches_inventory_after_repo_map(self) -> None:
        state = {"repo_map": RepoMap(source_files=["routes/authRoute.js"])}
        result = self.supervisor.orchestrate_analyze(state)
        self.assertEqual(result["next_action"], "test_inventory")
        self.assertEqual(result["analyze_stage"], "inventory")

    def test_orchestrate_analyze_dispatches_gap_analysis_after_inventory(self) -> None:
        state = {
            "repo_map": RepoMap(source_files=["routes/authRoute.js"]),
            "test_inventory": TestInventory(files=[InventoryItem(path="tests/integration/backend/auth/authRoute.integration.test.js", suite_type="integration", command="npm run test:integration -- <path> --runInBand", reason="fixture")]),
        }
        result = self.supervisor.orchestrate_analyze(state)
        self.assertEqual(result["next_action"], "analyze")
        self.assertEqual(result["analyze_stage"], "gap_analysis")

    def test_orchestrate_analyze_marks_complete_after_gap_plan(self) -> None:
        state = {
            "repo_map": RepoMap(source_files=["routes/authRoute.js"]),
            "test_inventory": TestInventory(),
            "gap_plan": [
                GapPlanItem(
                    gap_id="gap-1",
                    priority="P0",
                    case_type="negative",
                    source_file="routes/authRoute.js",
                    source_kind="route",
                    behavior_summary="POST /login protected route rejection path",
                    rationale="Missing rejection-path coverage.",
                    suite_type="integration",
                    target_file="tests/integration/backend/auth/authRoute.integration.test.js",
                    target_command="npm run test:integration -- tests/integration/backend/auth/authRoute.integration.test.js --runInBand",
                    append_mode="append",
                    coverage_status="uncovered",
                    confidence=0.9,
                    scenario_summary="Verify unauthenticated requests are rejected before controller execution.",
                )
            ],
        }
        result = self.supervisor.orchestrate_analyze(state)
        self.assertEqual(result["next_action"], "complete")
        self.assertEqual(result["analyze_stage"], "complete")


if __name__ == "__main__":
    unittest.main()
