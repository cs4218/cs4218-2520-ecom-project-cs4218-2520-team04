from __future__ import annotations

import os
import shutil
import unittest
from pathlib import Path

from testing_agents.config import RuntimeConfig, load_project_env


FIXTURE_ROOT = Path(__file__).resolve().parent / "_config_env_fixture"


class ConfigEnvTests(unittest.TestCase):
    def setUp(self) -> None:
        if FIXTURE_ROOT.exists():
            shutil.rmtree(FIXTURE_ROOT)
        FIXTURE_ROOT.mkdir(parents=True)
        self.original = {
            "OPENAI_API_KEY": os.environ.get("OPENAI_API_KEY"),
            "OPENAI_SUPERVISOR_MODEL": os.environ.get("OPENAI_SUPERVISOR_MODEL"),
        }
        os.environ.pop("OPENAI_API_KEY", None)
        os.environ.pop("OPENAI_SUPERVISOR_MODEL", None)

    def tearDown(self) -> None:
        if FIXTURE_ROOT.exists():
            shutil.rmtree(FIXTURE_ROOT)
        for key, value in self.original.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def test_load_project_env_applies_before_runtime_config(self) -> None:
        (FIXTURE_ROOT / ".env").write_text(
            "OPENAI_API_KEY=test-key\nOPENAI_SUPERVISOR_MODEL=gpt-5.4-mini\n",
            encoding="utf-8",
        )

        load_project_env(FIXTURE_ROOT)
        config = RuntimeConfig(command="analyze")

        self.assertEqual(config.openai_api_key, "test-key")
        self.assertEqual(config.supervisor_model, "gpt-5.4-mini")


if __name__ == "__main__":
    unittest.main()
