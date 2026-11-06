"""Validate this collection's metadata, portable paths, and Markdown file links.

This is a repository contract check, not a full Claude or Codex schema validator.
No network requests, dependency installation, or generated files are involved.
"""

import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
VERSION = re.compile(r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?")
IGNORED = {
    ".git",
    ".venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    "local",
    "corpora",
    "profiles",
    "exports",
}


def files(root):
    """Inspect public source files, excluding conventional private output locations."""
    for path in root.rglob("*"):
        relative = path.relative_to(root)
        if any(part in IGNORED for part in relative.parts):
            continue
        if path.name in {"corpus.md", "draft.md"} or path.name.endswith(
            ("-style.md", "-metrics.json")
        ):
            continue
        if path.is_file() or path.is_symlink():
            yield path


def read_object(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path.name}: expected a JSON object")
    return data


def local_path(root, value):
    if not isinstance(value, str) or not value.startswith("./") or "\\" in value:
        raise ValueError("Plugin source must be a ./ relative path")
    path = (root / value).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("Plugin source escapes the repository")
    return path


def skill_metadata(path):
    """Require simple, single-line name/description YAML fields for this collection."""
    text = path.read_text(encoding="utf-8")
    match = re.match(r"\A---\n(.*?)\n---\n", text, re.S)
    if not match:
        raise ValueError(f"{path}: missing YAML frontmatter")
    fields = {}
    for line in match[1].splitlines():
        key, separator, value = line.partition(":")
        if not separator or key not in {"name", "description"} or key in fields:
            raise ValueError(f"{path}: use unique name and description fields")
        value = value.strip()
        if not value or value in {">", "|"}:
            raise ValueError(f"{path}: {key} must be a nonempty single-line scalar")
        if value.startswith('"'):
            value = json.loads(value)
        elif value.startswith("'"):
            if not value.endswith("'"):
                raise ValueError(f"{path}: unclosed quoted scalar")
            value = value[1:-1].replace("''", "'")
        elif ": " in value or " #" in value or value[0] in "[{!&*":
            raise ValueError(f"{path}: quote YAML-sensitive values")
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{path}: {key} must be text")
        fields[key] = value
    if set(fields) != {"name", "description"}:
        raise ValueError(f"{path}: name and description are required")
    if not SLUG.fullmatch(fields["name"]) or len(fields["name"]) > 64:
        raise ValueError(f"{path}: invalid skill name")
    if fields["name"] != path.parent.name:
        raise ValueError(f"{path}: skill name must match its directory")
    if not text[match.end() :].strip():
        raise ValueError(f"{path}: missing skill instructions")
    return fields


def markdown_links(path, root):
    """Check inline local file links; remote URLs and fragment IDs are out of scope."""
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"```.*?```|~~~.*?~~~", "", text, flags=re.S)
    errors = []
    for target in re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", text):
        target = target.strip().strip("<>")
        parsed = urlsplit(target)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        resolved = (path.parent / unquote(parsed.path)).resolve()
        if not resolved.is_relative_to(root.resolve()) or not resolved.exists():
            errors.append(f"{path.relative_to(root)}: broken or nonportable link: {target}")
    return errors


def validate(root):
    errors = []
    try:
        marketplace = read_object(root / ".claude-plugin/marketplace.json")
        if not SLUG.fullmatch(marketplace.get("name", "")):
            raise ValueError("Invalid marketplace name")
        if not isinstance(marketplace.get("owner"), dict) or not marketplace["owner"].get("name"):
            raise ValueError("Marketplace owner is required")
        entries = marketplace.get("plugins")
        if not isinstance(entries, list) or not entries:
            raise ValueError("Marketplace must list at least one plugin")
        names, sources = set(), set()
        for entry in entries:
            if not isinstance(entry, dict):
                raise ValueError("Plugin entries must be objects")
            name = entry.get("name", "")
            if not isinstance(name, str) or not SLUG.fullmatch(name) or name in names:
                raise ValueError("Invalid or duplicate plugin name")
            names.add(name)
            source = local_path(root, entry.get("source"))
            if source in sources or source != (root / "plugins" / name).resolve():
                raise ValueError("Plugins must have unique sources under plugins/<name>")
            sources.add(source)
            manifest = read_object(source / ".claude-plugin/plugin.json")
            if manifest.get("name") != name:
                raise ValueError(f"{name}: manifest name differs from marketplace")
            if not isinstance(manifest.get("version"), str) or not VERSION.fullmatch(
                manifest["version"]
            ):
                raise ValueError(f"{name}: invalid plugin version")
            for field in ("description", "license"):
                if not isinstance(manifest.get(field), str) or not manifest[field].strip():
                    raise ValueError(f"{name}: missing {field}")
            for required in ("README.md", "LICENSE"):
                if not (source / required).is_file():
                    raise ValueError(f"{name}: missing {required}")
            if not list((source / "skills").glob("*/SKILL.md")):
                raise ValueError(f"{name}: no skills found")
        disk = {
            p.parent.parent.resolve()
            for p in (root / "plugins").glob("*/.claude-plugin/plugin.json")
        }
        if disk != sources:
            raise ValueError("Unlisted plugin manifest or missing plugin source")
    except (OSError, ValueError, TypeError) as error:
        errors.append(str(error))
    for path in files(root):
        if path.is_symlink():
            if path.name != "CLAUDE.md" or path.readlink() != Path("AGENTS.md"):
                errors.append(
                    f"{path.relative_to(root)}: unsupported symlink; package real resources"
                )
            continue
        try:
            if path.name == "SKILL.md":
                skill_metadata(path)
            if path.suffix == ".json":
                json.loads(path.read_text(encoding="utf-8"))
            if path.suffix == ".md":
                errors.extend(markdown_links(path, root))
            if path.suffix in {".md", ".py", ".json", ".yaml", ".yml"}:
                content = path.read_text(encoding="utf-8")
                if re.search(r"/(?:Users|home)/[A-Za-z0-9_.-]+/", content):
                    errors.append(f"{path.relative_to(root)}: machine-specific home path")
                if re.search(r"[\u0400-\u04ff]", content):
                    errors.append(f"{path.relative_to(root)}: untranslated Cyrillic text")
        except (OSError, ValueError) as error:
            errors.append(str(error))
    return errors


def main():
    errors = validate(ROOT)
    for error in errors:
        print(f"error: {error}", file=sys.stderr)
    if not errors:
        print("Repository metadata, skill contracts, and local file links are valid.")
    return int(bool(errors))


if __name__ == "__main__":
    sys.exit(main())
