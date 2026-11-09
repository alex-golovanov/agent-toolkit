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

## Global scope extension

The user approved global, ongoing operation after reviewing the selected-thread trial limitations.
Add `scope=all` alongside selected scope. Discover visible, unarchived Codex threads across projects
through the public paginated thread list (100 rows per page, bounded to 100 pages), at startup and
once a minute. Activity events can enroll new threads immediately. Unknown list shapes are reported
as discovery errors; per-thread eligibility remains mandatory. Cancel discovery work on disposal or
settings changes and invalidate state removed from global scope. Do not arm from historical usage.

Keep safe installation defaults. A zero maximum attempt setting removes only the submission-count
limit; cumulative attempt accounting and consumed-content checkpoints remain persistent. Positive
limits retain the trial behavior. No retries, sleep catch-up, model expansion, or forced live tests.

Expose discovery health, count, and bounded per-thread title/project/context rows through status.
Add a validated `--thread` filter to status, history, and usage. Test pagination, filtering, scope
changes during discovery, new-thread enrollment, ongoing generations, and reload accounting with
fake SDK calls. Build and reload while off, configure the approved scope, and verify live read-only
status after activation. Native completion and cache reuse still require a natural trigger.

## All Codex models and speeds

The approved global scope now includes all configured Codex models, including Sol and Astra, at each
conversation's current speed. `model=all` is the default model filter, with optional explicit
Sol/Astra filters. Validate resolved execution shape, capture model/tier/reasoning when arming, and
pass those unchanged to native compaction. Continue cancelling on execution changes. Status must
name each conversation's model and speed so an unexpected exclusion is visible.
