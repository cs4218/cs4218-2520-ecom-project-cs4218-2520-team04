from __future__ import annotations

import hashlib
from pathlib import Path

from ..schemas import BehaviorRecord
from .ast_grep_tool import AstGrepTool


PATTERN_CATALOG: dict[str, list[tuple[str, str, str, str, float]]] = {
    "backend": [
        ("route-handler", "router.$METHOD($$$ARGS)", "express-route", "Request routing behavior", 0.75),
        ("request-body", "req.body", "validation", "Request body validation or transformation", 0.7),
        ("request-params", "req.params", "validation", "Path parameter handling", 0.65),
        ("request-query", "req.query", "validation", "Query parameter handling", 0.65),
        ("status-code", "res.status($CODE)", "error-path", "HTTP status-specific response behavior", 0.7),
        ("try-catch", "try { $$$A } catch ($ERR) { $$$B }", "error-path", "Async error handling path", 0.8),
        ("schema", "new mongoose.Schema($OBJ)", "schema", "Model schema behavior", 0.75),
        ("schema-default", "{ $$$A, default: $VALUE, $$$B }", "default", "Schema default value behavior", 0.7),
        ("schema-enum", "{ $$$A, enum: $VALUE, $$$B }", "validation", "Schema enum validation", 0.7),
    ],
    "frontend": [
        ("effect", "useEffect($FN, $DEPS)", "state-transition", "Lifecycle-triggered state transition", 0.7),
        ("state", "useState($INIT)", "state-transition", "Component state transition", 0.6),
        ("navigate", "navigate($ARGS)", "navigation", "Navigation or redirect behavior", 0.8),
        ("axios", "axios.$METHOD($$$ARGS)", "api-flow", "API request and response behavior", 0.75),
        ("local-storage", "localStorage.$METHOD($$$ARGS)", "persistence", "Local storage persistence behavior", 0.8),
        ("jsx-if", "if ($COND) { $$$BODY }", "conditional-rendering", "Conditional rendering branch", 0.6),
    ],
}


class JSHeuristicsTool:
    def __init__(self, repo_root: Path, ast_grep: AstGrepTool) -> None:
        self.repo_root = repo_root
        self.ast_grep = ast_grep

    def detect_behaviors(self, file_path: str, source_kind: str) -> list[BehaviorRecord]:
        domain = "frontend" if file_path.startswith("client/src/") else "backend"
        patterns = PATTERN_CATALOG[domain]
        records: list[BehaviorRecord] = []
        for label, pattern, category, summary, confidence in patterns:
            matches = self.ast_grep.run_pattern(pattern=pattern, paths=[file_path], lang="JavaScript")
            for match in matches:
                line = match["range"]["start"]["line"] + 1
                behavior_id = self._behavior_id(file_path, label, line, match["text"])
                suite_hint = self._suite_hint(file_path, source_kind, category)
                records.append(
                    BehaviorRecord(
                        behavior_id=behavior_id,
                        file_path=file_path,
                        source_kind=source_kind,
                        category=category,
                        summary=summary,
                        line=line,
                        suite_hint=suite_hint,
                        confidence=confidence,
                        evidence=[f"{label}@{line}: {match['text'][:120]}"],
                    )
                )
        return self._dedupe(records)

    def _suite_hint(self, file_path: str, source_kind: str, category: str) -> str:
        if source_kind in {"route", "controller"}:
            return "integration" if category in {"error-path", "validation"} else "unit"
        if file_path.startswith("client/src/") and category in {"api-flow", "navigation"}:
            return "integration"
        return "unit"

    def _behavior_id(self, file_path: str, label: str, line: int, text: str) -> str:
        digest = hashlib.sha1(f"{file_path}:{label}:{line}:{text}".encode("utf-8")).hexdigest()[:10]
        return f"behavior-{digest}"

    def _dedupe(self, records: list[BehaviorRecord]) -> list[BehaviorRecord]:
        deduped: dict[tuple[str, str, int], BehaviorRecord] = {}
        for record in records:
            key = (record.file_path, record.category, record.line)
            deduped.setdefault(key, record)
        return list(deduped.values())
