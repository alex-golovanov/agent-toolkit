# Third-party provenance

## Style Skills

- Author: Vyacheslav Startsev.
- Source: [claude-plugins](https://github.com/vyacheslav-startsev/claude-plugins).
- Revision:
  [`5de61ae6109a1fdaa4e412364984b6525e0bd8a7`](https://github.com/vyacheslav-startsev/claude-plugins/commit/5de61ae6109a1fdaa4e412364984b6525e0bd8a7).
- Upstream plugin version: 1.2.0.
- Source paths: `plugins/style-skills/`, root `LICENSE`, and `tests/` reviewed for behavior.
- License: MIT; the original notice is preserved in
  [plugins/style-skills/LICENSE](plugins/style-skills/LICENSE).

The English adaptation preserves the corpus/profile/check workflow, three-layer profile method,
normalized metrics, per-text order-statistic bands, short-text warnings, and sparse-feature
comparison approach. The helper code and skill instructions are adapted from the upstream files.

Changes include English marker groups and contraction handling; English output, instructions, and
documentation; removal of Russian morphology and the Latin-word borrowing metric; explicit schema-2
English metadata; profile validation; rejection of multi-chat exports; no n-grams across post
boundaries; first-line formatting counts; portable resource resolution; and a new synthetic
regression suite that can run under unittest or pytest.

Upstream calibration relies on a private Russian corpus. No such corpus is included, no upstream
calibration result is presented as an English result, and no accuracy guarantee is implied.
Bibliographic references and the credited prompt influence are retained in the
[profile reference](plugins/style-skills/skills/style-portrait/layers.md).

## Development tools

Ruff, pytest, Prettier, and markdownlint-cli2 are development dependencies; their code is not
vendored or included in installable plugin folders. Each is governed by its own upstream license.
The analyzer itself uses Python's standard library.
