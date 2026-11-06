# Contributing

Changes should add a useful, portable capability with clear scope and tests that can detect
regressions. Use American English and preserve upstream attribution.

## Development setup

Follow the [README setup](README.md#develop). Dependency installation is a manual contributor
action; checks and hooks must not install tools automatically. New dependencies need maintainer
approval. Direct development versions are pinned; Bun's committed lockfile also fixes the JavaScript
dependency graph.

Before submitting:

```bash
make format PYTHON=.venv/bin/python
make check PYTHON=.venv/bin/python
git diff --check
```

Python formatting and linting use Ruff. Documentation and manifest formatting use Prettier; Markdown
structure uses markdownlint-cli2. Tests use unittest-compatible cases and run under pytest in the
full gate. A standard-library run exercises the same cases, but is not a substitute for all
development checks.

## Add a skill or plugin

1. Put a standalone skill in `skills/<name>/`, or a bundled skill in
   `plugins/<plugin>/skills/<name>/`.
2. Add `SKILL.md` with unique, single-line YAML `name` and `description` fields. Use a lowercase
   hyphenated name matching the folder. Quote YAML-sensitive descriptions. Put operational guidance
   in the body, not in a long trigger list.
3. Keep supporting code, references, and assets within the installable unit. Resolve resources from
   the loaded skill location. Do not hardcode a home path or require a repository checkout at
   runtime.
4. For a plugin, add `.claude-plugin/plugin.json`, a README, and a license file; register its unique
   local path in the root marketplace. Existing supported manifest fields follow the
   [Claude reference](https://code.claude.com/docs/en/plugins-reference).
5. Add synthetic fixtures and behavioral tests, update the changelog, and record third-party
   origins. Test the executable helper after copying the plugin to a temporary directory.

The repository validator intentionally supports a narrow skill frontmatter convention. If a new
skill needs additional metadata, extend the validator and its tests together; do not bypass
validation or duplicate skill sources.

## Test requirements

- Cover typical inputs, meaningful edge cases, invalid inputs, and CLI exits.
- Assert independent expectations or relationships. A copied implementation result does not
  establish correctness.
- Use temporary directories for all outputs. Never write fixtures into live caches, an author's
  corpus directory, or a running application's storage.
- No network calls, paid models, or personal data in the default suite.
- When changing profile semantics, version the schema and test incompatible-profile rejection. Do
  not silently reinterpret an old profile.
- Claims about writing quality require a separately documented English evaluation corpus and method;
  passing software tests does not establish calibration.

## Review and release

Use focused commits, explain user-visible changes, and disclose any check that could not run. Update
[THIRD_PARTY.md](THIRD_PARTY.md) for imported or adapted work. Maintainers follow the
[release procedure](docs/releases.md). Do not publish, push, install hooks, or migrate private
skills as an incidental development step.
