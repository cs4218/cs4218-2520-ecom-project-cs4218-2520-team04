#!/usr/bin/env python3
"""
AI Behavioural Review — Structured JSON Output

Extracts before/after file content from a PR diff, bundles relevant context
(imports, callers, test files), runs coverage-aware analysis, maps test impact,
and sends it to an LLM for behavioural drift analysis.
Outputs structured JSON for the interactive report site.
"""

import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from openai import OpenAI

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MODEL = "qwen/qwen3-235b-a22b"
MAX_CONTEXT_TOKENS = 80_000
MAX_FILE_SIZE_BYTES = 100_000
SKIP_EXTENSIONS = {
    ".lock", ".sum", ".svg", ".png", ".jpg", ".gif", ".ico",
    ".woff", ".woff2", ".ttf", ".eot", ".map", ".min.js", ".min.css",
    ".pb.go", ".generated.ts",
}
SKIP_PATHS = {"vendor/", "node_modules/", "dist/", "build/", "__pycache__/"}

# ---------------------------------------------------------------------------
# Git helpers
# ---------------------------------------------------------------------------

def run(cmd: list[str]) -> str:
    """Run a command safely without shell interpolation."""
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout.strip()


def changed_files(base: str, head: str) -> list[str]:
    raw = run(["git", "diff", "--name-only", "--diff-filter=ACMR", f"{base}...{head}"])
    return [f for f in raw.splitlines() if f and not _should_skip(f)]


