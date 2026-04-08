#!/usr/bin/env python3
"""
AI Behavioural Review — Structured JSON Output

Extracts before/after file content from a PR diff, bundles relevant context
(imports, callers, test files), and sends it to an LLM for behavioural drift
analysis. Outputs structured JSON for the interactive report site.
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


def gather_context(base: str, head: str) -> dict:
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
        size = sum(len(v or "") for v in entry.values())
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
# LLM call — now requests structured JSON
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
3. Cross-reference with the related files (importers, test files) to assess
   whether the behavioural change is tested.
4. Flag any behavioural shift that lacks test coverage, especially:
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
      "test_gap": "What is not tested, or 'Covered' if it is",
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
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
            )

            raw = response.choices[0].message.content.strip()

            # Strip markdown fences if the model wraps them
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1]
                if raw.endswith("```"):
                    raw = raw[: raw.rfind("```")]
                raw = raw.strip()

            return json.loads(raw)

        except json.JSONDecodeError as e:
            print(f"[attempt {attempt+1}] JSON parse error: {e}", file=sys.stderr)
            if attempt == retries - 1:
                # Return a fallback with the raw text
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

def build_report_data(base: str, head: str, context: dict, review: dict) -> dict:
    """Assemble the complete data object for the HTML report."""

    pr_number = os.environ.get("PR_NUMBER", "")
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    pr_url = f"https://github.com/{repo}/pull/{pr_number}" if repo and pr_number else ""

    # Build file-level info
    file_summaries = []
    for cf in context["changed_files"]:
        # Count additions / deletions from the diff
        additions = sum(1 for line in (cf.get("diff") or "").splitlines() if line.startswith("+") and not line.startswith("+++"))
        deletions = sum(1 for line in (cf.get("diff") or "").splitlines() if line.startswith("-") and not line.startswith("---"))

        # Count findings for this file
        file_findings = [f for f in review.get("findings", []) if f.get("file") == cf["path"]]

        file_summaries.append({
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
                key=lambda s: ["low", "medium", "high", "critical"].index(s) if s in ["low", "medium", "high", "critical"] else 0,
                default="low"
            ) if file_findings else None,
        })

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
        },
        "review": review,
        "files": file_summaries,
        "related_files": [
            {"path": rf["path"], "language": Path(rf["path"]).suffix.lstrip(".")}
            for rf in context.get("related_files", [])
        ],
    }


# ---------------------------------------------------------------------------
# Markdown comment (kept for PR comment)
# ---------------------------------------------------------------------------

def format_markdown_comment(review: dict, report_url: str) -> str:
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
            sev_emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(f.get("severity", "low"), "⚪")
            lines.append(f"| {f.get('id', '-')} | {sev_emoji} {f.get('severity', 'low').title()} | `{f.get('file', '')}` | {f.get('title', '')} |")
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

    files = changed_files(base, head)
    if not files:
        # No-op review
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
    else:
        context = gather_context(base, head)
        review = call_llm(context)

    report_data = build_report_data(base, head, context, review)

    # Write JSON data for the HTML report
    json_path = os.path.join(output_dir, "report_data.json")
    with open(json_path, "w") as f:
        json.dump(report_data, f, indent=2)

    print(f"Report data written to {json_path}", file=sys.stderr)

    # Write the markdown comment for the PR
    report_url = os.environ.get("REPORT_URL", "")
    md = format_markdown_comment(review, report_url)
    md_path = os.path.join(output_dir, "review_comment.md")
    with open(md_path, "w") as f:
        f.write(md)

    print(f"Markdown comment written to {md_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
