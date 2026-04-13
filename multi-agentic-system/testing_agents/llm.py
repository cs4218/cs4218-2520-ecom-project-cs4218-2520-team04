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

    def generate_test_code(
        self,
        plan: GapPlanItem,
        source_snippet: str,
        existing_test_snippet: str | None,
        failure_feedback: str | None = None,
        attempt: int = 1,
    ) -> str:
        prompt = dedent(
            f"""
            You are generating one Jest test patch for a JavaScript full-stack application.
            Use model constraints appropriate for {self.worker_model()}.

            Return ONLY JavaScript test code, no markdown fences.

            Plan:
            {json.dumps(plan.to_dict(), indent=2)}

            Source snippet:
            {source_snippet}

            Existing target test snippet:
            {existing_test_snippet or "No existing file content."}

            Attempt:
            {attempt}

            Verification feedback from the previous failed run:
            {failure_feedback or "None. This is the first attempt."}

            Rules:
            - Preserve existing test style.
            - Write only one focused describe/it block for this gap.
            - If the plan marks this as a negative case, prioritize rejection, validation, unauthorized, forbidden, malformed input, or failure-path assertions over happy-path assertions.
            - Avoid placeholders like TODO.
            - Prefer deterministic mocks.
            - If verification feedback is provided, revise the generated test to address that failure directly.
            """
        ).strip()

        if self.tracer:
            self.tracer.llm_call("WORKER", self.worker_model(), f"Generating test code for {plan.target_file}")
        response = self._client().responses.create(
            model=self.worker_model(),
            input=prompt,
        )
        output = (response.output_text or "").strip()
        if self.tracer:
            self.tracer.tool("OpenAILLM.generate_test_code", plan.target_file, "completed")
        return output

    def summarize_verification_failure(self, plan: GapPlanItem, raw_feedback: str, attempt: int) -> str:
        prompt = dedent(
            f"""
            You are preparing repair guidance for a Jest test regeneration attempt.
            Use model constraints appropriate for {self.supervisor_model()}.

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
            self.tracer.llm_call("SUPERVISOR", self.supervisor_model(), f"Summarizing verification failure for {plan.target_file}")
        response = self._client().responses.create(
            model=self.supervisor_model(),
            input=prompt,
        )
        output = (response.output_text or "").strip()
        if self.tracer:
            self.tracer.tool("OpenAILLM.summarize_verification_failure", plan.target_file, "completed")
        return output
