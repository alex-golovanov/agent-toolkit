# Changelog

Changes are grouped by release. Plugin versions are independent of upstream versions; metrics
schemas change when measurement compatibility changes.

## Unreleased

### Added

- BB Auto Compact 0.3.0: all Codex models and speeds, including Sol and Astra, preserving each
  conversation's execution settings. Status now exposes model and speed.

- BB Auto Compact 0.2.0: global conversation discovery, ongoing operation, and per-thread status,
  history, and usage filters. New installations retain conservative off/selected defaults.

- BB Auto Compact 0.1.0 in `plugins/bb-plugin-auto-compact/`, with a BB collection index,
  dependency-free native Node tests, and scoped 70% / 15-minute idle scheduling.

- Public collection layout for plugins and standalone skills, with a Claude marketplace.
- English Style Skills 0.1.0: `style-portrait` and `writing-in-style`.
- English schema-2 analyzer, synthetic regression tests, and relocated-plugin checks.
- Formatting, linting, metadata validation, CI, and contributor/release procedures.
- Upstream MIT notice and exact revision provenance.
- A portable HTML workflow guide with interactive examples and reusable Markdown requests.

### Fixed

- BB Auto Compact reads the SDK thread directly and explicitly includes its environment; the live
  installation check now agrees with the fake SDK regression fixture.

- Corrected Markdown lint issues in the pull request template and corpus-boundary documentation.
- Markdown line wrapping no longer creates false sentence boundaries. Explicit list items, headings,
  and blank paragraphs retain boundaries. Rebuild older profiles made from wrapped source prose.

### Changed

- Expanded BB Auto Compact documentation into a complete setup and operations guide, with explicit
  installation defaults, model verification levels, status interpretation, and troubleshooting.
- Added a BB quick start to the collection index and documented branch-tracking distribution.

- Reworked the READMEs around the human writing workflow, with reusable requests and measurement
  limits.

- Replaced Prettier with Oxfmt for documentation and configuration formatting; Ruff continues to
  format and lint Python.

### Compatibility

- Russian/schema-1 profiles must be rebuilt from English source texts.
- Runtime requires Python 3.11+ and no third-party Python dependencies.
- English grammar analysis and empirical voice-quality calibration are unavailable.
