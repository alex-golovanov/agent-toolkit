# Changelog

Changes are grouped by release. Plugin versions are independent of upstream versions; metrics
schemas change when measurement compatibility changes.

## Unreleased

### Added

- BB Auto Compact 0.1.0 in `plugins/bb-plugin-auto-compact/`, with a BB collection index,
  dependency-free native Node tests, and scoped 70% / 15-minute idle scheduling.

- Public collection layout for plugins and standalone skills, with a Claude marketplace.
- English Style Skills 0.1.0: `style-portrait` and `writing-in-style`.
- English schema-2 analyzer, synthetic regression tests, and relocated-plugin checks.
- Formatting, linting, metadata validation, CI, and contributor/release procedures.
- Upstream MIT notice and exact revision provenance.
- A portable HTML workflow guide with interactive examples and reusable Markdown requests.

### Fixed

- Corrected Markdown lint issues in the pull request template and corpus-boundary documentation.
- Markdown line wrapping no longer creates false sentence boundaries. Explicit list items, headings,
  and blank paragraphs retain boundaries. Rebuild older profiles made from wrapped source prose.

### Changed

- Reworked the READMEs around the human writing workflow, with reusable requests and measurement
  limits.

- Replaced Prettier with Oxfmt for documentation and configuration formatting; Ruff continues to
  format and lint Python.

### Compatibility

- Russian/schema-1 profiles must be rebuilt from English source texts.
- Runtime requires Python 3.11+ and no third-party Python dependencies.
- English grammar analysis and empirical voice-quality calibration are unavailable.
