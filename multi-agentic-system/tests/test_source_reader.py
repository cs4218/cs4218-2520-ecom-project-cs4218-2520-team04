from __future__ import annotations

import shutil
import unittest
from pathlib import Path

from testing_agents.tools.source_reader import SourceReadTool


FIXTURE_ROOT = Path(__file__).resolve().parent / "_source_reader_fixture"


class SourceReadToolTests(unittest.TestCase):
    def setUp(self) -> None:
        if FIXTURE_ROOT.exists():
            shutil.rmtree(FIXTURE_ROOT)
        FIXTURE_ROOT.mkdir(parents=True)

    def tearDown(self) -> None:
        if FIXTURE_ROOT.exists():
            shutil.rmtree(FIXTURE_ROOT)

    def test_read_full_returns_complete_content_without_truncation(self) -> None:
        content = "import a from 'a';\n" + ("x" * 200)
        path = FIXTURE_ROOT / "sample.test.js"
        path.write_text(content, encoding="utf-8")

        tool = SourceReadTool(FIXTURE_ROOT, max_chars=20)

        self.assertTrue(tool.read("sample.test.js").endswith("[truncated]"))
        self.assertEqual(tool.read_full("sample.test.js"), content)


if __name__ == "__main__":
    unittest.main()