def file_at_ref(path: str, ref: str) -> str | None:
    result = subprocess.run(
        ["git", "show", f"{ref}:{path}"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        return None
    return result.stdout


def unified_diff(base: str, head: str, path: str) -> str:
    return run(["git", "diff", f"{base}...{head}", "--", path])


def diff_stat(base: str, head: str) -> str:
    return run(["git", "diff", "--stat", f"{base}...{head}"])


def _should_skip(path: str) -> bool:
    p = Path(path)
    if p.suffix.lower() in SKIP_EXTENSIONS:
        return True
    for skip in SKIP_PATHS:
        if path.startswith(skip):
            return True
    return False


# ---------------------------------------------------------------------------
# Coverage parsing  (Feature 2)
# ---------------------------------------------------------------------------

def parse_coverage(coverage_path: str, changed: list[str]) -> dict[str, dict]:
    """
    Parse Jest's coverage-final.json and return per-file data for changed files.

    Returns:
        {
          "controllers/authController.js": {
            "pct": 78,
            "covered_statements": 45,
            "total_statements": 58,
            "uncovered_lines": [12, 45, 67],
          },
          ...
        }
    """
    if not coverage_path or not os.path.exists(coverage_path):
        return {}

    try:
        with open(coverage_path) as f:
            coverage = json.load(f)
    except Exception as e:
        print(f"[coverage] Failed to read {coverage_path}: {e}", file=sys.stderr)
        return {}

    result: dict[str, dict] = {}

    for changed_file in changed:
        # Coverage keys are absolute paths; match by normalised suffix
        normalized = changed_file.replace("\\", "/")
        for cov_key, cov_data in coverage.items():
            cov_norm = cov_key.replace("\\", "/")
            if cov_norm.endswith("/" + normalized) or cov_norm == normalized:
                s = cov_data.get("s", {})           # statement counts
                stmt_map = cov_data.get("statementMap", {})

                total = len(s)
                covered = sum(1 for v in s.values() if v > 0)
                pct = round(covered / total * 100) if total > 0 else 100

                uncovered_lines = sorted({
                    stmt_map[sid]["start"]["line"]
                    for sid, count in s.items()
                    if count == 0 and sid in stmt_map
                    and isinstance(stmt_map[sid].get("start"), dict)
                })

                result[changed_file] = {
                    "pct": pct,
                    "covered_statements": covered,
                    "total_statements": total,
                    "uncovered_lines": uncovered_lines,
                }
                break

    if result:
        print(f"[coverage] Loaded data for {len(result)}/{len(changed)} changed files",
              file=sys.stderr)
    else:
        print("[coverage] No matching entries found in coverage report", file=sys.stderr)

    return result


# ---------------------------------------------------------------------------
# Test impact analysis  (Feature 4)
# ---------------------------------------------------------------------------

def find_test_impact(changed: list[str], ref: str) -> dict[str, list[dict]]:
    """
    For each changed source file, find the test files that exercise it.

    Detection strategy (in priority order):
      1. Naming convention  — authController.test.js / authController.spec.js
      2. Import statement   — import { foo } from './authController'
      3. Require statement  — require('../controllers/authController')

    Returns:
        {
          "controllers/authController.js": [
            {"path": "controllers/authController.test.js", "type": "unit"},
            {"path": "tests/integration/backend/auth/login.integration.test.js",
             "type": "integration"},
          ],
          ...
        }
    """
    impact: dict[str, list[dict]] = {}

    all_files = run(["git", "ls-tree", "-r", "--name-only", ref]).splitlines()
    test_files = [
        f for f in all_files
        if (".test." in f or ".spec." in f) and not _should_skip(f)
    ]

    # Pre-read test files once (respect size limit)
    test_contents: dict[str, str] = {}
    for tf in test_files:
        content = file_at_ref(tf, ref)
        if content:
            test_contents[tf] = content[:MAX_FILE_SIZE_BYTES]

    for changed_file in changed:
        stem = Path(changed_file).stem
        name = Path(changed_file).name
        relevant: list[dict] = []
        seen: set[str] = set()

        for tf, content in test_contents.items():
            if tf in seen:
                continue

            tf_stem = (
                Path(tf).stem
                .replace(".test", "").replace(".spec", "")
                .replace("test_", "").replace("_test", "")
            )

            # 1. Naming convention match
            naming_match = tf_stem == stem

            # 2. Import / require match
            import_match = (
                name in content
                or f'"{stem}"' in content
                or f"'{stem}'" in content
                or f"`{stem}`" in content
            )

            if naming_match or import_match:
                seen.add(tf)
                if tf.endswith(".spec.js") or tf.startswith("tests/ui/"):
                    test_type = "e2e"
                elif "integration" in tf:
                    test_type = "integration"
                else:
                    test_type = "unit"
                relevant.append({"path": tf, "type": test_type})

        if relevant:
            impact[changed_file] = relevant

    return impact


# ---------------------------------------------------------------------------
# Context gathering
# ---------------------------------------------------------------------------

def find_related_files(changed: list[str], ref: str) -> list[str]:
    related = set()
    stems = {Path(f).stem for f in changed}
    names = {Path(f).name for f in changed}

    all_files = run(["git", "ls-tree", "-r", "--name-only", ref]).splitlines()

    for f in all_files:
        if _should_skip(f):
            continue
        p = Path(f)

        if any(
            p.stem.replace("test_", "").replace("_test", "").replace(".test", "")
            == stem
            for stem in stems
        ):
            related.add(f)
            continue

        if f not in changed and p.suffix in {".py", ".ts", ".js", ".go", ".rs", ".java"}:
            content = file_at_ref(f, ref)
            if content and any(name in content for name in names):
                related.add(f)

    return sorted(related - set(changed))


def gather_context(base: str, head: str, coverage_data: dict | None = None) -> dict:
    files = changed_files(base, head)
    related = find_related_files(files, head)

    context = {
        "changed_files": [],
        "related_files": [],
        "pr_title": os.environ.get("PR_TITLE", ""),
        "pr_body": os.environ.get("PR_BODY", ""),
    }

    total_chars = 0

    for path in files:
        before = file_at_ref(path, base)
        after = file_at_ref(path, head)
        diff = unified_diff(base, head, path)

        entry = {
            "path": path,
            "diff": diff,
            "before": _truncate(before),
            "after": _truncate(after),
        }

        # Attach per-file coverage when available
        if coverage_data and path in coverage_data:
            entry["coverage"] = coverage_data[path]

        size = sum(len(v or "") for v in [entry["diff"], entry["before"] or "", entry["after"] or ""])
        if total_chars + size > MAX_CONTEXT_TOKENS * 4:
            break
        total_chars += size
        context["changed_files"].append(entry)

    for path in related:
        content = file_at_ref(path, head)
        entry = {"path": path, "content": _truncate(content)}
        size = len(entry.get("content", "") or "")
        if total_chars + size > MAX_CONTEXT_TOKENS * 4:
            break
        total_chars += size
        context["related_files"].append(entry)

    return context


def _truncate(content: str | None, max_bytes: int = MAX_FILE_SIZE_BYTES) -> str | None:
    if content is None:
        return None
    if len(content) > max_bytes:
        return content[:max_bytes] + "\n... [truncated]"
    return content


# ---------------------------------------------------------------------------
# LLM call — coverage-aware structured JSON
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are an AI code reviewer focused exclusively on **behavioural changes**.

Your job is NOT to review code style, naming, formatting, or test quality.
Your job IS to identify whether a pull request changes the runtime behaviour
of the system in ways that existing tests may not cover.

## Process

1. Read the PR description and diff carefully.
2. For each changed file, compare the BEFORE and AFTER versions to understand
   what behaviour has changed (new branches, altered conditions, changed
   defaults, modified error handling, different return values, etc.).
3. If a `coverage` field is present for a file, use it precisely:
   - `pct` — percentage of statements currently covered by tests
   - `uncovered_lines` — exact line numbers with zero test coverage
   When a finding's changed lines overlap with `uncovered_lines`, you can state
   with certainty that the change is NOT tested (set `test_gap` accordingly,
   e.g. "Lines 42–48 have 0% coverage"). Do not guess when data is available.
4. Cross-reference with the related files (importers, test files) to assess
   whether the behavioural change is tested.
5. Flag any behavioural shift that lacks test coverage, especially:
   - Changed boundary conditions (e.g. `>` to `>=`, `0` to `100`)
   - Altered default values or fallback behaviour
   - New or removed error/exception paths
   - Changed function signatures that affect callers
   - Modified business rules or validation logic
   - Race conditions or concurrency changes
   - Silent data transformation changes

## Output format

You MUST respond with ONLY a valid JSON object. No markdown fences, no preamble, no explanation outside the JSON.

{
  "risk": "LOW" | "MEDIUM" | "HIGH",
  "summary": "One-sentence summary of the overall behavioural impact.",
  "findings": [
    {
      "id": 1,
      "title": "Short descriptive title",
      "severity": "low" | "medium" | "high" | "critical",
      "category": "boundary-change" | "default-change" | "error-handling" | "signature-change" | "business-logic" | "concurrency" | "data-transform" | "security" | "performance" | "other",
      "file": "path/to/file",
      "line_start": 10,
      "line_end": 25,
      "behaviour_change": "What changed and why it matters",
      "test_gap": "What is not tested, or 'Covered' if it is. If coverage data is available, cite exact line numbers.",
      "suggestion": "Specific test case or edge case to add",
      "code_before": "the relevant old code snippet (max 8 lines)",
      "code_after": "the relevant new code snippet (max 8 lines)"
    }
  ]
}

If there are NO behavioural concerns, return:
{
  "risk": "LOW",
  "summary": "No behavioural drift detected. All changes appear to preserve existing behaviour or are covered by tests.",
  "findings": []
}
"""


def call_llm(context: dict, retries: int = 3) -> dict:
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ["OPENROUTER_API_KEY"],
    )

    user_message = f"""\
## Pull Request

**Title**: {context["pr_title"]}
**Description**: {context["pr_body"] or "No description provided."}

## Changed Files

{_format_changed_files(context["changed_files"])}

## Related Files (imports, tests, callers)

{_format_related_files(context["related_files"])}

Analyse the behavioural changes and produce your review as JSON.
"""

    for attempt in range(retries):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                max_tokens=4096,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
            )

            raw = response.choices[0].message.content.strip()

            # Strip markdown fences if the model wraps them anyway
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1]
                if raw.endswith("```"):
                    raw = raw[: raw.rfind("```")]
                raw = raw.strip()

            return json.loads(raw)

        except json.JSONDecodeError as e:
            print(f"[attempt {attempt+1}] JSON parse error: {e}", file=sys.stderr)
            if attempt == retries - 1:
                return {
                    "risk": "MEDIUM",
                    "summary": "AI review completed but produced unstructured output.",
                    "findings": [],
                    "_raw_output": raw,
                }
        except Exception as e:
            print(f"[attempt {attempt+1}] API error: {e}", file=sys.stderr)
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                return {
                    "risk": "UNKNOWN",
                    "summary": f"AI review failed after {retries} attempts: {e}",
                    "findings": [],
                }


def _format_changed_files(files: list[dict]) -> str:
    parts = []
    for f in files:
        part = f"### `{f['path']}`\n\n"

        # Coverage annotation — gives the LLM precise data instead of guesses
        if cov := f.get("coverage"):
            part += f"**Coverage**: {cov['pct']}% of statements covered."
            if cov.get("uncovered_lines"):
                lines_str = ", ".join(str(ln) for ln in cov["uncovered_lines"][:30])
                part += f" Uncovered lines: {lines_str}."
            part += "\n\n"

        part += f"**Diff:**\n```\n{f['diff']}\n```\n\n"
        if f.get("before"):
            part += f"**Before (full file):**\n```\n{f['before']}\n```\n\n"
        if f.get("after"):
            part += f"**After (full file):**\n```\n{f['after']}\n```\n\n"
        parts.append(part)
    return "\n---\n".join(parts) if parts else "No changed files to review."


def _format_related_files(files: list[dict]) -> str:
    parts = []
    for f in files:
        part = f"### `{f['path']}`\n```\n{f.get('content', 'N/A')}\n```"
        parts.append(part)
    return "\n---\n".join(parts) if parts else "No related files found."


# ---------------------------------------------------------------------------
# Build full report data
# ---------------------------------------------------------------------------

def build_report_data(
    base: str,
    head: str,
    context: dict,
    review: dict,
    test_impact: dict | None = None,
    coverage_data: dict | None = None,
) -> dict:
    """Assemble the complete data object for the HTML report."""

    pr_number = os.environ.get("PR_NUMBER", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    pr_url = f"https://github.com/{repo}/pull/{pr_number}" if repo and pr_number else ""

    file_summaries = []
    for cf in context["changed_files"]:
        additions = sum(1 for line in (cf.get("diff") or "").splitlines()
                        if line.startswith("+") and not line.startswith("+++"))
        deletions = sum(1 for line in (cf.get("diff") or "").splitlines()
                        if line.startswith("-") and not line.startswith("---"))

        file_findings = [f for f in review.get("findings", []) if f.get("file") == cf["path"]]

        entry = {
            "path": cf["path"],
            "language": Path(cf["path"]).suffix.lstrip("."),
            "additions": additions,
            "deletions": deletions,
            "diff": cf.get("diff", ""),
            "before": cf.get("before"),
            "after": cf.get("after"),
            "finding_count": len(file_findings),
            "max_severity": max(
                (f.get("severity", "low") for f in file_findings),
                key=lambda s: ["low", "medium", "high", "critical"].index(s)
                              if s in ["low", "medium", "high", "critical"] else 0,
                default="low"
            ) if file_findings else None,
        }

        # Attach coverage per file
        if coverage_data and cf["path"] in coverage_data:
            entry["coverage"] = coverage_data[cf["path"]]

        file_summaries.append(entry)

    stat = diff_stat(base, head)

    return {
        "metadata": {
            "pr_title": os.environ.get("PR_TITLE", ""),
            "pr_body": os.environ.get("PR_BODY", ""),
            "pr_number": pr_number,
            "pr_url": pr_url,
            "repo": repo,
            "base_sha": base[:8],
            "head_sha": head[:8],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model": MODEL,
            "diff_stat": stat,
            "coverage_available": bool(coverage_data),
        },
        "review": review,
        "files": file_summaries,
        "related_files": [
            {"path": rf["path"], "language": Path(rf["path"]).suffix.lstrip(".")}
            for rf in context.get("related_files", [])
        ],
        # Test impact map: changed_file → list of {path, type} test files
        "test_impact": test_impact or {},
        # generated_tests is populated later by generate_tests.py
        "generated_tests": [],
    }


# ---------------------------------------------------------------------------
# Markdown comment (for PR comment)
# ---------------------------------------------------------------------------

def format_markdown_comment(review: dict, report_url: str, test_impact: dict) -> str:
    """Generate a concise PR comment that links to the full report."""
    risk = review.get("risk", "UNKNOWN")
    summary = review.get("summary", "")
    findings = review.get("findings", [])
    n = len(findings)

    risk_emoji = {"LOW": "🟢", "MEDIUM": "🟡", "HIGH": "🔴"}.get(risk, "⚪")

    lines = [
        "## 🤖 AI Behavioural Review",
        "",
        f"**Risk: {risk_emoji} {risk}** — {summary}",
        "",
    ]

    if findings:
        lines.append(f"### {n} Finding{'s' if n != 1 else ''}")
        lines.append("")
        lines.append("| # | Severity | File | Title |")
        lines.append("|---|----------|------|-------|")
        for f in findings:
            sev_emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(
                f.get("severity", "low"), "⚪"
            )
            lines.append(
                f"| {f.get('id', '-')} | {sev_emoji} {f.get('severity', 'low').title()} "
                f"| `{f.get('file', '')}` | {f.get('title', '')} |"
            )
        lines.append("")

    # Test impact summary
    if test_impact:
        total_tests = sum(len(v) for v in test_impact.values())
        lines.append(f"### 🎯 Test Impact — {total_tests} test file(s) affected")
        lines.append("")
        for src_file, tests in test_impact.items():
            unit = [t for t in tests if t["type"] == "unit"]
            intg = [t for t in tests if t["type"] == "integration"]
            e2e  = [t for t in tests if t["type"] == "e2e"]
            badges = " ".join(filter(None, [
                f"`{len(unit)} unit`" if unit else "",
                f"`{len(intg)} integration`" if intg else "",
                f"`{len(e2e)} e2e`" if e2e else "",
            ]))
            lines.append(f"- `{src_file}` → {badges}")
        lines.append("")

    if report_url:
        lines.append(f"📊 **[View Full Interactive Report]({report_url})**")
        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    base = os.environ["BASE_SHA"]
    head = os.environ["HEAD_SHA"]
    output_dir = os.environ.get("OUTPUT_DIR", ".")
    coverage_file = os.environ.get("COVERAGE_FILE", "")

    files = changed_files(base, head)

    if not files:
        review = {
            "risk": "LOW",
            "summary": "No reviewable source files changed in this PR.",
            "findings": [],
        }
        context = {
            "changed_files": [],
            "related_files": [],
            "pr_title": os.environ.get("PR_TITLE", ""),
            "pr_body": os.environ.get("PR_BODY", ""),
        }
        coverage_data: dict = {}
        impact: dict = {}
    else:
        # Feature 2: parse coverage data before gathering context
        coverage_data = parse_coverage(coverage_file, files)

        # Feature 4: compute test impact
        impact = find_test_impact(files, head)
        if impact:
            total = sum(len(v) for v in impact.values())
            print(f"[impact] {total} test file(s) affected across {len(impact)} source file(s)",
                  file=sys.stderr)

        context = gather_context(base, head, coverage_data)
        review = call_llm(context)

    report_data = build_report_data(base, head, context, review, impact, coverage_data)

    # Write JSON data for the HTML report
    json_path = os.path.join(output_dir, "report_data.json")
    with open(json_path, "w") as f:
        json.dump(report_data, f, indent=2)
    print(f"Report data written to {json_path}", file=sys.stderr)

    # Write the markdown comment for the PR
    report_url = os.environ.get("REPORT_URL", "")
    md = format_markdown_comment(review, report_url, impact)
    md_path = os.path.join(output_dir, "review_comment.md")
    with open(md_path, "w") as f:
        f.write(md)
    print(f"Markdown comment written to {md_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
