# BB Auto Compact

Eligible Codex conversations across projects can compact while their large conversation prefix is
still cached, instead of waiting until a later cold request. The starting policy is **above 70%
context and 15 minutes idle**. This is an idle policy, not an exact cache-expiration detector.

The plugin is headless and has no package dependencies. It uses BB's existing native compaction
operation; it does not send an authored summarization prompt, alter Codex configuration, install
another provider, or add agent tools/instructions. Its skill file is documentation only and is
excluded from automatic skill injection.

## Scope and activation

New installations start **off**, with selected scope, no selected threads, and one lifetime attempt.
To watch existing and new conversations across projects, set `scope` to `all`. Discovery reads
visible, unarchived Codex threads on startup and once a minute; activity events enroll new threads
immediately. `model=all` covers every configured Codex model, including Sol and Astra, at each
conversation's existing speed and reasoning setting. It never changes a chat to Sol or Standard. An
optional model filter can select Sol or Astra; other providers are outside this plugin's scope.

Modes are `off`, `observe` (record candidates without compaction), and `compact` (native
submission). Settings are available in Installed plugins and `bb plugin config auto-compact`.
Selected scope uses explicit comma-separated `threadIds`; all scope ignores that list.
`maxAttempts=0` enables ongoing operation without a submission-count limit. A positive value caps
the cumulative counter, across all watched threads. Mode off pauses new submissions without
unloading the retry guards.

Installation and ongoing paid operation require the user's applicable approval. See the
[activation guide](docs/trial-scope.md). Global operation does not create timers from old idle
history: each thread needs fresh model usage after activation or reload.

## What the scheduler checks

- Context usage is exact, finite and strictly above the threshold. At exactly 70%, it waits.
- The thread and its runtime are idle, its environment is ready and its host is connected.
- No pending interaction, queued message, background agent, archive or deletion is present.
- A non-maintenance turn has produced fresh model usage since loading/changing settings. Existing
  idle history is not a timer to catch up.
- Fresh usage resets the deadline. Ordinary timeline or title changes do not.
- The model, service tier and reasoning setting still match the values seen when the timer armed.

A 15-second heartbeat checks deadlines. A timer more than one minute late is skipped. A heartbeat
gap over 90 seconds or a backward clock jump discards timers and requires fresh usage. This prevents
sleep/restart catch-up. Manual compaction/context clearing consumes the current content generation.
A new non-maintenance turn and fresh usage are required before rearming.

## Allowance and failures

The plugin persists an attempt reservation **before** calling native compaction. An ambiguous
failure consumes that reservation, and the plugin does not retry it. The allowance is global across
the selected threads and survives disable/reload/restart. A positive `maxAttempts` limits the
cumulative count; zero removes the count limit. It is not a daily counter and does not reset
automatically.

The allowance bounds native **operations**, not provider HTTP requests or billed credits. Native
Codex transport/stream retries remain under Codex's own policy. The plugin submits the structured
native command through attributed `threads.send`, installs an admission guard for only its own
requests, and declines BB Provider Retry's consent request. This prevents later BB turn retries from
replaying the old idle opportunity. A submission unexpectedly queued by a race is cancelled by its
own queue-row ID. Requests from other senders are unaffected.

The plugin's several SDK reads are not an atomic transaction with a user sending a message or a
machine disconnecting. Its dispatch guard rechecks current admission state and refuses joining a
live turn or replaying a deferred operation. An acknowledged submission is not proof of completed
compaction or of a particular charge.

Decision history contains timestamps, thread IDs, usage measurements and outcomes; it stores no
prompts. BB/Codex retain the native compaction events and token accounting for post-trial
cache/billing inspection. This version does not claim a complete billing meter or automatic proof of
net savings.

## Commands

`bb auto-compact status --json` reads scope, discovery health, watched count, and up to 100 thread
rows with project, title, model, speed, context usage, timer, and waiting reason. Use
`bb auto-compact status --thread THREAD_ID --json` to inspect one conversation. The persisted
counter records submission attempts, not successful completions.

`bb auto-compact history --json` reads the last 50 decisions. `attempt-reserved` means the allowance
was consumed; `submitted` means BB accepted the operation; `context-boundary` records an observed
native compaction/clear boundary. `failed-or-unknown` is not retried. These commands cannot trigger
compaction.

`bb auto-compact usage --json` reads native cached-input/output samples associated with recent
compaction turns on selected threads. Its read is bounded to 100 relevant events per thread. In all
scope it defaults to the ten most recent threads with a recorded compaction boundary; use
`--thread THREAD_ID` to inspect another watched conversation. All three commands accept the thread
filter. These are turn-scoped samples, which may include multiple model requests, and are not a
complete credit/billing reconciliation.

Use `bb plugin config auto-compact set mode off` to stop new submissions while keeping the retry
guards loaded. An operation already admitted by Codex may still finish. Keep the plugin loaded until
that operation's outcome is known; disabling/removing it unloads the retry-consent and dispatch
guards, so BB's fallback retry policy can apply afterward.

## Build and verify

Run `node --test test/*.test.js` and `bb plugin build .` using the tools already installed. No
package install is needed. Tests use async fake SDK/KV responses and injected time, and make no
model calls. The build writes ignored `dist/` artifacts.

For installation after approval, run `bb plugin install path:. --yes` from this directory. A local
path install registers this source in place and builds it with BB's installed compiler. Verify the
plugin reports running while its mode is still off before configuring paid operation.

The public API contract verified against BB 0.49.0 / SDK 0.6.132 is captured in
[sdk-contract.md](docs/sdk-contract.md). The experiment's limitations and acceptance checks are in
[verification.md](docs/verification.md).
