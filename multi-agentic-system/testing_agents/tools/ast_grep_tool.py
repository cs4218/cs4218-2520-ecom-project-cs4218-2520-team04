from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from ..tracing import ConsoleTracer


class AstGrepTool:
    def __init__(self, repo_root: Path, binary: str = "ast-grep", tracer: ConsoleTracer | None = None) -> None:
        self.repo_root = repo_root
        self.binary = binary
        self.tracer = tracer

    def ensure_available(self) -> None:
        result = self._run_command([self.binary, "--version"])
        if result.returncode != 0:
            raise RuntimeError(
                "ast-grep is required but not available on PATH. "
                "Install it with `uv sync`, `pip install ast-grep-cli`, or your preferred package manager."
            )
        if self.tracer:
            self.tracer.tool("AstGrepTool.ensure_available", ".", "available")

    def run_pattern(
        self,
        pattern: str,
        paths: list[str],
        lang: str | None = None,
    ) -> list[dict[str, Any]]:
        command = [self.binary, "run", "--pattern", pattern, "--json=stream"]
        if lang:
            command.extend(["--lang", lang])
        command.extend(paths)
        result = self._run_command(command)
        stdout = result.stdout or ""
        stderr = result.stderr or ""
        if result.returncode == 1 and not stdout.strip():
            return []
        if "Cannot parse query as a valid pattern" in stderr:
            return []
        if result.returncode not in {0, 1}:
            raise RuntimeError(stderr.strip() or f"ast-grep failed for pattern: {pattern}")

        matches: list[dict[str, Any]] = []
        for line in stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                matches.append(json.loads(line))
            except json.JSONDecodeError:
                if self.tracer:
                    target = paths[0] if len(paths) == 1 else f"{len(paths)} files"
                    self.tracer.tool("AstGrepTool.run_pattern", target, "skipped malformed json line")
                continue
        if self.tracer:
            target = paths[0] if len(paths) == 1 else f"{len(paths)} files"
            self.tracer.tool("AstGrepTool.run_pattern", target, f"{len(matches)} matches")
        return matches

    def _run_command(self, command: list[str]) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            command,
            cwd=self.repo_root,
            capture_output=True,
            text=False,
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
