from __future__ import annotations

import shutil
import unittest
from pathlib import Path

from testing_agents.agents import AgentRuntime
from testing_agents.config import RuntimeConfig
from testing_agents.schemas import GapPlanItem


FIXTURE_ROOT = Path(__file__).resolve().parent / "_repair_fixture"


class RepairAgentTests(unittest.TestCase):
    def setUp(self) -> None:
        if FIXTURE_ROOT.exists():
            shutil.rmtree(FIXTURE_ROOT)
        FIXTURE_ROOT.mkdir(parents=True)

    def tearDown(self) -> None:
        if FIXTURE_ROOT.exists():
            shutil.rmtree(FIXTURE_ROOT)

    def test_repair_failed_fixes_summarizes_jest_output(self) -> None:
        runtime = AgentRuntime(
            RuntimeConfig(
                command="write",
                repo_root=FIXTURE_ROOT,
                project_root=FIXTURE_ROOT,
                artifact_dir=FIXTURE_ROOT / "artifacts",
                verbose=False,
            )
        )
        plan = GapPlanItem(
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

        repaired = runtime.repair_failed_fixes(
            [plan],
            {
                "g1": "\n".join(
                    [
                        "FAIL tests/integration/backend/auth/authRoute.integration.test.js",
                        "ReferenceError: loginController is not defined",
                        "Expected: 401",
                        "Received: 200",
                    ]
                )
            },
            attempt=1,
        )

        self.assertIn("g1", repaired)
        self.assertIn("ReferenceError", repaired["g1"])
        self.assertIn("Expected: 401", repaired["g1"])


if __name__ == "__main__":
    unittest.main()
