#!/usr/bin/env python3
"""
Build the interactive HTML review report.

Reads report_data.json and injects it into report_template.html,
producing a self-contained index.html for GitHub Pages.
"""

import json
import os
import shutil
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
TEMPLATE_PATH = SCRIPT_DIR / "report_template.html"


def main():
    data_path = sys.argv[1] if len(sys.argv) > 1 else "report_data.json"
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "site"

    # Read inputs
    with open(data_path) as f:
        report_data = json.load(f)

    with open(TEMPLATE_PATH) as f:
        template = f.read()

    # Inject data
    data_json = json.dumps(report_data, ensure_ascii=False)
    html = template.replace("__REPORT_DATA__", data_json)
    html = html.replace("{{PR_TITLE}}", report_data.get("metadata", {}).get("pr_title", "AI Review"))

    # Write output
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    # Write the main report as index.html
    (out / "index.html").write_text(html, encoding="utf-8")

    # Also keep a copy of the raw JSON for API consumers
    shutil.copy2(data_path, out / "report_data.json")

    # Write a small .nojekyll so GitHub Pages serves raw HTML
    (out / ".nojekyll").touch()

    print(f"Report built → {out / 'index.html'}", file=sys.stderr)

    # If there are previous reports, build an index listing them
    history_dir = os.environ.get("HISTORY_DIR")
    if history_dir and Path(history_dir).exists():
        build_history_index(out, Path(history_dir))


def build_history_index(out: Path, history_dir: Path):
    """Build a landing page that lists all PR reviews."""
    entries = []
    for d in sorted(history_dir.iterdir(), reverse=True):
        meta_file = d / "report_data.json"
        if meta_file.exists():
            try:
                with open(meta_file) as f:
                    meta = json.load(f).get("metadata", {})
                entries.append({
                    "dir": d.name,
                    "pr_number": meta.get("pr_number", ""),
                    "pr_title": meta.get("pr_title", "Unknown"),
                    "timestamp": meta.get("timestamp", ""),
                    "risk": "",  # could be read from review
                })
            except Exception:
                pass

    if not entries:
        return

    rows = "\n".join(
        f'<tr><td><a href="pr/{e["dir"]}/index.html">#{e["pr_number"]}</a></td>'
        f'<td>{e["pr_title"]}</td><td>{e["timestamp"][:10]}</td></tr>'
        for e in entries
    )
    index_html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>AI Reviews</title>
<style>
body {{ font-family: -apple-system, sans-serif; background: #0d1117; color: #e6edf3; padding: 40px }}
table {{ border-collapse: collapse; width: 100% }}
th, td {{ padding: 10px 16px; border-bottom: 1px solid #30363d; text-align: left }}
a {{ color: #58a6ff }}
</style></head><body>
<h1>AI Review History</h1>
<table><thead><tr><th>PR</th><th>Title</th><th>Date</th></tr></thead>
<tbody>{rows}</tbody></table>
</body></html>"""
    (out / "history.html").write_text(index_html, encoding="utf-8")


if __name__ == "__main__":
    main()
