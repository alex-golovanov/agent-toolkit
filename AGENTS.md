# Agent Toolkit

This is a public collection of skills and plugins. Use American English in code, documentation,
prompts, and public output. Preserve third-party copyright notices.

- Read the relevant plugin's README and skill instructions before changing it.
- Keep plugin resources inside their plugin directory; support relocated copies.
- Do not migrate personal skills, corpora, profiles, credentials, or local paths into this
  repository without explicit user authorization.
- Do not install tools, dependencies, or skills on the owner's computer. The owner installs them.
  Dependency changes require explicit approval. The approved development tools are Ruff, pytest,
  Prettier, and markdownlint-cli2.
- Do not register plugins or enable hooks as part of ordinary development.
- Write regression tests for changed behavior. Use temporary directories for outputs; tests must not
  mutate live runtime data.
- Run `make format` and `make check` before completing code changes. If tooling is missing, run
  `make test-stdlib` and `make validate`, and report the missing checks explicitly. Never claim the
  complete gate passed when it did not.
- Commit completed logical changes. Never bypass `.gitignore`, and do not push without a direct user
  instruction. Report which commits remain local.
- Do not call paid models or services for tests without explicit authorization.
- Save prompt artifacts as Markdown. Do not generate archives unless requested.

The repository validator enforces this collection's deliberately narrow metadata conventions. It is
not a complete implementation of every agent's plugin schema.
