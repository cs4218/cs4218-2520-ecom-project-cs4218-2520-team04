#!/usr/bin/env python3
"""
AI Behavioural Review — Minimal PR Reviewer

Extracts before/after file content from a PR diff, bundles relevant context
(imports, callers, test files), and sends it to an LLM for behavioural drift
analysis. Outputs a Markdown PR comment with risk classification.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

from openai import OpenAI

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
# OpenRouter model identifier — swap to any model available on OpenRouter.
# See https://openrouter.ai/models for the full list.
MODEL = "qwen/qwen3.5-27b"
MAX_CONTEXT_TOKENS = 80_000          # leave headroom in 128k window
MAX_FILE_SIZE_BYTES = 100_000        # skip huge generated files
SKIP_EXTENSIONS = {
    ".lock", ".sum", ".svg", ".png", ".jpg", ".gif", ".ico",
    ".woff", ".woff2", ".ttf", ".eot", ".map", ".min.js", ".min.css",
    ".pb.go", ".generated.ts",
}
SKIP_PATHS = {"vendor/", "node_modules/", "dist/", "build/", "__pycache__/"}

# ---------------------------------------------------------------------------
# Git helpers
# ---------------------------------------------------------------------------

def run(cmd: str) -> str:
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip()


def changed_files(base: str, head: str) -> list[str]:
    """Return list of files changed between base and head commits."""
    raw = run(f"git diff --name-only --diff-filter=ACMR {base}...{head}")
    return [f for f in raw.splitlines() if f and not _should_skip(f)]


def file_at_ref(path: str, ref: str) -> str | None:
    """Return file content at a given git ref, or None if it didn't exist."""
    result = subprocess.run(
        f"git show {ref}:{path}",
        shell=True, capture_output=True, text=True,
    )
    if result.returncode != 0:
        return None
    return result.stdout


def unified_diff(base: str, head: str, path: str) -> str:
    return run(f"git diff {base}...{head} -- {path}")


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
    """
    Find test files and direct importers for the changed files.
    This is a lightweight heuristic — not a full dependency graph.
    """
    related = set()
    stems = {Path(f).stem for f in changed}
    names = {Path(f).name for f in changed}

    # Walk the repo at HEAD for test files and simple import matches
    all_files = run(f"git ls-tree -r --name-only {ref}").splitlines()

    for f in all_files:
        if _should_skip(f):
            continue
        p = Path(f)

        # Test file that matches a changed file by name convention
        if any(
            p.stem.replace("test_", "").replace("_test", "").replace(".test", "")
            == stem
            for stem in stems
        ):
            related.add(f)
            continue

        # File that imports one of the changed files (cheap grep)
        if f not in changed and p.suffix in {".py", ".ts", ".js", ".go", ".rs", ".java"}:
            content = file_at_ref(f, ref)
            if content and any(name in content for name in names):
                related.add(f)

    return sorted(related - set(changed))


def gather_context(base: str, head: str) -> dict:
    """Build the full context payload to send to the LLM."""
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
        if total_chars + size > MAX_CONTEXT_TOKENS * 4:  # rough char estimate
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
# LLM call
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

Respond with ONLY the following Markdown structure. No preamble.

## 🤖 AI Behavioural Review

**Risk: [LOW | MEDIUM | HIGH]**

> One-sentence summary of the overall behavioural impact.

### Findings

For each finding:

#### [n]. [Short title]

- **File**: `path/to/file`
- **Lines**: [approximate line range]
- **Behaviour change**: [What changed and why it matters]
- **Test gap**: [What is not tested, or "Covered" if it is]
- **Suggestion**: [Specific test case or edge case to add]

If there are NO behavioural concerns, output:

## 🤖 AI Behavioural Review

**Risk: LOW**

> No behavioural drift detected. All changes appear to preserve existing behaviour or are covered by tests.

### Findings

No issues found.
"""


def call_llm(context: dict) -> str:
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

Analyse the behavioural changes and produce your review.
"""

    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=4096,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
    )

    return response.choices[0].message.content


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
# Main
# ---------------------------------------------------------------------------

def main():
    base = os.environ["BASE_SHA"]
    head = os.environ["HEAD_SHA"]

    # Quick exit: if no meaningful files changed, skip the review
    files = changed_files(base, head)
    if not files:
        print("## 🤖 AI Behavioural Review\n\n**Risk: LOW**\n\n"
              "> No reviewable source files changed in this PR.\n\n"
              "### Findings\n\nNo issues found.")
        return

    context = gather_context(base, head)
    review = call_llm(context)
    print(review)


if __name__ == "__main__":
    main()
