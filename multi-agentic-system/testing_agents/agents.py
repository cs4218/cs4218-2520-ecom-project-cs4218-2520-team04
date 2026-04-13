from __future__ import annotations

import asyncio
import re
from pathlib import Path
from typing import Iterable

from .config import RuntimeConfig
from .llm import OpenAILLM
from .schemas import GapPlanItem, InventoryItem, RepoMap, TestInventory, WriteResult
from .tracing import ConsoleTracer
from .tools.artifact_store import ArtifactStoreTool
from .tools.ast_grep_tool import AstGrepTool
from .tools.coverage_heuristics import CoverageHeuristicTool
from .tools.jest_runner import JestRunnerTool
from .tools.js_heuristics import JSHeuristicsTool
from .tools.patch_writer import PatchWriterTool
from .tools.repo_search import RepoSearchTool
from .tools.source_reader import SourceReadTool
from .tools.test_locator import TestLocatorTool


class SupervisorAgent:
    def __init__(self, config: RuntimeConfig, llm: OpenAILLM, tracer: ConsoleTracer) -> None:
        self.config = config
        self.llm = llm
        self.tracer = tracer

    def health_check(self) -> None:
        self.tracer.supervisor(
            f"Supervisor model: {self.config.supervisor_model} | "
            f"Worker model: {self.config.worker_model} | "
            f"Writer model: {self.config.writer_model}"
        )

    def orchestrate_analyze(self, state: dict) -> dict[str, object]:
        has_repo_map = "repo_map" in state
        has_test_inventory = "test_inventory" in state
        has_gap_plan = "gap_plan" in state
        notes = list(state.get("notes", []))

        self.tracer.agent_start("SupervisorAgent", "Reviewing analyze-stage state and dispatching the next subagent")
        if not has_repo_map:
            next_step = "repo_cartographer"
            analyze_stage = "mapping"
            message = "SupervisorAgent is dispatching RepoCartographerAgent to map the repository before any downstream planning."
            notes.append("SupervisorAgent dispatched RepoCartographerAgent to produce the initial repository map.")
        elif not has_test_inventory:
            next_step = "test_inventory"
            analyze_stage = "inventory"
            message = "SupervisorAgent reviewed the repository map and is dispatching TestInventoryAgent next."
            notes.append("SupervisorAgent routed control to TestInventoryAgent after repository mapping completed.")
        elif not has_gap_plan:
            next_step = "analyze"
            analyze_stage = "gap_analysis"
            source_count = len(state["repo_map"].source_files)
            test_count = len(state["test_inventory"].files)
            message = (
                "SupervisorAgent reviewed the repo map and test inventory "
                f"({source_count} source files, {test_count} known test files) and is dispatching the gap-analysis agents."
            )
            notes.append("SupervisorAgent dispatched backend/frontend gap analysis after confirming both repository mapping and test inventory.")
        else:
            next_step = "complete"
            analyze_stage = "complete"
            planned_count = len(state["gap_plan"])
            message = f"SupervisorAgent completed analyze-stage orchestration with {planned_count} planned gap(s)."
            notes.append(f"SupervisorAgent completed the analyze stage with {planned_count} planned gaps.")

        self.tracer.agent_done("SupervisorAgent", message)
        return {
            "next_action": next_step,
            "analyze_stage": analyze_stage,
            "notes": notes,
        }

    def refine_repo_map(self, repo_map: RepoMap) -> RepoMap:
        if not self.llm.is_available():
            return repo_map
        refined = self.llm.refine_repo_map(repo_map.to_dict())
        ownership_links = refined.get("ownership_links")
        if isinstance(ownership_links, dict):
            normalized: dict[str, list[str]] = {}
            for key, value in ownership_links.items():
                if isinstance(key, str) and isinstance(value, list):
                    normalized[key] = [item for item in value if isinstance(item, str)]
            if normalized:
                repo_map.ownership_links.update(normalized)
        return repo_map

    def refine_test_inventory(self, inventory: TestInventory) -> TestInventory:
        if not self.llm.is_available():
            return inventory
        refined = self.llm.refine_test_inventory(inventory.to_dict())
        command_map_override = refined.get("command_map")
        conventions_override = refined.get("conventions")
        if isinstance(command_map_override, dict):
            inventory.command_map.update({k: v for k, v in command_map_override.items() if isinstance(k, str) and isinstance(v, str)})
        if isinstance(conventions_override, dict):
            normalized_conventions: dict[str, list[str]] = {}
            for key, value in conventions_override.items():
                if isinstance(key, str) and isinstance(value, list):
                    normalized_conventions[key] = [item for item in value if isinstance(item, str)]
            if normalized_conventions:
                inventory.conventions.update(normalized_conventions)
        return inventory

    def plan_gap_analysis(self, domain: str, backend_files: list[str], frontend_files: list[str]) -> dict:
        if not self.llm.is_available():
            return {}
        self.tracer.agent_start("SupervisorAgent", "Planning repository-wide gap analysis focus")
        plan = self.llm.supervise_gap_analysis(domain, backend_files, frontend_files)
        self.tracer.agent_done("SupervisorAgent", "Prepared repository-wide gap analysis focus")
        return plan

    def review_gap_plan(self, items: list[GapPlanItem]) -> list[GapPlanItem]:
        if not items or not self.llm.is_available():
            return items

        review_payload = [
            {
                "gap_id": item.gap_id,
                "source_file": item.source_file,
                "behavior_summary": item.behavior_summary,
                "priority": item.priority,
                "case_type": item.case_type,
                "suite_type": item.suite_type,
                "target_file": item.target_file,
                "confidence": item.confidence,
            }
            for item in items[:80]
        ]
        self.tracer.agent_start("SupervisorAgent", f"Reviewing {len(review_payload)} planned gap(s) across the repo")
        review = self.llm.review_gap_plan(review_payload)
        review_by_id = {entry.get("gap_id"): entry for entry in review if isinstance(entry.get("gap_id"), str)}
        updated: list[GapPlanItem] = []
        for item in items:
            change = review_by_id.get(item.gap_id)
            if change:
                priority = change.get("priority")
                confidence = change.get("confidence")
                if isinstance(priority, str) and priority in {"P0", "P1", "P2"}:
                    item.priority = priority
                if isinstance(confidence, (float, int)):
                    item.confidence = min(0.99, max(0.1, float(confidence)))
            updated.append(item)
        self.tracer.agent_done("SupervisorAgent", f"Completed supervisory review for {len(updated)} planned gap(s)")
        return updated


