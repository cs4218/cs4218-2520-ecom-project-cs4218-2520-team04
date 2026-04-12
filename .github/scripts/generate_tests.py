#!/usr/bin/env python3
"""
Generate targeted test cases for behavioural gaps found by the AI reviewer.

Reads report_data.json, and for each finding where test_gap is not "Covered",
calls the LLM to produce a ready-to-run Jest (unit or integration) or Playwright
test block that validates the specific edge case.

Writes the suggestions back into report_data.json under the "generated_tests" key,
and appends a markdown summary to review_comment.md so developers see them in the PR.

Usage:
    python generate_tests.py <report_data.json> <review_comment.md>
"""

import json
import os
import sys
import time
from pathlib import Path

from openai import OpenAI

MODEL = os.environ.get("REVIEW_MODEL", "qwen/qwen3-235b-a22b")
MAX_FILE_CHARS = 4_000   # characters of source / test file to include in prompt
MAX_RETRIES = 3

# ---------------------------------------------------------------------------
# Test convention examples  (mirrors the project's actual patterns)
# ---------------------------------------------------------------------------

UNIT_EXAMPLE = """\
// ── Unit test pattern (Jest + mocks) ──────────────────────────────────────
import { myController } from "./myController";
import myModel from "../models/myModel.js";

jest.mock("../models/myModel.js");

describe("myController", () => {
    let req, res;

    beforeEach(() => {
        req = { body: {}, params: {}, user: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            send:   jest.fn().mockReturnThis(),
            json:   jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
        jest.spyOn(console, "log").mockImplementation(() => {});
    });

    it("should reject a price of zero", async () => {
        req.body = { price: 0 };
        await myController(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Price must be positive" })
        );
    });
});
"""

INTEGRATION_EXAMPLE = """\
// ── Integration test pattern (Jest + supertest + MongoMemoryServer) ────────
import mongoose from "mongoose";
import request  from "supertest";
import express  from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import { myController } from "../../../../controllers/myController.js";
import MyModel from "../../../../models/myModel.js";

let mongod, app;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    const router = express.Router();
    router.post("/endpoint", myController);

    app = express();
    app.use(express.json());
    app.use("/api/v1", router);
});

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
});

afterEach(async () => { await MyModel.deleteMany({}); });

it("should reject a price of zero", async () => {
    const res = await request(app)
        .post("/api/v1/endpoint")
        .send({ price: 0 });

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ message: "Price must be positive" });
});
"""

E2E_EXAMPLE = """\
// ── E2E test pattern (Playwright) ──────────────────────────────────────────
import { test, expect } from "@playwright/test";

test.describe("E2E: Feature edge case", () => {
    test("should show error when price is zero", async ({ page }) => {
        await page.goto("/some-page");
        await page.getByLabel("Price").fill("0");
        await page.getByRole("button", { name: /submit/i }).click();
        await expect(
            page.getByText(/price must be positive/i)
        ).toBeVisible({ timeout: 5000 });
    });
});
"""

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a test engineer for a MERN-stack e-commerce application
(Node.js/Express backend, React.js frontend, MongoDB).

You are given a specific behavioural finding from an AI code review.
Your job: write ONE targeted Jest or Playwright test block that directly
exercises the identified edge case, so the regression cannot slip through CI.

## Rules
1. Follow the provided test convention examples exactly
   (same imports, mock patterns, assertion style, describe/it structure).
2. Output ONLY the new `it(...)` or `test(...)` block — no full-file boilerplate.
   The block will be inserted into an existing test file.
3. The test MUST FAIL if the old (pre-change) behaviour is restored,
   and MUST PASS with the new (post-change) behaviour.
4. Add a single-line comment immediately above the `it(...)` explaining
   which behavioural change this test guards against.
5. Keep it focused: one test, one edge case, no padding.

## Output format
Respond with ONLY a valid JSON object — no markdown, no extra text:

{
  "test_type": "unit" | "integration" | "e2e",
  "test_file": "relative/path/to/existing/test/file.test.js",
  "insert_into_describe": "Exact name of the describe block to insert into, or null for top-level",
  "description": "One sentence: the behavioural guarantee this test provides",
  "code": "the it(...) / test(...) block as a string (use \\n for newlines)",
  "confidence": "high" | "medium" | "low",
  "confidence_reason": "Brief explanation of confidence level"
}
"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _read_safely(path: str, max_chars: int = MAX_FILE_CHARS) -> str | None:
    try:
        text = Path(path).read_text(encoding="utf-8")
        return text[:max_chars] if len(text) > max_chars else text
    except Exception:
        return None


