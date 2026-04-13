from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class ArtifactStoreTool:
    def __init__(self, artifact_dir: Path) -> None:
        self.artifact_dir = artifact_dir

    def write_json(self, name: str, payload: Any) -> Path:
        self.artifact_dir.mkdir(parents=True, exist_ok=True)
        path = self.artifact_dir / name
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return path

    def read_json(self, name: str) -> Any:
        path = self.artifact_dir / name
        return json.loads(path.read_text(encoding="utf-8"))
