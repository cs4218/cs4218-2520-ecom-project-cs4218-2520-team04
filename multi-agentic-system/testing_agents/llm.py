from __future__ import annotations

import json
from textwrap import dedent

from .config import RuntimeConfig
from .schemas import GapPlanItem
from .tracing import ConsoleTracer


class OpenAILLM:
    def __init__(self, config: RuntimeConfig, tracer: ConsoleTracer | None = None) -> None:
        self.config = config
        self.tracer = tracer

    def is_available(self) -> bool:
        return bool(self.config.openai_api_key)

    def _client(self):
        if not self.config.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is required for LLM-backed generation.")
        from openai import OpenAI

        return OpenAI(api_key=self.config.openai_api_key)

    def supervisor_model(self) -> str:
        return self.config.supervisor_model

    def worker_model(self) -> str:
        return self.config.worker_model

    def writer_model(self) -> str:
        return self.config.writer_model

    def generate_test_code(
        self,
        plan: GapPlanItem,
        source_snippet: str,
        existing_test_snippet: str | None,
        reference_test_context: str | None = None,
        design_brief: str | None = None,
        failure_feedback: str | None = None,
        attempt: int = 1,
    ) -> str:
        prompt = dedent(
            f"""
            You are generating one Jest test patch for a JavaScript full-stack application.
            Use model constraints appropriate for {self.writer_model()}.

            Return ONLY JavaScript test code, no markdown fences.

            Plan:
            {json.dumps(plan.to_dict(), indent=2)}

            Source snippet:
            {source_snippet}

            Existing target test file content:
            {existing_test_snippet or "No existing file content."}

            Reference test examples and setup hints from this repository:
            {reference_test_context or "No nearby reference tests or setup hints provided."}

            Design brief:
            {design_brief or "No extra design brief provided."}

            Attempt:
            {attempt}

            Verification feedback from the previous failed run:
            {failure_feedback or "None. This is the first attempt."}

            Rules:
            - Preserve existing test style.
            - Write only one focused incremental describe/it block for this gap.
            - If existing target test file content is provided, treat it as the full current file and return ONLY the new block to append.
            - Do not repeat or recreate imports, jest.mock calls, helper declarations, beforeAll/beforeEach hooks, or existing tests that are already present in the target file.
            - Avoid adding new `jest.mock()` factories unless absolutely necessary. If a mock factory is required, do not reference out-of-scope variables from the factory body.
            - Before returning, verify that every identifier used in the generated code is already available in the existing target file or is declared/imported in the generated block.
            - If the test uses `request(app)`, make sure `app` is already defined in the existing target file or is explicitly created in the generated code.
            - For a route integration test with no existing app setup, prefer a minimal local Express app that mounts the route under test.
            - If the route uses the repository auth middleware, pass the raw JWT string in the `Authorization` header unless the existing test file clearly uses a different convention.
            - If the route touches Mongoose-backed auth or model lookups and the file has no DB harness yet, include a `MongoMemoryServer` + `mongoose.connect(...)` setup instead of assuming a global database connection.
            - If the plan marks this as a negative case, prioritize rejection, validation, unauthorized, forbidden, malformed input, or failure-path assertions over happy-path assertions.
            - Avoid placeholders like TODO.
            - Prefer deterministic mocks.
            - If verification feedback is provided, revise the generated test to address that failure directly.
            """
        ).strip()

        if self.tracer:
            self.tracer.llm_call("WRITER", self.writer_model(), f"Generating test code for {plan.target_file}")
        response = self._client().responses.create(
            model=self.writer_model(),
            input=prompt,
        )
        output = (response.output_text or "").strip()
        if self.tracer:
            self.tracer.tool("OpenAILLM.generate_test_code", plan.target_file, "completed")
        return output

    def refine_repo_map(self, repo_map: dict) -> dict:
        prompt = dedent(
            f"""
            You are refining a repository map for a JavaScript full-stack codebase.
            Use model constraints appropriate for {self.supervisor_model()}.

            Review the discovered ownership links and return ONLY JSON.

            Repo map:
            {json.dumps(repo_map, indent=2)}

            Return an object with:
            - ownership_links: object mapping source files to lists of test files

            Rules:
            - Keep existing good links.
            - Add only obvious ownership links for routes, controllers, models, pages, hooks, or components.
            - Do not invent paths that are inconsistent with the repository structure.
            """
        ).strip()
        if self.tracer:
            self.tracer.llm_call("SUPERVISOR", self.supervisor_model(), "Refining repository ownership links")
        response = self._client().responses.create(model=self.supervisor_model(), input=prompt)
        output = (response.output_text or "").strip()
        if self.tracer:
            self.tracer.tool("OpenAILLM.refine_repo_map", "repo_map", "completed")
        return self._parse_json_object(output)

    def refine_test_inventory(self, inventory: dict) -> dict:
        prompt = dedent(
            f"""
            You are refining test inventory conventions for a JavaScript full-stack repository.
            Use model constraints appropriate for {self.supervisor_model()}.

            Review the discovered inventory and return ONLY JSON.

            Inventory:
            {json.dumps(inventory, indent=2)}

            Return an object with optional keys:
            - command_map
            - conventions

            Rules:
            - Keep the output conservative.
            - Only adjust conventions or commands if the inferred structure is clearly better than the defaults.
            - Return raw JSON only.
            """
        ).strip()
        if self.tracer:
            self.tracer.llm_call("SUPERVISOR", self.supervisor_model(), "Refining test inventory")
        response = self._client().responses.create(model=self.supervisor_model(), input=prompt)
        output = (response.output_text or "").strip()
        if self.tracer:
            self.tracer.tool("OpenAILLM.refine_test_inventory", "test_inventory", "completed")
        return self._parse_json_object(output)

    def supervise_gap_analysis(
        self,
        domain: str,
        backend_files: list[str],
        frontend_files: list[str],
    ) -> dict:
        prompt = dedent(
            f"""
            You are supervising a repository-wide testing gap analysis run.
            Use model constraints appropriate for {self.supervisor_model()}.

            Return ONLY JSON.

            Context:
            The SupervisorAgent has already orchestrated repository mapping and test inventory collection.
            Your job here is to decide how the backend and frontend analyst agents should focus their next analysis pass.

            Requested domain:
            {domain}

            Backend candidate files:
            {json.dumps(backend_files[:80], indent=2)}

            Frontend candidate files:
            {json.dumps(frontend_files[:80], indent=2)}

            Return an object with optional keys:
            - backend_first: boolean
            - focus_note: string
            - focus_paths: array of strings

            Rules:
            - Prefer focusing first on auth, checkout, payment, orders, admin mutations, and route guards.
            - Keep the response conservative and repository-grounded.
            - Return raw JSON only.
            """
        ).strip()
        if self.tracer:
            self.tracer.llm_call("SUPERVISOR", self.supervisor_model(), "Planning gap-analysis dispatch")
        response = self._client().responses.create(model=self.supervisor_model(), input=prompt)
        output = (response.output_text or "").strip()
        if self.tracer:
            self.tracer.tool("OpenAILLM.supervise_gap_analysis", "analyze", "completed")
        return self._parse_json_object(output)

    def review_gap_plan(self, items: list[dict]) -> list[dict]:
        prompt = dedent(
            f"""
            You are the final supervisory review step for a repository testing-gap plan.
            Use model constraints appropriate for {self.supervisor_model()}.

            Review the candidate planned items and return ONLY JSON.

            Planned items:
            {json.dumps(items, indent=2)}

            Return a JSON array of objects with:
            - gap_id: string
            - priority: "P0" | "P1" | "P2"
            - confidence: number from 0 to 0.99

            Rules:
            - Only change priority when the repository-wide context justifies it.
            - Use P0 for auth, order integrity, checkout, payment, admin mutations, and critical route guards.
            - Keep most items unchanged unless there is a strong reason.
            - Return raw JSON only.
            """
        ).strip()
        if self.tracer:
            self.tracer.llm_call("SUPERVISOR", self.supervisor_model(), "Reviewing final gap plan")
        response = self._client().responses.create(model=self.supervisor_model(), input=prompt)
        output = (response.output_text or "").strip()
        if self.tracer:
            self.tracer.tool("OpenAILLM.review_gap_plan", "gap_plan", "completed")
        return self._parse_json_array(output)

    def design_write_fix(
        self,
        plan: GapPlanItem,
        source_snippet: str,
        existing_test_snippet: str | None,
        reference_test_context: str | None,
        failure_feedback: str | None,
        attempt: int,
    ) -> str:
        prompt = dedent(
            f"""
            You are designing one Jest test fix before code generation.
            Use model constraints appropriate for {self.worker_model()}.

            Return a short plain-text design brief only.

            Plan:
            {json.dumps(plan.to_dict(), indent=2)}

            Source snippet:
            {source_snippet}

            Existing target test file content:
            {existing_test_snippet or "No existing file content."}

            Reference test examples and setup hints from this repository:
            {reference_test_context or "No nearby reference tests or setup hints provided."}

            Verification feedback:
            {failure_feedback or "None. First attempt."}

            Attempt:
            {attempt}

            Rules:
            - Identify the exact setup, mocks, trigger, and assertions that should appear in the next test patch.
            - If existing target test file content is provided, design only an incremental block to append rather than a whole-file rewrite.
            - Reuse existing imports, mocks, helpers, and hooks whenever possible.
            - If existing target test file content does not already define something required by the scenario, explicitly call out the missing import/setup such as `app`, `request`, route mounting, MongoMemoryServer, or auth token helpers.
            - For repository auth middleware, call out when the token should be sent as a raw `Authorization` header instead of a Bearer token.
            - For Mongoose-backed route integration tests, call out when a temporary MongoDB harness is required.
            - Mention the negative path explicitly when relevant.
            - Keep the brief under 120 words.
            """
        ).strip()
        if self.tracer:
            self.tracer.llm_call("WORKER", self.worker_model(), f"Designing write fix for {plan.target_file}")
        response = self._client().responses.create(model=self.worker_model(), input=prompt)
        output = (response.output_text or "").strip()
        if self.tracer:
            self.tracer.tool("OpenAILLM.design_write_fix", plan.target_file, "completed")
        return output

    def triage_and_design_gaps(
        self,
        source_file: str,
        source_kind: str,
        candidates: list[dict],
    ) -> list[dict]:
        prompt = dedent(
            f"""
            You are the LLM decision layer for a multi-agent testing system.
            Use model constraints appropriate for {self.worker_model()}.

            Review the candidate testing gaps for one source file and return ONLY JSON.

            Source file:
            {source_file}

            Source kind:
            {source_kind}

            Candidate gaps:
            {json.dumps(candidates, indent=2)}

            Return a JSON array. Each item must have:
            - gap_id: string
            - actionable: boolean
            - priority: "P0" | "P1" | "P2"
            - case_type: "positive" | "negative"
            - behavior_summary: string
            - rationale: string
            - scenario_summary: string
            - confidence: number from 0 to 0.99

            Rules:
            - Be selective. Mark weak, duplicate, or low-value items as actionable false.
            - Prefer negative cases for auth, validation, permissions, middleware rejection, malformed input, and error paths.
            - Prioritize core auth, checkout, payment, order integrity, admin mutations, and destructive flows as P0.
            - Use the provided evidence, route context, target test file, and coverage status when writing rationale.
            - Make the rationale and scenario specific, not generic.
            - Return raw JSON only, no markdown fences.
            """
        ).strip()

        if self.tracer:
            self.tracer.llm_call("WORKER", self.worker_model(), f"Triage/design for {source_file}")
        response = self._client().responses.create(
            model=self.worker_model(),
            input=prompt,
        )
        output = (response.output_text or "").strip()
        if self.tracer:
            self.tracer.tool("OpenAILLM.triage_and_design_gaps", source_file, "completed")
        return self._parse_json_array(output)

    def analyze_backend_file(self, source_file: str, source_kind: str, candidates: list[dict]) -> list[dict]:
        return self._analyze_file_candidates("backend", source_file, source_kind, candidates)

    def analyze_frontend_file(self, source_file: str, source_kind: str, candidates: list[dict]) -> list[dict]:
        return self._analyze_file_candidates("frontend", source_file, source_kind, candidates)

    def summarize_verification_failure(self, plan: GapPlanItem, raw_feedback: str, attempt: int) -> str:
        prompt = dedent(
            f"""
            You are preparing repair guidance for a Jest test regeneration attempt.
            Use model constraints appropriate for {self.worker_model()}.

            Return a short plain-text repair brief only.

            Plan:
            {json.dumps(plan.to_dict(), indent=2)}

            Current attempt:
            {attempt}

            Raw verification output:
            {raw_feedback}

            Rules:
            - Focus on the most likely root cause of failure.
            - Mention the specific missing mock, bad import, assertion mismatch, async issue, or syntax issue if evident.
            - Keep the result under 120 words.
            - Make the guidance directly useful for the next rewrite attempt.
            """
        ).strip()

        if self.tracer:
            self.tracer.llm_call("WORKER", self.worker_model(), f"Summarizing verification failure for {plan.target_file}")
        response = self._client().responses.create(
            model=self.worker_model(),
            input=prompt,
        )
        output = (response.output_text or "").strip()
        if self.tracer:
            self.tracer.tool("OpenAILLM.summarize_verification_failure", plan.target_file, "completed")
        return output

    def summarize_verification_result(self, plan: GapPlanItem, raw_output: str, status: str) -> str:
        prompt = dedent(
            f"""
            You are summarizing a Jest verification result for a testing agent.
            Use model constraints appropriate for {self.worker_model()}.

            Return a short plain-text summary only.

            Plan:
            {json.dumps(plan.to_dict(), indent=2)}

            Verification status:
            {status}

            Raw output:
            {raw_output}

            Rules:
            - Summarize the most important outcome in under 80 words.
            - If failed, mention the likely root cause.
            - If passed, mention the important validated behavior.
            """
        ).strip()
        if self.tracer:
            self.tracer.llm_call("WORKER", self.worker_model(), f"Summarizing verification for {plan.target_file}")
        response = self._client().responses.create(model=self.worker_model(), input=prompt)
        output = (response.output_text or "").strip()
        if self.tracer:
            self.tracer.tool("OpenAILLM.summarize_verification_result", plan.target_file, "completed")
        return output

    def _parse_json_array(self, raw_text: str) -> list[dict]:
        text = raw_text.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:].strip()
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            return []
        if not isinstance(payload, list):
            return []
        return [item for item in payload if isinstance(item, dict)]

    def _parse_json_object(self, raw_text: str) -> dict:
        text = raw_text.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:].strip()
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            return {}
        if not isinstance(payload, dict):
            return {}
        return payload

    def _analyze_file_candidates(self, domain: str, source_file: str, source_kind: str, candidates: list[dict]) -> list[dict]:
        prompt = dedent(
            f"""
            You are the {domain} analyst agent for a multi-agent testing system.
            Use model constraints appropriate for {self.worker_model()}.

            Review the candidate testing gaps for one source file and return ONLY JSON.

            Source file:
            {source_file}

            Source kind:
            {source_kind}

            Candidate gaps:
            {json.dumps(candidates, indent=2)}

            Return a JSON array. Each item must have:
            - gap_id: string
            - analyst_summary: string
            - analyst_rationale: string
            - suggested_focus: "keep" | "drop" | "escalate"
            - analyst_confidence: number from 0 to 0.99

            Rules:
            - Use the candidate evidence, route context, and target file to judge whether the gap is meaningful.
            - Mark low-value, duplicate, or weak candidates as drop.
            - Mark security-sensitive, auth, validation, permission, checkout, payment, or destructive flows as escalate when appropriate.
            - Keep the rationale specific to this source file.
            - Return raw JSON only.
            """
        ).strip()
        if self.tracer:
            self.tracer.llm_call("WORKER", self.worker_model(), f"Analyzing {domain} file {source_file}")
        response = self._client().responses.create(
            model=self.worker_model(),
            input=prompt,
        )
        output = (response.output_text or "").strip()
        if self.tracer:
            self.tracer.tool(f"OpenAILLM.analyze_{domain}_file", source_file, "completed")
        return self._parse_json_array(output)
