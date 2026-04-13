from __future__ import annotations

from pathlib import PurePosixPath

from ..schemas import RepoMap, TargetCandidate, TestInventory
from ..tracing import ConsoleTracer


class TestLocatorTool:
    def __init__(self, tracer: ConsoleTracer | None = None) -> None:
        self.tracer = tracer

    def rank_candidates(
        self,
        source_file: str,
        suite_hint: str,
        repo_map: RepoMap,
        inventory: TestInventory,
    ) -> list[TargetCandidate]:
        source = PurePosixPath(source_file)
        stem = source.stem
        candidates: list[TargetCandidate] = []

        existing_tests = set(repo_map.test_files)

        def add(target_file: str, suite_type: str, reason: str, score: int) -> None:
            candidates.append(
                TargetCandidate(
                    target_file=target_file,
                    suite_type=suite_type,
                    reason=reason,
                    append_vs_create="append" if target_file in existing_tests else "create",
                    expected_test_command=self._expected_command(target_file, suite_type, inventory),
                    score=score,
                )
            )

        if source_file.startswith("client/src/"):
            add(source.with_name(f"{stem}.test.js").as_posix(), "unit", "Sibling React unit test convention", 100)
            add(
                source.with_name(f"{stem}.integration.test.js").as_posix(),
                "integration",
                "Sibling React integration test convention",
                95,
            )
        elif source.parts and source.parts[0] in {"controllers", "models", "middlewares", "helpers"}:
            add(source.with_name(f"{stem}.test.js").as_posix(), "unit", "Sibling backend unit test convention", 100)
            integration_path = self._backend_integration_path(source)
            add(integration_path, "integration", "Backend integration suite convention", 90)
        elif source.parts and source.parts[0] == "routes":
            add(self._backend_integration_path(source), "integration", "Routes are better covered by integration tests", 100)
            add(source.with_name(f"{stem}.test.js").as_posix(), "unit", "Route unit test fallback", 75)
        else:
            add(source.with_name(f"{stem}.test.js").as_posix(), suite_hint, "Default sibling test convention", 70)

        for linked in repo_map.ownership_links.get(source_file, []):
            add(linked, "integration" if ".integration." in linked else "unit", "Linked from repo ownership map", 110)

        ranked = sorted(candidates, key=lambda item: item.score, reverse=True)
        seen: set[str] = set()
        unique_ranked: list[TargetCandidate] = []
        for candidate in ranked:
            if candidate.target_file in seen:
                continue
            unique_ranked.append(candidate)
            seen.add(candidate.target_file)
        if self.tracer:
            self.tracer.tool("TestLocatorTool.rank_candidates", source_file, f"{len(unique_ranked)} candidate(s)")
        return unique_ranked

    def _backend_integration_path(self, source: PurePosixPath) -> str:
        category = "backend"
        stem = source.stem
        if "auth" in stem.lower():
            category = "auth"
        elif "product" in stem.lower() or "category" in stem.lower():
            category = "admin"
        elif "db" in stem.lower() or "model" in stem.lower():
            category = "database"
        return f"tests/integration/backend/{category}/{stem}.integration.test.js"

    def _expected_command(self, target_file: str, suite_type: str, inventory: TestInventory) -> str:
        if target_file.startswith("client/src/"):
            return f"npm run test:frontend -- {target_file} --runInBand --coverage=false"
        if suite_type == "integration":
            return f"npm run test:integration -- {target_file} --runInBand"
        return f"npm run test:backend -- {target_file} --runInBand"
