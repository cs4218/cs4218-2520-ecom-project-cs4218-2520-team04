from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = PACKAGE_ROOT.parent
DEFAULT_REPO_ROOT = PROJECT_ROOT.parent


@dataclass(slots=True)
class RuntimeConfig:
    command: str
    repo_root: Path = DEFAULT_REPO_ROOT
    project_root: Path = PROJECT_ROOT
    artifact_dir: Path = PROJECT_ROOT / "artifacts"
    supervisor_model: str = os.environ.get("OPENAI_SUPERVISOR_MODEL", "gpt-5.4-mini")
    worker_model: str = os.environ.get("OPENAI_WORKER_MODEL", "gpt-5.4-nano")
    openai_api_key: str | None = os.environ.get("OPENAI_API_KEY")
    ast_grep_bin: str = os.environ.get("AST_GREP_BIN", "ast-grep")
    limit: int = 25
    domain: str = "all"
    suite: str = "all"
    priority: str | None = None
    dry_run: bool = False
    verbose: bool = True
    backend_concurrency: int = int(os.environ.get("BACKEND_ANALYST_CONCURRENCY", "6"))
    write_retry_limit: int = int(os.environ.get("WRITE_RETRY_LIMIT", "2"))
    paths: tuple[str, ...] = ()

    def ensure_directories(self) -> None:
        self.artifact_dir.mkdir(parents=True, exist_ok=True)

    @property
    def uv_cache_dir(self) -> Path:
        value = os.environ.get("UV_CACHE_DIR")
        if value:
            return Path(value)
        return self.project_root / ".uv-cache"
