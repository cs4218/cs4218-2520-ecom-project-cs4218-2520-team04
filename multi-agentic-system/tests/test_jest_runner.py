from __future__ import annotations

import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

from testing_agents.tools.jest_runner import JestRunnerTool


class JestRunnerToolTests(unittest.TestCase):
    def test_decode_output_handles_undecodable_bytes(self) -> None:
        tool = JestRunnerTool(Path("."))
        decoded = tool._decode_output(b"ok\x8fbad")
        self.assertEqual(decoded, "ok\ufffdbad")

    def test_run_handles_missing_streams(self) -> None:
        tool = JestRunnerTool(Path("."))
        completed = subprocess.CompletedProcess(
            args="npm run test",
            returncode=1,
            stdout="",
            stderr="",
        )
        with patch.object(tool, "_run_command", return_value=completed):
            status, output = tool.run("npm run test")

        self.assertEqual(status, "failed")
        self.assertEqual(output, "")


if __name__ == "__main__":
    unittest.main()