def _pick_examples(file_path: str) -> str:
    """Return the most relevant test examples for the file being changed."""
    if file_path.startswith("client/") or file_path.endswith((".jsx", ".tsx")):
        return E2E_EXAMPLE + "\n\n---\n\n" + UNIT_EXAMPLE
    return UNIT_EXAMPLE + "\n\n---\n\n" + INTEGRATION_EXAMPLE


def _find_best_test_file(
    source_path: str,
    report_data: dict,
) -> tuple[str | None, str | None]:
    """
    Return (test_file_path, test_file_content) for the most relevant test file.
    Priority: unit > integration > e2e (for backend files; reversed for frontend).
    """
    stem = Path(source_path).stem
    is_frontend = source_path.startswith("client/")

    # 1. Check test_impact map (most reliable — import-verified)
    impact = report_data.get("test_impact", {})
    candidates = impact.get(source_path, [])

    preferred_type = "e2e" if is_frontend else "unit"
    fallback_type  = "unit" if is_frontend else "integration"

    for ttype in (preferred_type, fallback_type, "e2e", "unit", "integration"):
        for entry in candidates:
            if entry.get("type") == ttype:
                content = _read_safely(entry["path"])
                if content:
                    return entry["path"], content

    # 2. Check related_files from the report (naming-convention match)
    for rf in report_data.get("related_files", []):
        rp = rf.get("path", "")
        rstem = Path(rp).stem.replace(".test", "").replace(".spec", "")
        if rstem == stem and (".test." in rp or ".spec." in rp) and "integration" not in rp:
            content = _read_safely(rp)
            if content:
                return rp, content

    return None, None


# ---------------------------------------------------------------------------
# LLM call
# ---------------------------------------------------------------------------

def generate_test_for_finding(
    finding: dict,
    file_after: str | None,
    test_file_path: str | None,
    test_file_content: str | None,
    client: OpenAI,
) -> dict:
    file_path = finding.get("file", "")
    examples = _pick_examples(file_path)

    cov_info = ""
    if cov := finding.get("_coverage"):
        uncovered = cov.get("uncovered_lines", [])[:20]
        cov_info = (
            f"\n**Coverage**: {cov['pct']}% of statements covered."
            + (f" Uncovered lines: {uncovered}." if uncovered else "")
        )

    test_file_hint = (
        f"`{test_file_path}`" if test_file_path
        else "no existing test file found — create for a new test file"
    )

    user_message = f"""\
## Finding to test

**Title**: {finding.get('title')}
**Severity**: {finding.get('severity')} | **Category**: {finding.get('category')}
**File**: `{file_path}` (lines {finding.get('line_start')}–{finding.get('line_end')}){cov_info}

**Behaviour change**:
{finding.get('behaviour_change')}

**Test gap**:
{finding.get('test_gap')}

**Suggested test scenario**:
{finding.get('suggestion')}

**Code before**:
```
{finding.get('code_before') or 'N/A'}
```

**Code after**:
```
{finding.get('code_after') or 'N/A'}
```

---

## Source file after change (truncated)

```javascript
{(file_after or 'N/A')[:MAX_FILE_CHARS]}
```

---

## Target test file: {test_file_hint}

```javascript
{(test_file_content or '// No existing test file found.')}
```

---

## Test convention examples

{examples}

---

Generate ONE targeted test block for the finding above.
"""

    last_error: str = "unknown error"
    for attempt in range(MAX_RETRIES):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                max_tokens=1024,
                temperature=0.1,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": user_message},
                ],
            )
            raw = response.choices[0].message.content.strip()
            return json.loads(raw)

        except json.JSONDecodeError as e:
            last_error = f"JSON parse error: {e}"
            print(f"  [attempt {attempt+1}] {last_error}", file=sys.stderr)

        except Exception as e:
            last_error = str(e)
            print(f"  [attempt {attempt+1}] API error: {e}", file=sys.stderr)
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** attempt)

    return {
        "test_type": "unit",
        "test_file": test_file_path or "",
        "insert_into_describe": None,
        "description": f"Generation failed: {last_error}",
        "code": "",
        "confidence": "low",
        "confidence_reason": last_error,
    }


