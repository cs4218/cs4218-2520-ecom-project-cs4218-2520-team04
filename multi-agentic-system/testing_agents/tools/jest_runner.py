from __future__ import annotations

import subprocess
from pathlib import Path

from ..tracing import ConsoleTracer


class JestRunnerTool:
    def __init__(self, repo_root: Path, tracer: ConsoleTracer | None = None) -> None:
        self.repo_root = repo_root
        self.tracer = tracer

    def run(self, command: str) -> tuple[str, str]:
        result = subprocess.run(
            command,
            cwd=self.repo_root,
            text=True,
            capture_output=True,
            shell=True,
        )
        status = "passed" if result.returncode == 0 else "failed"
        output = (result.stdout + "\n" + result.stderr).strip()
        if self.tracer:
            self.tracer.tool("JestRunnerTool.run", command.split(" -- ")[0], status)
        return status, output
