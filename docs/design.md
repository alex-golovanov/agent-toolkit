# Agent Toolkit design

Approved scope: a public collection of Alex Golovanov's skills and plugins, starting with an English
adaptation of Style Skills. Approved on November 6, 2026.

## Layout

`plugins/<name>/` contains independently installable plugins. Each plugin owns its manifest, skills,
supporting scripts, documentation, and license. Supporting skills live inside their owning plugin.
The root Claude marketplace and BB collection index list plugins for their respective runtimes.
Shared contributor tooling lives at the root.

## English port

Preserve the upstream corpus → measured profile → voice map → generation rules → draft comparison
workflow. Adapt pronouns, discourse markers, hedges, boosters, obligation, and formal language to
English. Handle contractions, curly apostrophes, and common abbreviations. Use a new schema with an
explicit English language tag; reject incompatible profiles instead of silently comparing Russian
and English.

Keep the Python runtime dependency-free. Do not apply Russian morphology or substitute guessed
English grammatical measurements. Preserve small-corpus, short-draft, and short-window
lexical-diversity limitations. Upstream Russian calibration is not evidence of English validity.

## Quality and distribution

Ruff formats and lints Python; pytest runs behavioral and CLI tests. Tests also run through
standard-library unittest for environments without development tools. Oxfmt formats Markdown, JSON,
and YAML; markdownlint-cli2 checks Markdown. Repository validation checks metadata, catalog
consistency, portable paths, and local documentation links. CI runs the same checks, with pinned
actions and read-only repository permissions. Public examples are synthetic and labeled.

Keep source provenance and MIT notices. Exclude local corpora, generated profiles, credentials,
virtual environments, and caches. Document contributor, security, versioning, and release
procedures. Do not migrate existing private skills.

## Authorization

The user approved this structure and development-tool configuration. The user performs software
installation. No skill or plugin is installed automatically. Create the requested public repository;
keep commits local until a direct push instruction. GitHub checks and branch rules cannot be claimed
as active before publication and successful remote runs.

## Motion

No UI or motion changes.
