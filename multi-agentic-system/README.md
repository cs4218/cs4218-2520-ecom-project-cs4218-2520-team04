# Multi-Agentic Testing System

A LangGraph-driven CLI that scans this full-stack repo, plans testing gaps, triages them as `P0` to `P2`, and lets you interactively choose which fixes to write as Jest unit or integration tests.

## Quick start

```powershell
$env:UV_CACHE_DIR = ".uv-cache"
uv sync
uv run testing_agents analyze
uv run testing_agents write
```

## Commands

- `uv run testing_agents analyze`
  - Builds `repo_map.json`, `test_inventory.json`, and `gap_plan.json`.
- `uv run testing_agents write`
  - Opens an interactive CLI, lets you choose fixes, writes tests, and runs targeted Jest verification.

## Requirements

- Python 3.12+
- `uv`
- `ast-grep` on `PATH`
- `OPENAI_API_KEY` for LLM-backed test design/writing

## Model defaults

- Supervisor/orchestration model: `gpt-5.4-mini`
- Worker/test-writing model: `gpt-5.4-nano`

The runtime treats `ast-grep` as a hard requirement and will stop with a health-check error if it is missing.
