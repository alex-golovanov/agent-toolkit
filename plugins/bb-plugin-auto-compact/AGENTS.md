# BB Auto Compact

This project builds a headless BB plugin with no package dependencies. Use the installed Node
runtime and `bb plugin build`; do not run a package installer or scaffold command that installs
packages.

The approved policy starts at context **above 70%** and **15 minutes continuously idle**. This is an
early idle policy, not an exact cache-expiry detector. Model activity resets the timer. Ordinary
timeline activity does not.

The user explicitly approved global, repeated automatic compaction and subsequently requested all
Codex models, including Sol and Astra. Use `scope=all` and `model=all` for that live scope,
preserving each conversation's current model, speed, and reasoning setting. Do not impose new model
or speed restrictions without discussing them. The owner has removed the attempt cap: a read-only
check confirmed live `maxAttempts=0`; do not restore the initial one-attempt limit. The agent's
earlier attempt to remove it was blocked by execution permissions and was not bypassed by code or
another tool. The threshold and idle cutoff remain 70% / 15 minutes. No forced or shortened paid
tests, new providers, or tooling installation are authorized. Fresh usage is required after
activation/reload; old idle sessions are not caught up. Hidden/archived chats, active or pending
work, offline hosts, and unknown context/execution shapes remain ineligible. New installs default
off and selected, with the all-model filter; explain the effective scope and any remaining limits
clearly.

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
