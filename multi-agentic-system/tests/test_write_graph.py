from __future__ import annotations

import shutil
import unittest
from pathlib import Path

try:
    from langgraph.graph import StateGraph  # noqa: F401
    HAS_LANGGRAPH = True
except Exception:
    HAS_LANGGRAPH = False

from testing_agents.config import RuntimeConfig
from testing_agents.schemas import GapPlanItem, WriteResult
from testing_agents.tracing import ConsoleTracer
from testing_agents.graph import build_write_graph


FIXTURE_ROOT = Path(__file__).resolve().parent / "_write_graph_fixture"


class FakeArtifacts:
    def __init__(self) -> None:
        self.payload = None

    def write_json(self, name: str, payload) -> None:
        self.payload = (name, payload)


class FakeRuntime:
    def __init__(self) -> None:
        self.config = RuntimeConfig(
            command="write",
            repo_root=FIXTURE_ROOT,
            project_root=FIXTURE_ROOT,
            artifact_dir=FIXTURE_ROOT / "artifacts",
            verbose=False,
            write_retry_limit=2,
        )
        self.tracer = ConsoleTracer(enabled=False)
        self.artifacts = FakeArtifacts()
        self.write_attempts: list[int] = []
        self.verify_attempts: int = 0

    def write_fix_batch(self, items, failure_feedback=None, attempt: int = 1) -> list[WriteResult]:
        self.write_attempts.append(attempt)
        return [
            WriteResult(
                gap_id=item.gap_id,
                target_file=item.target_file,
                status="written",
                attempts=attempt,
                verification_command=item.target_command,
            )
            for item in items
        ]

    def verify_fix_batch(self, items, write_results: list[WriteResult]):
        self.verify_attempts += 1
        if self.verify_attempts == 1:
            write_results[0].status = "failed"
            write_results[0].verification_status = "failed"
            return write_results, [write_results[0].gap_id], {write_results[0].gap_id: "First attempt failed"}

        write_results[0].verification_status = "passed"
        return write_results, [], {}


class WriteGraphTests(unittest.TestCase):
    def setUp(self) -> None:
        if FIXTURE_ROOT.exists():
            shutil.rmtree(FIXTURE_ROOT)
        FIXTURE_ROOT.mkdir(parents=True)

    def tearDown(self) -> None:
        if FIXTURE_ROOT.exists():
            shutil.rmtree(FIXTURE_ROOT)

    @unittest.skipUnless(HAS_LANGGRAPH, "LangGraph is not installed in this interpreter")
    def test_write_graph_retries_failed_verification_once(self) -> None:
        runtime = FakeRuntime()
        graph = build_write_graph(runtime)  # type: ignore[arg-type]
        gap = GapPlanItem(
            gap_id="g1",
            priority="P0",
            case_type="negative",
            source_file="routes/authRoute.js",
            source_kind="route",
            behavior_summary="POST /login protected route rejection path",
            rationale="Missing negative path coverage",
            suite_type="integration",
            target_file="tests/integration/backend/auth/authRoute.integration.test.js",
            target_command="npm run test:integration -- tests/integration/backend/auth/authRoute.integration.test.js --runInBand",
            append_mode="append",
            coverage_status="uncovered",
            confidence=0.9,
            scenario_summary="exercise failed login path",
        )

        result = graph.invoke(
            {
                "gap_plan": [gap],
                "selected_gap_ids": ["g1"],
                "active_items": [gap],
                "completed_results": [],
                "failed_gap_ids": [],
                "failure_feedback": {},
                "retry_count": 0,
            }
        )

        self.assertEqual(runtime.write_attempts, [1, 2])
        self.assertEqual(result["write_results"][0].verification_status, "passed")
        self.assertEqual(runtime.artifacts.payload[0], "write_report.json")


if __name__ == "__main__":
    unittest.main()
