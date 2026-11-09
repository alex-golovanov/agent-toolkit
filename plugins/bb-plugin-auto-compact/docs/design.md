# Preventive Codex compaction

The user approved a starting policy of context above 70% and 15 minutes idle. Existing Codex records
demonstrate that compaction can reuse cached input, but expose no exact prompt-cache expiration
timestamp. The feature must describe its timer as an idle cutoff.

## Scope

Build a dependency-free, headless BB plugin. Default to off. Support observe and compact modes,
explicit thread IDs, GPT-6.1 Sol at Standard speed, and a persistent maximum number of submission
attempts (one by default). Do not install or initiate a model call before the final, scoped
approval. There are no agent instructions, native tools, frontend assets, new providers or external
services.

## Behavior

Watch BB lifecycle and coalesced event notifications. Read only the relevant event types through the
public SDK. Track fresh model usage and non-compaction turns; manual/automatic compaction and
context clearing consume the current content generation. Start the timer when a qualifying thread
becomes idle, and reset it on fresh model usage. Never reconstruct an overdue timer from historical
events after loading.

Before submission, reread thread/runtime status, context usage, pending interactions, queued
messages and effective execution options. Require a visible, unarchived Codex thread, ready local
environment, no background agents, an exact context measurement, matching approved model/tier and a
fresh timer. A read failure or unknown response shape prevents submission.

Cancel on active work, queued input, interactions, settings changes, archive/delete, clock reversal,
suspend gaps or disposal. An overdue timer is skipped rather than caught up. Serialize work per
thread and globally serialize the persisted attempt reservation. Consume the attempt before calling
the native compaction action, even if its outcome is ambiguous. Do not retry failed or ambiguous
compaction operations. Prevent compaction-loop rearming until a new non-compaction turn has produced
fresh usage.

Submit the public structured native command through the plugin-bound send API, which preserves
sender attribution. A dispatch hook rejects only this plugin's requests without a live idle/deadline
permit. A Provider Retry consent RPC always declines retrying this plugin's failed turns. Cancel an
unexpectedly queued submission by its own returned queue ID. The unattributed compact convenience
method is unsuitable for this bounded trial because it bypasses these controls. Native Codex
transport retries remain unchanged; the plugin does not claim an atomic transaction across every SDK
read or control over those internal retries.

## Persistence and visibility

Persist the attempt counter, consumed content sequence per thread and a bounded history of decisions
without prompts. Provide read-only CLI status/history. Default installation alone is inert. Removing
a thread from the scope cancels its watcher. Reload preserves spending allowance and consumed
generations, and skips old idle timers.

## Verification

Use Node's existing test runner with fake BB SDK responses, persisted KV and an injected clock.
Verify threshold boundaries, fresh-usage rearming, command detection, pending work, asynchronous
races, sleep, clock reversal, reloads, failed reservation, global allowance and no retries. Build
with BB's existing compiler. A live read-only SDK probe can check the API contract without
installing a plugin. A paid live trial is a separate final activation step.
