from __future__ import annotations

import subprocess
from pathlib import Path

from ..tracing import ConsoleTracer


class JestRunnerTool:
    def __init__(self, repo_root: Path, tracer: ConsoleTracer | None = None) -> None:
        self.repo_root = repo_root
        self.tracer = tracer

    def run(self, command: str) -> tuple[str, str]:
        result = self._run_command(command)
        status = "passed" if result.returncode == 0 else "failed"
        stdout = result.stdout or ""
        stderr = result.stderr or ""
        output = (stdout + "\n" + stderr).strip()
        if self.tracer:
            self.tracer.tool("JestRunnerTool.run", command.split(" -- ")[0], status)
        return status, output

    def _run_command(self, command: str) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            command,
            cwd=self.repo_root,
            capture_output=True,
            text=False,
            shell=True,
        )
        return subprocess.CompletedProcess(
            args=result.args,
            returncode=result.returncode,
            stdout=self._decode_output(result.stdout),
            stderr=self._decode_output(result.stderr),
        )

    def _decode_output(self, payload: bytes | str | None) -> str:
        if payload is None:
            return ""
        if isinstance(payload, str):
            return payload
        return payload.decode("utf-8", errors="replace")
