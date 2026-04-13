from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class RepoMap:
    source_files: list[str] = field(default_factory=list)
    test_files: list[str] = field(default_factory=list)
    config_files: list[str] = field(default_factory=list)
    ownership_links: dict[str, list[str]] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class InventoryItem:
    path: str
    suite_type: str
    command: str
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class TestInventory:
    command_map: dict[str, str] = field(default_factory=dict)
    files: list[InventoryItem] = field(default_factory=list)
    conventions: dict[str, list[str]] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "command_map": self.command_map,
            "files": [item.to_dict() for item in self.files],
            "conventions": self.conventions,
        }


@dataclass(slots=True)
class BehaviorRecord:
    behavior_id: str
    file_path: str
    source_kind: str
    category: str
    summary: str
    line: int
    suite_hint: str
    confidence: float
    evidence: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class TargetCandidate:
    target_file: str
    suite_type: str
    reason: str
    append_vs_create: str
    expected_test_command: str
    score: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class CoverageAssessment:
    status: str
    confidence: float
    evidence: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class GapPlanItem:
    gap_id: str
    priority: str
    case_type: str
    source_file: str
    source_kind: str
    behavior_summary: str
    rationale: str
    suite_type: str
    target_file: str
    target_command: str
    append_mode: str
    coverage_status: str
    confidence: float
    scenario_summary: str
    setup_notes: list[str] = field(default_factory=list)
    assertion_notes: list[str] = field(default_factory=list)
    evidence: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class WriteResult:
    gap_id: str
    target_file: str
    status: str
    attempts: int = 1
    verification_command: str | None = None
    verification_status: str | None = None
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def relative_path(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()
