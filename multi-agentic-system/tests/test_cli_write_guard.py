from __future__ import annotations

import unittest
from pathlib import Path

from testing_agents.cli import _format_write_result, run_write
from testing_agents.config import RuntimeConfig
from testing_agents.schemas import WriteResult


class _FakeLLM:
    def __init__(self, available: bool) -> None:
        self._available = available

    def is_available(self) -> bool:
        return self._available


class _FakeRuntime:
    def __init__(self, available: bool) -> None:
        self.llm = _FakeLLM(available)
        self.artifacts = None

    def health_check(self) -> None:
        return None

    def reset_write_session(self) -> None:
        return None


class CliWriteGuardTests(unittest.TestCase):
    def test_run_write_fails_fast_without_openai_key(self) -> None:
        runtime = _FakeRuntime(available=False)
        config = RuntimeConfig(
            command="write",
            dry_run=False,
            artifact_dir=Path("."),
            project_root=Path("."),
            repo_root=Path("."),
            openai_api_key=None,
        )

        with self.assertRaises(RuntimeError) as ctx:
            run_write(runtime, config)  # type: ignore[arg-type]

        self.assertIn("OPENAI_API_KEY is not set", str(ctx.exception))

    def test_format_write_result_mentions_retry_exhaustion_and_note(self) -> None:
        config = RuntimeConfig(
            command="write",
            write_retry_limit=5,
            artifact_dir=Path("."),
            project_root=Path("."),
            repo_root=Path("."),
        )
        item = WriteResult(
            gap_id="g1",
            target_file="tests/integration/backend/admin/categoryRoutes.integration.test.js",
            status="failed",
            attempts=5,
            verification_status="failed",
            notes=["Cannot find module '../helpers/categoryHelper' from generated test."],
        )

        rendered = _format_write_result(item, config)

        self.assertIn("verification failed after max retries", rendered)
        self.assertIn("attempt 5/5", rendered)
        self.assertIn("Cannot find module", rendered)

    def test_format_write_result_mentions_successful_verification(self) -> None:
        config = RuntimeConfig(
            command="write",
            write_retry_limit=5,
            artifact_dir=Path("."),
            project_root=Path("."),
            repo_root=Path("."),
        )
        item = WriteResult(
            gap_id="g1",
            target_file="tests/integration/backend/auth/authRoute.integration.test.js",
            status="written",
            attempts=2,
            verification_status="passed",
        )

        rendered = _format_write_result(item, config)

        self.assertIn("write succeeded", rendered)
        self.assertIn("verification passed", rendered)
        self.assertIn("attempt 2/5", rendered)


if __name__ == "__main__":
    unittest.main()
