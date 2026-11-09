# BB Auto Compact

This project builds a headless BB plugin with no package dependencies. Use the installed Node
runtime and `bb plugin build`; do not run a package installer or scaffold command that installs
packages.

The approved policy starts at context **above 70%** and **15 minutes continuously idle**. This is an
early idle policy, not an exact cache-expiry detector. Model activity resets the timer. Ordinary
timeline activity does not.

Global ongoing operation uses `scope=all`, `model=all`, and `maxAttempts=0` after the user's
applicable approval. Preserve each conversation's current model, speed, and reasoning setting. Do
not add undisclosed model/speed restrictions or restore a trial limit in an ongoing installation.
Fresh usage is required after activation/reload; old idle sessions are not caught up. Hidden or
archived chats, active or pending work, offline hosts, and unknown context/execution shapes remain
ineligible. New installs default off and selected with one attempt and the all-model filter. Explain
effective defaults and remaining limits clearly.

Keep live-verification claims tied to native evidence. Fake-SDK tests do not establish successful
live execution on every model or tier. Publish only sanitized aggregate verification metadata; never
include personal conversation text, IDs, titles, credentials, or machine-specific paths.

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
