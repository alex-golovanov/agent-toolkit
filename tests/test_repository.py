"""Repository checks must reject broken manifests and nonportable skills."""

import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("validator", ROOT / "scripts/validate_repository.py")
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


class RepositoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in (".claude-plugin", "plugins"):
            shutil.copytree(
                ROOT / name, self.root / name, ignore=shutil.ignore_patterns("__pycache__")
            )

    def update_json(self, path, transform):
        target = self.root / path
        data = json.loads(target.read_text())
        transform(data)
        target.write_text(json.dumps(data), encoding="utf-8")

    def test_repository_contract(self):
        self.assertEqual(validator.validate(ROOT), [])

    def test_duplicate_plugin_is_rejected(self):
        self.update_json(
            ".claude-plugin/marketplace.json",
            lambda data: data["plugins"].append(data["plugins"][0]),
        )
        self.assertTrue(any("duplicate" in error for error in validator.validate(self.root)))

    def test_escaping_source_is_rejected(self):
        self.update_json(
            ".claude-plugin/marketplace.json",
            lambda data: data["plugins"][0].update(source="./../../outside"),
        )
        self.assertTrue(any("escapes" in error for error in validator.validate(self.root)))

    def test_manifest_name_and_version_are_checked(self):
        path = "plugins/style-skills/.claude-plugin/plugin.json"
        self.update_json(path, lambda data: data.update(version="banana"))
        self.assertTrue(any("version" in error for error in validator.validate(self.root)))
        self.update_json(path, lambda data: data.update(name="different"))
        self.assertTrue(any("name differs" in error for error in validator.validate(self.root)))

    def test_missing_skill_description_is_rejected(self):
        skill = self.root / "plugins/style-skills/skills/style-portrait/SKILL.md"
        skill.write_text("---\nname: style-portrait\n---\n# Instructions\n", encoding="utf-8")
        self.assertTrue(any("description" in error for error in validator.validate(self.root)))

    def test_broken_local_link_is_rejected(self):
        file = self.root / "example.md"
        file.write_text("# Example\n\n[Missing](missing.md)\n", encoding="utf-8")
        self.assertTrue(any("broken" in error for error in validator.validate(self.root)))

    def test_unlisted_plugin_is_rejected(self):
        shutil.copytree(self.root / "plugins/style-skills", self.root / "plugins/unlisted")
        self.assertTrue(any("Unlisted" in error for error in validator.validate(self.root)))

    def test_packaged_plugin_runs_after_relocation(self):
        script = self.root / "plugins/style-skills/skills/style-portrait/style.py"
        corpus = self.root / "sample.md"
        corpus.write_text("We make a small test. Then we read the result.\n", encoding="utf-8")
        result = subprocess.run(
            [sys.executable, str(script), "metrics", str(corpus)],
            cwd=self.root,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("meta / language: en", result.stdout)


if __name__ == "__main__":
    unittest.main()