class AgentRuntime:
    def __init__(self, config: RuntimeConfig) -> None:
        self.config = config
        self.tracer = ConsoleTracer(enabled=config.verbose)
        self.repo_search = RepoSearchTool(config.repo_root, tracer=self.tracer)
        self.source_reader = SourceReadTool(config.repo_root, tracer=self.tracer)
        self.ast_grep = AstGrepTool(config.repo_root, binary=config.ast_grep_bin, tracer=self.tracer)
        self.js_heuristics = JSHeuristicsTool(config.repo_root, self.ast_grep)
        self.locator = TestLocatorTool(tracer=self.tracer)
        self.coverage = CoverageHeuristicTool(self.repo_search, self.ast_grep, tracer=self.tracer)
        self.artifacts = ArtifactStoreTool(config.artifact_dir)
        self.patch_writer = PatchWriterTool(config.repo_root, tracer=self.tracer)
        self.jest_runner = JestRunnerTool(config.repo_root, tracer=self.tracer)
        self.llm = OpenAILLM(config, tracer=self.tracer)
        self.supervisor = SupervisorAgent(config, self.llm, self.tracer)
        self._write_session_baselines: dict[str, str | None] = {}

    def health_check(self) -> None:
        self.supervisor.health_check()
        self.config.ensure_directories()
        self.ast_grep.ensure_available()

    def reset_write_session(self) -> None:
        self._write_session_baselines = {}

    def build_repo_map(self) -> RepoMap:
        self.tracer.agent_start("RepoCartographerAgent", "Scanning repository structure and ownership links")
        files = self.repo_search.files()
        source_files: list[str] = []
        test_files: list[str] = []
        config_files: list[str] = []
        for file_path in files:
            if self._is_test_file(file_path):
                test_files.append(file_path)
            elif file_path.endswith((".js", ".jsx", ".cjs", ".mjs")) and not file_path.startswith("node_modules/"):
                source_files.append(file_path)
            elif file_path.endswith((".json", ".toml", ".yml", ".yaml")):
                config_files.append(file_path)

        repo_map = RepoMap(source_files=source_files, test_files=test_files, config_files=config_files, ownership_links={})
        empty_inventory = TestInventory()
        for source_file in source_files:
            linked = [
                candidate.target_file
                for candidate in self.locator.rank_candidates(source_file, "unit", repo_map, empty_inventory)
                if candidate.target_file in test_files
            ]
            if linked:
                repo_map.ownership_links[source_file] = linked
        repo_map = self.supervisor.refine_repo_map(repo_map)
        self.tracer.agent_done(
            "RepoCartographerAgent",
            f"Mapped {len(source_files)} source files, {len(test_files)} test files, {len(repo_map.ownership_links)} ownership links",
        )
        return repo_map

    def build_test_inventory(self, repo_map: RepoMap) -> TestInventory:
        self.tracer.agent_start("TestInventoryAgent", "Indexing test conventions and runnable suites")
        command_map = {
            "backend": "npm run test:backend -- <path> --runInBand",
            "frontend": "npm run test:frontend -- <path> --runInBand --coverage=false",
            "integration": "npm run test:integration -- <path> --runInBand",
        }
        conventions = {
            "unit": ["controllers/*.test.js", "models/*.test.js", "client/src/**/*.test.js"],
            "integration": ["tests/integration/backend/**", "tests/integration/frontend/**", "client/src/**/*.integration.test.js"],
        }
        files: list[InventoryItem] = []
        for test_file in repo_map.test_files:
            suite_type = "integration" if ".integration." in test_file or test_file.startswith("tests/integration/") else "unit"
            if test_file.startswith("client/src/"):
                command = command_map["frontend"] if suite_type == "unit" else command_map["integration"]
            else:
                command = command_map["integration"] if suite_type == "integration" else command_map["backend"]
            files.append(
                InventoryItem(
                    path=test_file,
                    suite_type=suite_type,
                    command=command,
                    reason="Discovered from current repo test conventions",
                )
            )
        inventory = TestInventory(command_map=command_map, files=files, conventions=conventions)
        inventory = self.supervisor.refine_test_inventory(inventory)
        self.tracer.agent_done("TestInventoryAgent", f"Indexed {len(files)} test files across {len(conventions)} suite groups")
        return inventory

    def analyze_gaps(self, repo_map: RepoMap, inventory: TestInventory) -> list[GapPlanItem]:
        self.tracer.agent_start(
            "SupervisorAgent",
            f"Coordinating backend/frontend gap analysis (backend concurrency={self.config.backend_concurrency})",
        )
        candidate_files = [path for path in repo_map.source_files if self._within_requested_scope(path)]
        backend_files = [path for path in candidate_files if not path.startswith("client/src/") and self._source_kind(path) != "test"]
        frontend_files = [path for path in candidate_files if path.startswith("client/src/") and self._source_kind(path) != "test"]
        if self.llm.is_available():
            supervisor_plan = self.supervisor.plan_gap_analysis(self.config.domain, backend_files, frontend_files)
            focus_note = supervisor_plan.get("focus_note")
            focus_paths = supervisor_plan.get("focus_paths")
            backend_first = supervisor_plan.get("backend_first")
            if isinstance(focus_paths, list):
                prioritized = [path for path in candidate_files if path in focus_paths]
                remaining = [path for path in candidate_files if path not in prioritized]
                candidate_files = prioritized + remaining
                backend_files = [path for path in candidate_files if not path.startswith("client/src/") and self._source_kind(path) != "test"]
                frontend_files = [path for path in candidate_files if path.startswith("client/src/") and self._source_kind(path) != "test"]
            if backend_first is False:
                frontend_first_files = frontend_files[:]
                backend_second_files = backend_files[:]
            else:
                frontend_first_files = None
                backend_second_files = None
            if isinstance(focus_note, str) and focus_note:
                self.tracer.agent_done("SupervisorAgent", focus_note)
                self.tracer.agent_start(
                    "SupervisorAgent",
                    f"Coordinating backend/frontend gap analysis (backend concurrency={self.config.backend_concurrency})",
                )

        planned: list[GapPlanItem] = []
        if self.llm.is_available() and frontend_first_files is not None and backend_second_files is not None:
            for source_file in frontend_first_files:
                planned.extend(self._analyze_file(source_file, repo_map, inventory, "FrontendGapAnalystAgent"))
            if backend_second_files:
                planned.extend(asyncio.run(self._analyze_backend_files(backend_second_files, repo_map, inventory)))
        else:
            if backend_files:
                planned.extend(asyncio.run(self._analyze_backend_files(backend_files, repo_map, inventory)))
            for source_file in frontend_files:
                planned.extend(self._analyze_file(source_file, repo_map, inventory, "FrontendGapAnalystAgent"))

        deduped = self._dedupe_gap_plan(planned)
        deduped = self.supervisor.review_gap_plan(deduped)
        sorted_items = self._sort_and_limit(deduped)
        self.tracer.agent_done(
            "SupervisorAgent",
            f"Completed gap-analysis coordination with {len(sorted_items)} actionable gap(s) selected from {len(planned)} raw findings",
        )
        self.tracer.agent_done("GapTriagerAgent", f"Triaged {len(sorted_items)} actionable gaps from {len(planned)} raw findings")
        return sorted_items

    async def _analyze_backend_files(
        self,
        backend_files: list[str],
        repo_map: RepoMap,
        inventory: TestInventory,
    ) -> list[GapPlanItem]:
        semaphore = asyncio.Semaphore(max(1, self.config.backend_concurrency))

        async def run_file(source_file: str) -> list[GapPlanItem]:
            async with semaphore:
                return await asyncio.to_thread(
                    self._analyze_file,
                    source_file,
                    repo_map,
                    inventory,
                    "BackendGapAnalystAgent",
                )

        results = await asyncio.gather(*(run_file(source_file) for source_file in backend_files))
        flattened: list[GapPlanItem] = []
        for items in results:
            flattened.extend(items)
        return flattened

    def _analyze_file(
        self,
        source_file: str,
        repo_map: RepoMap,
        inventory: TestInventory,
        agent_name: str,
    ) -> list[GapPlanItem]:
        source_kind = self._source_kind(source_file)
        self.tracer.agent_start(agent_name, f"Reviewing {source_file} ({source_kind})")

        behaviors = self.js_heuristics.detect_behaviors(source_file, source_kind)
        raw_candidates: list[dict] = []
        plan_inputs: dict[str, tuple] = {}
        for behavior in behaviors:
            locator_candidates = self.locator.rank_candidates(source_file, behavior.suite_hint, repo_map, inventory)
            coverage = self.coverage.assess(behavior, locator_candidates, repo_map)
            if coverage.status == "covered":
                continue

            best_candidate = locator_candidates[0]
            route_context = self._route_context(source_file, behavior.line) if source_kind == "route" else None
            plan_inputs[behavior.behavior_id] = (behavior, best_candidate, coverage, route_context)
            raw_candidates.append(
                {
                    "gap_id": behavior.behavior_id,
                    "category": behavior.category,
                    "summary": behavior.summary,
                    "line": behavior.line,
                    "suite_hint": behavior.suite_hint,
                    "behavior_confidence": behavior.confidence,
                    "coverage_status": coverage.status,
                    "coverage_confidence": coverage.confidence,
                    "evidence": behavior.evidence + coverage.evidence + [best_candidate.reason],
                    "target_file": best_candidate.target_file,
                    "suite_type": best_candidate.suite_type,
                    "append_mode": best_candidate.append_vs_create,
                    "target_command": best_candidate.expected_test_command,
                    "route_context": route_context,
                    "default_priority": self._priority_for(source_file, behavior.category),
                    "default_case_type": self._case_type_for(source_file, behavior.category, route_context),
                }
            )
        raw_candidates = self._analyst_review_candidates(source_file, source_kind, raw_candidates, agent_name)
        planned = self._triage_and_plan_candidates(source_file, source_kind, raw_candidates, plan_inputs)
        self.tracer.agent_done(agent_name, f"Found {len(behaviors)} behavior candidate(s) in {source_file}")
        return planned

    def _analyst_review_candidates(
        self,
        source_file: str,
        source_kind: str,
        raw_candidates: list[dict],
        agent_name: str,
    ) -> list[dict]:
        if not raw_candidates or not self.llm.is_available():
            return raw_candidates

        if agent_name == "BackendGapAnalystAgent":
            analyst_output = self.llm.analyze_backend_file(source_file, source_kind, raw_candidates)
        else:
            analyst_output = self.llm.analyze_frontend_file(source_file, source_kind, raw_candidates)

        output_by_id = {
            item.get("gap_id"): item
            for item in analyst_output
            if isinstance(item, dict) and isinstance(item.get("gap_id"), str)
        }

        filtered: list[dict] = []
        for candidate in raw_candidates:
            review = output_by_id.get(candidate["gap_id"])
            if review:
                focus = review.get("suggested_focus")
                if focus == "drop":
                    continue
                summary = review.get("analyst_summary")
                rationale = review.get("analyst_rationale")
                confidence = review.get("analyst_confidence")
                if isinstance(summary, str) and summary:
                    candidate["analyst_summary"] = summary
                if isinstance(rationale, str) and rationale:
                    candidate["analyst_rationale"] = rationale
                if focus == "escalate":
                    candidate["default_priority"] = "P0"
                if isinstance(confidence, (float, int)):
                    candidate["behavior_confidence"] = min(0.99, max(float(confidence), candidate["behavior_confidence"]))
            filtered.append(candidate)
        return filtered

    def _triage_and_plan_candidates(
        self,
        source_file: str,
        source_kind: str,
        raw_candidates: list[dict],
        plan_inputs: dict[str, tuple],
    ) -> list[GapPlanItem]:
        if not raw_candidates:
            return []

        llm_decisions: dict[str, dict] = {}
        if self.llm.is_available():
            self.tracer.agent_start("GapTriagerAgent", f"LLM triaging {len(raw_candidates)} candidate gap(s) in {source_file}")
            for item in self.llm.triage_and_design_gaps(source_file, source_kind, raw_candidates):
                gap_id = item.get("gap_id")
                if isinstance(gap_id, str):
                    llm_decisions[gap_id] = item
            self.tracer.agent_done("GapTriagerAgent", f"LLM reviewed {len(raw_candidates)} candidate gap(s) in {source_file}")

        planned: list[GapPlanItem] = []
        for candidate in raw_candidates:
            behavior_id = candidate["gap_id"]
            if behavior_id not in plan_inputs:
                continue
            behavior, best_candidate, coverage, _route_context = plan_inputs[behavior_id]
            decision = llm_decisions.get(behavior_id)

            if decision and not decision.get("actionable", True):
                continue

            if decision:
                priority = str(decision.get("priority") or candidate["default_priority"])
                case_type = str(decision.get("case_type") or candidate["default_case_type"])
                behavior_summary = str(decision.get("behavior_summary") or candidate.get("analyst_summary") or behavior.summary)
                rationale = str(decision.get("rationale") or candidate.get("analyst_rationale") or "")
                scenario_summary = str(decision.get("scenario_summary") or "")
                confidence = float(decision.get("confidence") or min(0.99, max(behavior.confidence, coverage.confidence)))
                setup_notes, assertion_notes = self._notes_for_gap(
                    source_file,
                    behavior,
                    best_candidate,
                    behavior_summary,
                    scenario_summary,
                )
            else:
                priority, case_type, behavior_summary, rationale, scenario_summary, setup_notes, assertion_notes = self._heuristic_design_gap(
                    source_file,
                    behavior,
                    best_candidate,
                )
                if candidate.get("analyst_summary"):
                    behavior_summary = str(candidate["analyst_summary"])
                if candidate.get("analyst_rationale"):
                    rationale = str(candidate["analyst_rationale"])
                confidence = min(0.99, max(behavior.confidence, coverage.confidence))

            planned.append(
                GapPlanItem(
                    gap_id=behavior.behavior_id,
                    priority=priority,
                    case_type=case_type,
                    source_file=source_file,
                    source_kind=source_kind,
                    behavior_summary=behavior_summary,
                    rationale=rationale,
                    suite_type=best_candidate.suite_type,
                    target_file=best_candidate.target_file,
                    target_command=best_candidate.expected_test_command,
                    append_mode=best_candidate.append_vs_create,
                    coverage_status=coverage.status,
                    confidence=min(0.99, max(0.1, confidence)),
                    scenario_summary=scenario_summary,
                    setup_notes=setup_notes,
                    assertion_notes=assertion_notes,
                    evidence=behavior.evidence + coverage.evidence + [best_candidate.reason],
                )
            )
        return planned

    def write_fix_batch(
        self,
        items: Iterable[GapPlanItem],
        failure_feedback: dict[str, str] | None = None,
        attempt: int = 1,
    ) -> list[WriteResult]:
        feedback_by_gap = failure_feedback or {}
        results: list[WriteResult] = []
        for item in items:
            if self.config.dry_run:
                results.append(
                    WriteResult(
                        gap_id=item.gap_id,
                        target_file=item.target_file,
                        status="dry-run",
                        attempts=attempt,
                        verification_command=item.target_command,
                        notes=["Dry run enabled; no files changed."],
                    )
                )
                continue

            source_snippet = self.source_reader.read(item.source_file)
            target_path = self.config.repo_root / item.target_file
            if item.target_file not in self._write_session_baselines:
                if target_path.exists():
                    self._write_session_baselines[item.target_file] = self.source_reader.read_full(item.target_file)
                else:
                    self._write_session_baselines[item.target_file] = None
            existing_test_snippet = self._write_session_baselines[item.target_file]

            design_brief = self._design_write_fix(item, source_snippet, existing_test_snippet, feedback_by_gap.get(item.gap_id), attempt)
            self.tracer.agent_start("TestWriterAgent", f"Generating test patch for {item.target_file} (attempt {attempt})")
            test_code = self._generate_test_code(
                item,
                source_snippet,
                existing_test_snippet,
                design_brief=design_brief,
                failure_feedback=feedback_by_gap.get(item.gap_id),
                attempt=attempt,
            )
            self.patch_writer.write_test(
                item.target_file,
                test_code,
                base_content=existing_test_snippet,
                replace=True,
            )
            results.append(
                WriteResult(
                    gap_id=item.gap_id,
                    target_file=item.target_file,
                    status="written",
                    attempts=attempt,
                    verification_command=item.target_command,
                    notes=[design_brief] if design_brief else ([feedback_by_gap[item.gap_id]] if item.gap_id in feedback_by_gap else []),
                )
            )
            self.tracer.agent_done("TestWriterAgent", f"Wrote generated patch into {item.target_file}")
        return results

    def verify_fix_batch(
        self,
        items: Iterable[GapPlanItem],
        write_results: list[WriteResult],
    ) -> tuple[list[WriteResult], list[str], dict[str, str]]:
        item_by_id = {item.gap_id: item for item in items}
        verified: list[WriteResult] = []
        failed_gap_ids: list[str] = []
        failure_feedback: dict[str, str] = {}

        for result in write_results:
            item = item_by_id[result.gap_id]
            if result.status == "dry-run":
                verified.append(result)
                continue

            self.tracer.agent_start("VerificationAgent", f"Running verification for {item.target_file}")
            verification_status, output = self.jest_runner.run(item.target_command)
            result.verification_status = verification_status
            if output:
                if self.llm.is_available():
                    summary = self.llm.summarize_verification_result(item, output[:4000], verification_status)
                    result.notes = [summary or output[:1500]]
                else:
                    result.notes = [output[:1500]]
            if verification_status != "passed":
                failed_gap_ids.append(item.gap_id)
                failure_feedback[item.gap_id] = output[:4000] if output else "Verification failed with no output."
                result.status = "failed"
            self.tracer.agent_done("VerificationAgent", f"{verification_status} for {item.target_file}")
            verified.append(result)

        return verified, failed_gap_ids, failure_feedback

    def repair_failed_fixes(
        self,
        items: Iterable[GapPlanItem],
        failure_feedback: dict[str, str],
        attempt: int,
    ) -> dict[str, str]:
        item_by_id = {item.gap_id: item for item in items}
        repaired_feedback: dict[str, str] = {}
        for gap_id, raw_feedback in failure_feedback.items():
            item = item_by_id.get(gap_id)
            if item is None:
                continue

            self.tracer.agent_start("RepairAgent", f"Preparing repair guidance for {item.target_file} (attempt {attempt + 1})")
            if self.llm.is_available():
                summary = self.llm.summarize_verification_failure(item, raw_feedback, attempt)
                repaired_feedback[gap_id] = summary or self._summarize_failure_feedback(raw_feedback)
            else:
                repaired_feedback[gap_id] = self._summarize_failure_feedback(raw_feedback)
            self.tracer.agent_done("RepairAgent", f"Prepared repair guidance for {item.target_file}")
        return repaired_feedback

    def _generate_test_code(
        self,
        item: GapPlanItem,
        source_snippet: str,
        existing_test_snippet: str | None,
        design_brief: str | None = None,
        failure_feedback: str | None = None,
        attempt: int = 1,
    ) -> str:
        if self.llm.is_available():
            generated = self.llm.generate_test_code(
                item,
                source_snippet,
                existing_test_snippet,
                design_brief=design_brief,
                failure_feedback=failure_feedback,
                attempt=attempt,
            )
            if generated:
                return generated

        test_title = item.scenario_summary.replace('"', "'")
        safe_name = Path(item.source_file).stem
        return (
            f"describe(\"Generated coverage for {safe_name}\", () => {{\n"
            f"  it(\"{test_title}\", async () => {{\n"
            f"    expect(\"{item.behavior_summary}\").toBeDefined();\n"
            f"  }});\n"
            f"}});"
        )

    def _design_write_fix(
        self,
        item: GapPlanItem,
        source_snippet: str,
        existing_test_snippet: str | None,
        failure_feedback: str | None,
        attempt: int,
    ) -> str:
        self.tracer.agent_start("TestDesignAgent", f"Designing fix for {item.source_file} -> {item.target_file}")
        if self.config.dry_run:
            self.tracer.agent_done("TestDesignAgent", f"Dry-run only for {item.target_file}")
            return "Dry run enabled; no design brief generated."
        if self.llm.is_available():
            brief = self.llm.design_write_fix(item, source_snippet, existing_test_snippet, failure_feedback, attempt)
            self.tracer.agent_done("TestDesignAgent", f"Prepared design brief for {item.target_file}")
            return brief or f"Write one focused Jest test for: {item.scenario_summary}"
        self.tracer.agent_done("TestDesignAgent", f"Prepared heuristic design brief for {item.target_file}")
        return f"Write one focused Jest test for: {item.scenario_summary}"

    def _summarize_failure_feedback(self, raw_feedback: str) -> str:
        lines = [line.strip() for line in raw_feedback.splitlines() if line.strip()]
        priority_markers = (
            "SyntaxError",
            "ReferenceError",
            "TypeError",
            "Cannot find module",
            "Expected:",
            "Received:",
            "Matcher error",
            "thrown:",
            "FAIL ",
        )

        selected: list[str] = []
        for marker in priority_markers:
            for line in lines:
                if marker in line and line not in selected:
                    selected.append(line)
                if len(selected) >= 4:
                    break
            if len(selected) >= 4:
                break

        if not selected:
            selected = lines[:4]

        if not selected:
            return "Verification failed, but no usable Jest output was captured. Recheck imports, mocks, async handling, and assertions."

        summary = "; ".join(selected[:4])
        return f"Revise the generated test to address this Jest failure: {summary}"

    def _heuristic_design_gap(self, source_file: str, behavior, candidate) -> tuple[str, str, str, str, str, list[str], list[str]]:
        route_context = self._route_context(source_file, behavior.line) if self._source_kind(source_file) == "route" else None
        setup_notes = [f"Target {candidate.suite_type} suite at {candidate.target_file}"]
        assertion_notes = [f"Assert behavior category `{behavior.category}` from line {behavior.line}"]

        if route_context:
            method = route_context["method"]
            path = route_context["path"]
            middleware = route_context["middleware"]
            handler = route_context["handler"]
            route_label = f"{method} {path}"
            case_type = self._case_type_for(source_file, behavior.category, route_context)

            if behavior.category == "express-route":
                if case_type == "negative":
                    behavior_summary = f"{route_label} protected route rejection path"
                    rationale = (
                        f"The protected {route_label} route in {Path(source_file).name} appears uncovered, so we are not verifying "
                        f"that missing or insufficient auth is rejected before `{handler}` runs through `{middleware}`."
                    )
                    scenario = (
                        f"exercise the negative path for {route_label} and verify unauthenticated or unauthorized requests are blocked "
                        f"by `{middleware}` before `{handler}` executes"
                    )
                    assertion_notes.extend(
                        [
                            f"Assert {route_label} rejects unauthenticated or unauthorized requests",
                            f"Assert `{handler}` is not reached when `{middleware}` blocks the request",
                        ]
                    )
                else:
                    behavior_summary = f"{route_label} route wiring and middleware flow"
                    rationale = (
                        f"The {route_label} route in {Path(source_file).name} appears uncovered, so we are not verifying "
                        f"that it is wired through `{middleware}` into `{handler}`."
                    )
                    scenario = (
                        f"exercise {route_label} through the real router and verify the request reaches `{handler}` "
                        f"with the expected middleware chain `{middleware}`"
                    )
                    assertion_notes.extend(
                        [
                            f"Assert {route_label} is mounted and callable through the Express router",
                            f"Assert middleware chain includes `{middleware}` before `{handler}`",
                        ]
                    )
            elif behavior.category == "error-path":
                case_type = "negative"
                behavior_summary = f"{route_label} inline auth/status response"
                rationale = (
                    f"The {route_label} route in {Path(source_file).name} returns an inline status response, but there is "
                    f"no focused integration test confirming the `{route_context['status_text']}` branch and auth behavior."
                )
                scenario = (
                    f"call {route_label} with the required auth context and verify it returns "
                    f"`{route_context['status_text']}` from the inline route handler"
                )
                assertion_notes.extend(
                    [
                        f"Assert response for {route_label} is `{route_context['status_text']}`",
                        "Assert unauthorized access is still rejected by route middleware",
                    ]
                )
            else:
                case_type = self._case_type_for(source_file, behavior.category, route_context)
                behavior_summary = f"{route_label} {behavior.summary.lower()}"
                rationale = f"The {route_label} route in {Path(source_file).name} appears {behavior.category}-sensitive and not directly covered."
                scenario = f"cover the {route_label} route and assert the expected {behavior.category} behavior."

            setup_notes.append(f"Route context: `{route_label}` with `{middleware}` and handler `{handler}`")
            priority = self._priority_for(source_file, behavior.category)
            return priority, case_type, behavior_summary, rationale, scenario, setup_notes, assertion_notes

        case_type = self._case_type_for(source_file, behavior.category, route_context)
        behavior_summary = behavior.summary
        if case_type == "negative":
            rationale = f"{behavior.category} in {self._source_kind(source_file)} appears uncovered in {Path(source_file).name}, especially its rejection or failure-path behavior."
            scenario = f"covers the negative path for {behavior.summary.lower()} in {Path(source_file).name}"
        else:
            rationale = f"{behavior.category} in {self._source_kind(source_file)} appears uncovered in {Path(source_file).name}."
            scenario = f"covers {behavior.summary.lower()} in {Path(source_file).name}"
        priority = self._priority_for(source_file, behavior.category)
        return priority, case_type, behavior_summary, rationale, scenario, setup_notes, assertion_notes

    def _notes_for_gap(
        self,
        source_file: str,
        behavior,
        candidate,
        behavior_summary: str,
        scenario_summary: str,
    ) -> tuple[list[str], list[str]]:
        route_context = self._route_context(source_file, behavior.line) if self._source_kind(source_file) == "route" else None
        setup_notes = [f"Target {candidate.suite_type} suite at {candidate.target_file}"]
        assertion_notes = [
            f"Assert behavior category `{behavior.category}` from line {behavior.line}",
            f"Assert planned scenario `{scenario_summary}`",
        ]
        if route_context:
            route_label = f"{route_context['method']} {route_context['path']}"
            setup_notes.append(f"Route context: `{route_label}` with `{route_context['middleware']}` and handler `{route_context['handler']}`")
            assertion_notes.append(f"Assert route behavior `{behavior_summary}` through `{route_label}`")
        return setup_notes, assertion_notes

    def _case_type_for(self, source_file: str, category: str, route_context: dict[str, str] | None) -> str:
        lowered = source_file.lower()
        if category in {"error-path", "validation"}:
            return "negative"
        if route_context:
            middleware = route_context.get("middleware", "")
            path = route_context.get("path", "")
            if middleware != "no middleware":
                return "negative"
            if ":" in path:
                return "negative"
        if any(token in lowered for token in ("auth", "middleware", "admin")):
            return "negative"
        return "positive"

    def _route_context(self, source_file: str, line_number: int) -> dict[str, str] | None:
        try:
            content = (self.config.repo_root / source_file).read_text(encoding="utf-8")
        except OSError:
            return None

        lines = content.splitlines()
        route_pattern = re.compile(r'router\.(get|post|put|delete)\s*\(')
        path_pattern = re.compile(r'["\']([^"\']+)["\']')
        status_pattern = re.compile(r"res\.status\((\d+)\)")

        route_starts: list[int] = []
        for idx, line in enumerate(lines, start=1):
            if route_pattern.search(line):
                route_starts.append(idx)

        selected_start = None
        for start in route_starts:
            if start <= line_number:
                selected_start = start
            else:
                break
        if selected_start is None:
            return None

        selected_end = len(lines)
        for start in route_starts:
            if start > selected_start:
                selected_end = start - 1
                break

        block_lines = []
        for raw_line in lines[selected_start - 1 : selected_end]:
            block_lines.append(raw_line.split("//", 1)[0].rstrip())
        block = "\n".join(block_lines)
        method_match = route_pattern.search(block)
        path_match = path_pattern.search(block)
        if not method_match or not path_match:
            return None

        method = method_match.group(1).upper()
        path = path_match.group(1)
        block_without_path = block.replace(f'"{path}"', "").replace(f"'{path}'", "")
        identifier_matches = re.findall(r"\b([A-Za-z_][A-Za-z0-9_]*)\b", block_without_path)
        ignored = {
            "router",
            method.lower(),
            "require",
            "res",
            "status",
            "send",
            "ok",
            "true",
            "false",
            "const",
            "return",
        }
        ordered_identifiers: list[str] = []
        for identifier in identifier_matches:
            if identifier in ignored:
                continue
            if identifier == path.strip("/"):
                continue
            if identifier not in ordered_identifiers:
                ordered_identifiers.append(identifier)

        middleware_chain: list[str] = []
        handler = "unknownHandler"

        if "=>" in block:
            middleware_chain = [identifier for identifier in ordered_identifiers if identifier not in {"req"}]
            handler = "inlineHandler"
        else:
            middleware_chain = ordered_identifiers

        if middleware_chain:
            handler = middleware_chain[-1]
            middleware = " -> ".join(middleware_chain[:-1]) if len(middleware_chain) > 1 else "no middleware"
        else:
            middleware = "no middleware"

        status_match = status_pattern.search(block)
        status_text = f"HTTP {status_match.group(1)}" if status_match else "the expected status response"

        return {
            "method": method,
            "path": path,
            "middleware": middleware,
            "handler": handler,
            "status_text": status_text,
        }

    def _priority_for(self, source_file: str, category: str) -> str:
        path = source_file.lower()
        if any(token in path for token in ("auth", "order", "checkout", "payment", "admin")):
            return "P0"
        if category in {"validation", "error-path", "api-flow", "navigation"}:
            return "P1"
        return "P2"

    def _sort_and_limit(self, items: list[GapPlanItem]) -> list[GapPlanItem]:
        priority_order = {"P0": 0, "P1": 1, "P2": 2}
        filtered = [
            item
            for item in items
            if (not self.config.priority or item.priority == self.config.priority)
            and (self.config.suite == "all" or item.suite_type == self.config.suite)
        ]
        filtered.sort(key=lambda item: (priority_order[item.priority], -item.confidence, item.source_file))
        return filtered[: self.config.limit]

    def _dedupe_gap_plan(self, items: list[GapPlanItem]) -> list[GapPlanItem]:
        deduped: dict[tuple[str, str, str, str], GapPlanItem] = {}
        for item in items:
            key = (item.source_file, item.behavior_summary, item.target_file, item.priority)
            current = deduped.get(key)
            if current is None or item.confidence > current.confidence:
                deduped[key] = item
        return list(deduped.values())

    def _within_requested_scope(self, path: str) -> bool:
        if self.config.domain == "backend" and path.startswith("client/src/"):
            return False
        if self.config.domain == "frontend" and not path.startswith("client/src/"):
            return False
        if self.config.paths and not any(path.startswith(prefix.rstrip("*")) for prefix in self.config.paths):
            return False
        return True

    def _source_kind(self, path: str) -> str:
        lowered = path.lower()
        if "/pages/" in lowered or lowered.startswith("client/src/pages/"):
            return "page"
        if "/components/" in lowered or lowered.startswith("client/src/components/"):
            return "component"
        if "/hooks/" in lowered:
            return "hook"
        if "/context/" in lowered:
            return "context"
        if lowered.startswith("controllers/"):
            return "controller"
        if lowered.startswith("routes/"):
            return "route"
        if lowered.startswith("models/"):
            return "model"
        if lowered.startswith("middlewares/"):
            return "middleware"
        if lowered.startswith("helpers/"):
            return "helper"
        return "module"

    def _is_test_file(self, path: str) -> bool:
        return any(token in path for token in (".test.", ".spec.", "tests/"))