# ---------------------------------------------------------------------------
# Markdown comment formatter
# ---------------------------------------------------------------------------

def format_tests_comment(results: list[dict]) -> str:
    """Append a generated-tests section to the PR comment."""
    if not results:
        return ""

    successful = [r for r in results if r.get("code")]
    if not successful:
        return ""

    lines = [
        "",
        "---",
        "",
        "## 🧪 Generated Test Suggestions",
        "",
        f"The AI produced **{len(successful)}** test suggestion(s) for the findings above.",
        "Review, adjust, and add them to the appropriate test files.",
        "",
    ]

    conf_emoji = {"high": "🟢", "medium": "🟡", "low": "🔴"}

    for r in successful:
        conf = r.get("confidence", "low")
        emoji = conf_emoji.get(conf, "⚪")
        sev_emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(
            r.get("finding_severity", "low"), "⚪"
        )
        lines += [
            f"<details>",
            f"<summary>{sev_emoji} <strong>Finding #{r['finding_id']}</strong>: "
            f"{r['finding_title']} &nbsp;|&nbsp; "
            f"{emoji} {conf.title()} confidence &nbsp;|&nbsp; "
            f"<code>{r.get('test_type', 'unit')}</code> test</summary>",
            "",
            f"**Insert into**: `{r.get('test_file') or 'new test file'}`",
            f"**Description**: {r.get('description', '')}",
            "",
            "```javascript",
            r.get("code", ""),
            "```",
            "",
            "</details>",
            "",
        ]

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    report_path  = sys.argv[1] if len(sys.argv) > 1 else "report_data.json"
    comment_path = sys.argv[2] if len(sys.argv) > 2 else "review_comment.md"

    with open(report_path) as f:
        report_data = json.load(f)

    findings = report_data.get("review", {}).get("findings", [])
    files_by_path = {fi["path"]: fi for fi in report_data.get("files", [])}

    # Only generate for findings with real, uncovered test gaps
    actionable = [
        fi for fi in findings
        if fi.get("test_gap", "").strip().lower() not in {"covered", "n/a", ""}
    ]

    if not actionable:
        print("[generate_tests] No test gaps to generate for.", file=sys.stderr)
        # Still persist (empty) generated_tests key so the report renders cleanly
        report_data["generated_tests"] = []
        with open(report_path, "w") as f:
            json.dump(report_data, f, indent=2)
        return

    print(f"[generate_tests] Generating tests for {len(actionable)} finding(s)...",
          file=sys.stderr)

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ["OPENROUTER_API_KEY"],
    )

    results: list[dict] = []

    for finding in actionable:
        fid = finding.get("id", "?")
        print(f"  [{fid}] {finding.get('title', '')}", file=sys.stderr)

        file_path = finding.get("file", "")
        file_ctx  = files_by_path.get(file_path, {})
        file_after = file_ctx.get("after") or file_ctx.get("content")

        # Attach coverage context to the finding dict (used in prompt only)
        if cov := file_ctx.get("coverage"):
            finding["_coverage"] = cov

        test_file_path, test_file_content = _find_best_test_file(file_path, report_data)

        generated = generate_test_for_finding(
            finding, file_after, test_file_path, test_file_content, client
        )

        results.append({
            "finding_id":       fid,
            "finding_title":    finding.get("title", ""),
            "finding_severity": finding.get("severity", "low"),
            "finding_file":     file_path,
            **generated,
        })

        time.sleep(0.5)  # rate-limit courtesy

    # Write generated tests back into report_data.json so the HTML report can render them
    report_data["generated_tests"] = results
    with open(report_path, "w") as f:
        json.dump(report_data, f, indent=2)
    print(f"[generate_tests] Updated report_data.json with {len(results)} test(s)",
          file=sys.stderr)

    # Append generated-tests section to the PR comment markdown
    if os.path.exists(comment_path):
        with open(comment_path, "a") as f:
            f.write(format_tests_comment(results))
        print(f"[generate_tests] Appended test suggestions to {comment_path}",
              file=sys.stderr)


if __name__ == "__main__":
    main()
