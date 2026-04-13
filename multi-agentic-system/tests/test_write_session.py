from __future__ import annotations

import shutil
import unittest
from pathlib import Path

from testing_agents.agents import AgentRuntime
from testing_agents.config import RuntimeConfig
from testing_agents.schemas import GapPlanItem


FIXTURE_ROOT = Path(__file__).resolve().parent / "_write_session_fixture"


class WriteSessionTests(unittest.TestCase):
    def setUp(self) -> None:
        if FIXTURE_ROOT.exists():
            shutil.rmtree(FIXTURE_ROOT)
        FIXTURE_ROOT.mkdir(parents=True)
        (FIXTURE_ROOT / "routes").mkdir(parents=True, exist_ok=True)
        (FIXTURE_ROOT / "tests/integration/backend/admin").mkdir(parents=True, exist_ok=True)
        (FIXTURE_ROOT / "routes/categoryRoutes.js").write_text(
            "export default function categoryRoutes() { return 'ok'; }\n",
            encoding="utf-8",
        )
        (FIXTURE_ROOT / "tests/integration/backend/admin/categoryRoutes.integration.test.js").write_text(
            "import request from 'supertest';\n\ndescribe('existing suite', () => {});\n",
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        if FIXTURE_ROOT.exists():
            shutil.rmtree(FIXTURE_ROOT)

    def test_retry_rewrites_from_original_baseline_instead_of_appending_previous_attempt(self) -> None:
        runtime = AgentRuntime(
            RuntimeConfig(
                command="write",
                repo_root=FIXTURE_ROOT,
                project_root=FIXTURE_ROOT,
                artifact_dir=FIXTURE_ROOT / "artifacts",
                verbose=False,
                openai_api_key=None,
            )
        )
        runtime.reset_write_session()

        plan = GapPlanItem(
            gap_id="g1",
            priority="P0",
            case_type="negative",
            source_file="routes/categoryRoutes.js",
            source_kind="route",
            behavior_summary="POST /create-category protected route rejection path",
            rationale="Missing negative path coverage",
            suite_type="integration",
            target_file="tests/integration/backend/admin/categoryRoutes.integration.test.js",
            target_command="npm run test:integration -- tests/integration/backend/admin/categoryRoutes.integration.test.js --runInBand",
            append_mode="append",
            coverage_status="uncovered",
            confidence=0.9,
            scenario_summary="exercise protected create-category rejection path",
        )

        runtime.write_fix_batch([plan], attempt=1)
        first_content = (FIXTURE_ROOT / plan.target_file).read_text(encoding="utf-8")
        runtime.write_fix_batch([plan], failure_feedback={"g1": "Revise the generated test."}, attempt=2)
        second_content = (FIXTURE_ROOT / plan.target_file).read_text(encoding="utf-8")

        self.assertEqual(second_content.count('describe("Generated coverage for categoryRoutes"'), 1)
        self.assertTrue(second_content.startswith("import request from 'supertest';"))
        self.assertEqual(first_content, second_content)


if __name__ == "__main__":
    unittest.main()
