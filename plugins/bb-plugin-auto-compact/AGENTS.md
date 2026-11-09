# BB Auto Compact

This project builds a headless BB plugin with no package dependencies. Use the installed Node
runtime and `bb plugin build`; do not run a package installer or scaffold command that installs
packages.

The approved policy starts at context **above 70%** and **15 minutes continuously idle**. This is an
early idle policy, not an exact cache-expiry detector. Model activity resets the timer. Ordinary
timeline activity does not.

Keep the first trial explicitly scoped to selected thread IDs, GPT-6.1 Sol at Standard speed, and a
persistent attempt allowance. Installation and billable execution need the user's exact approval
under the standing global instructions. Building, unit tests, and read-only SDK checks do not
authorize either installation or execution.

Never run compaction as a test without approved paid-call scope. Keep all automated tests on fake
SDK calls and injected clocks. Native Codex may retry a single operation internally; the plugin
itself never retries a compaction submission.

Use only public BB plugin APIs. Consult the installed API implementation and bundled plugin
references when declaration files are unavailable. Do not import private `@bb/*` packages. Avoid
injecting skills, agent instructions or tools, which would change conversation prefixes.

Before editing, inspect Git status and diffs. Stage only this task's changes, commit logical steps
locally, and do not push without instruction. Never force ignored files into Git.

Validation: `node --test` and `bb plugin build .`. Test asynchronous cancellation, reloads, sleep,
unknown API shapes and persistent attempt accounting. Treat ambiguous state as ineligible.
