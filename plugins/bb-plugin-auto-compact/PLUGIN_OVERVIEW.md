BB Auto Compact watches eligible Codex conversations across projects and requests native compaction
after an early idle cutoff, while a large prompt prefix may still be cached.

## Starting policy

The defaults are context above 70% and 15 minutes continuously idle. Fresh model usage resets the
timer. Codex does not expose an exact cache-expiration timestamp through this integration.

## Scope and controls

Choose selected thread IDs or all eligible conversations, including new ones. All configured Codex
models are supported, including Sol and Astra; each conversation keeps its existing model, speed,
and reasoning setting. Only visible, unarchived conversations qualify. It starts off, with selected
scope and one persistent attempt. After approval, ongoing operation uses a zero count limit. Observe
mode records candidates without calling a model. Read-only CLI commands show discovery health,
per-thread context, timers, outcomes, and cumulative attempts.

Pending interactions, queued messages, background agents, unavailable hosts, changed execution
settings, and stale timers prevent submission. Fresh usage is required after activation or reload;
sleep and restart do not trigger overdue compactions. Failed or ambiguous submissions are not
retried.

## Requirements and costs

Requires BB SDK 0.6.132 or a compatible 0.6 release and an existing Codex setup. There are no
package dependencies or additional providers. Native compaction consumes Codex usage and follows
Codex's internal retry policy. Ongoing mode has no submission-count or credit spending cap. Exact
savings and cache-hit coverage must be checked from native usage records.
