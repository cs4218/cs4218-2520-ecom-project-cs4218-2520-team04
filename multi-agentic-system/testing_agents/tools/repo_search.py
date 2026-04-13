from __future__ import annotations

import re
import subprocess
from pathlib import Path

from ..tracing import ConsoleTracer


SKIP_DIRS = {
    ".git",
    ".venv",
    ".uv-cache",
    "__pycache__",
    "node_modules",
    "coverage",
    "test-results",
    ".scannerwork",
}


class RepoSearchTool:
    def __init__(self, repo_root: Path, tracer: ConsoleTracer | None = None) -> None:
        self.repo_root = repo_root
        self.tracer = tracer

    def files(self) -> list[str]:
        try:
            result = subprocess.run(
                ["rg", "--files"],
                cwd=self.repo_root,
                text=True,
                capture_output=True,
                check=True,
            )
            files = [line.strip().replace("\\", "/") for line in result.stdout.splitlines() if line.strip()]
            if self.tracer:
                self.tracer.tool("RepoSearchTool.files", ".", f"{len(files)} files via rg")
            return files
        except FileNotFoundError:
            if self.tracer:
                self.tracer.tool("RepoSearchTool.files", ".", "python fallback")
            return self._python_files()

    def search(self, pattern: str, paths: list[str] | None = None) -> list[str]:
        try:
            command = ["rg", "-n", "--color", "never", "--no-heading", pattern]
            if paths:
                command.extend(paths)
            result = subprocess.run(
                command,
                cwd=self.repo_root,
                text=True,
                capture_output=True,
            )
            if result.returncode not in {0, 1}:
                raise RuntimeError(result.stderr.strip() or f"rg failed for pattern: {pattern}")
            matches = [line.strip() for line in result.stdout.splitlines() if line.strip()]
            if self.tracer:
                target = paths[0] if paths and len(paths) == 1 else f"{len(paths)} files" if paths else "."
                self.tracer.tool("RepoSearchTool.search", target, f"{len(matches)} matches")
            return matches
        except FileNotFoundError:
            if self.tracer:
                target = paths[0] if paths and len(paths) == 1 else f"{len(paths)} files" if paths else "."
                self.tracer.tool("RepoSearchTool.search", target, "python fallback")
            return self._python_search(pattern, paths)

    def _python_files(self) -> list[str]:
        files: list[str] = []
        for path in self.repo_root.rglob("*"):
            if not path.is_file():
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            files.append(path.relative_to(self.repo_root).as_posix())
        files = sorted(files)
        if self.tracer:
            self.tracer.tool("RepoSearchTool.files", ".", f"{len(files)} files")
        return files

    def _python_search(self, pattern: str, paths: list[str] | None = None) -> list[str]:
        try:
            regex = re.compile(pattern)
        except re.error:
            regex = re.compile(re.escape(pattern))

        candidate_paths = paths or self._python_files()
        matches: list[str] = []

        for relative_path in candidate_paths:
            file_path = self.repo_root / relative_path
            if not file_path.exists() or not file_path.is_file():
                continue

            try:
                content = file_path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue

            for line_number, line in enumerate(content.splitlines(), start=1):
                if regex.search(line):
                    matches.append(f"{relative_path}:{line_number}:{line}")
        if self.tracer:
            target = paths[0] if paths and len(paths) == 1 else f"{len(paths)} files" if paths else "."
            self.tracer.tool("RepoSearchTool.search", target, f"{len(matches)} matches")
        return matches
