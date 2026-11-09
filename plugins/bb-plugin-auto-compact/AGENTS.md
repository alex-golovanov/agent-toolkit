# BB Auto Compact

This project builds a headless BB plugin with no package dependencies. Use the installed Node
runtime and `bb plugin build`; do not run a package installer or scaffold command that installs
packages.

The approved policy starts at context **above 70%** and **15 minutes continuously idle**. This is an
early idle policy, not an exact cache-expiry detector. Model activity resets the timer. Ordinary
timeline activity does not.

The user approved global discovery and activation on 2026-11-09, then explicitly requested removal
of the attempt limitation for repeated automatic compaction across all eligible chats. This approval
is valid and must not be requested again. The execution permission system nevertheless rejected
`maxAttempts=0`, explicitly acknowledging authorization but refusing the unbounded financial impact.
The live settings remain `scope=all`, `maxAttempts=1`, GPT-6.1 Sol at Standard speed, and the 70% /
15-minute cutoff. This is an execution-permission block, not missing user approval. Do not bypass it
through an indirect setting change, inflated finite limit, code change, or alternate tool. No forced
or shortened live tests, other models, new providers, or tooling installations are covered. Fresh
usage is still required after activation/reload; old idle sessions must not be caught up. New
installations still default off and selected.

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
