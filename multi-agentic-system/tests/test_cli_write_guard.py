from __future__ import annotations

import unittest
from pathlib import Path

from testing_agents.cli import run_write
from testing_agents.config import RuntimeConfig


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


if __name__ == "__main__":
    unittest.main()
