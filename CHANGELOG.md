# Changelog

Changes are grouped by release. Plugin versions are independent of upstream versions; metrics
schemas change when measurement compatibility changes.

## Unreleased

### Added

- Public collection layout for plugins and standalone skills, with a Claude marketplace.
- English Style Skills 0.1.0: `style-portrait` and `writing-in-style`.
- English schema-2 analyzer, synthetic regression tests, and relocated-plugin checks.
- Formatting, linting, metadata validation, CI, and contributor/release procedures.
- Upstream MIT notice and exact revision provenance.

### Changed

- Replaced Prettier with Oxfmt for documentation and configuration formatting; Ruff continues to
  format and lint Python.

### Compatibility

- Russian/schema-1 profiles must be rebuilt from English source texts.
- Runtime requires Python 3.11+ and no third-party Python dependencies.
- English grammar analysis and empirical voice-quality calibration are unavailable.
