from __future__ import annotations

from pathlib import Path

from ..tracing import ConsoleTracer


class PatchWriterTool:
    def __init__(self, repo_root: Path, tracer: ConsoleTracer | None = None) -> None:
        self.repo_root = repo_root
        self.tracer = tracer

    def write_test(self, relative_path: str, content: str) -> None:
        target = self.repo_root / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            existing = target.read_text(encoding="utf-8").rstrip()
            updated = existing + "\n\n" + content.strip() + "\n"
            target.write_text(updated, encoding="utf-8")
            if self.tracer:
                self.tracer.tool("PatchWriterTool.write_test", relative_path, "appended")
            return
        target.write_text(content.strip() + "\n", encoding="utf-8")
        if self.tracer:
            self.tracer.tool("PatchWriterTool.write_test", relative_path, "created")
