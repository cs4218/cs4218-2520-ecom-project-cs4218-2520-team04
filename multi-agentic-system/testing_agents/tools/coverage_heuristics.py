from __future__ import annotations

from pathlib import PurePosixPath

from ..schemas import BehaviorRecord, CoverageAssessment, RepoMap, TargetCandidate
from ..tracing import ConsoleTracer
from .ast_grep_tool import AstGrepTool
from .repo_search import RepoSearchTool


class CoverageHeuristicTool:
    def __init__(self, repo_search: RepoSearchTool, ast_grep: AstGrepTool, tracer: ConsoleTracer | None = None) -> None:
        self.repo_search = repo_search
        self.ast_grep = ast_grep
        self.tracer = tracer

    def assess(
        self,
        behavior: BehaviorRecord,
        candidates: list[TargetCandidate],
        repo_map: RepoMap,
    ) -> CoverageAssessment:
        candidate_files = [candidate.target_file for candidate in candidates[:5] if candidate.target_file in repo_map.test_files]
        if not candidate_files:
            if self.tracer:
                self.tracer.tool("CoverageHeuristicTool.assess", behavior.file_path, "uncovered")
            return CoverageAssessment(status="uncovered", confidence=0.9, evidence=["No existing target test file found"])

        basename = PurePosixPath(behavior.file_path).stem
        keyword_hits = self.repo_search.search(basename, candidate_files)

        structural_hits = []
        for pattern in (
            "describe($$$ARGS)",
            "it($$$ARGS)",
            "test($$$ARGS)",
            "expect($VALUE).$ASSERT($$$ARGS)",
            "jest.mock($$$ARGS)",
            "request($APP).$METHOD($PATH)",
            "render($$$ARGS)",
            "fireEvent.$METHOD($$$ARGS)",
            "userEvent.$METHOD($$$ARGS)",
        ):
            structural_hits.extend(self.ast_grep.run_pattern(pattern=pattern, paths=candidate_files, lang="JavaScript"))

        evidence = [hit["file"] for hit in structural_hits[:5]]
        evidence.extend(keyword_hits[:5])

        if structural_hits and keyword_hits:
            if self.tracer:
                self.tracer.tool("CoverageHeuristicTool.assess", behavior.file_path, "covered")
            return CoverageAssessment(status="covered", confidence=0.7, evidence=evidence)
        if structural_hits or keyword_hits:
            if self.tracer:
                self.tracer.tool("CoverageHeuristicTool.assess", behavior.file_path, "partially_covered")
            return CoverageAssessment(status="partially_covered", confidence=0.55, evidence=evidence)
        if self.tracer:
            self.tracer.tool("CoverageHeuristicTool.assess", behavior.file_path, "uncovered")
        return CoverageAssessment(status="uncovered", confidence=0.85, evidence=["No matching test structure found"])
