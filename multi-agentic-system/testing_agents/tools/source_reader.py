from __future__ import annotations

from pathlib import Path

from ..tracing import ConsoleTracer


class SourceReadTool:
    def __init__(self, repo_root: Path, max_chars: int = 14_000, tracer: ConsoleTracer | None = None) -> None:
        self.repo_root = repo_root
        self.max_chars = max_chars
        self.tracer = tracer

    def read(self, relative_path: str) -> str:
        content = (self.repo_root / relative_path).read_text(encoding="utf-8")
        if len(content) <= self.max_chars:
            if self.tracer:
                self.tracer.tool("SourceReadTool.read", relative_path, f"{len(content)} chars")
            return content
        if self.tracer:
            self.tracer.tool("SourceReadTool.read", relative_path, f"truncated from {len(content)} chars")
        return content[: self.max_chars] + "\n... [truncated]"
