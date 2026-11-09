BB Auto Compact watches explicitly selected Codex threads and requests native compaction after an
early idle cutoff, while a large prompt prefix may still be cached.

## Starting policy

The defaults are context above 70% and 15 minutes continuously idle. Fresh model usage resets the
timer. The timer is an estimate-based policy; Codex does not expose an exact cache-expiration
timestamp through this integration.

## Controlled trial

The plugin starts off, with no selected threads and one persistent submission attempt available.
This version supports visible GPT-6.1 Sol threads at Standard speed. Observe mode records candidates
without calling a model. Read-only CLI commands show timers, outcomes and allowance use.

Pending interactions, queued messages, background agents, unavailable hosts, changed execution
settings and stale timers prevent submission. Sleep/restart does not trigger overdue compactions. A
failed or ambiguous submission is not automatically retried by the plugin.

## Requirements and costs

Requires BB SDK 0.6.132 or a compatible 0.6 release and an existing Codex setup. There are no
package dependencies or additional providers. Native compaction consumes Codex usage and follows
Codex's internal retry policy. The attempt allowance is not a credit spending cap. Exact savings and
cache-hit coverage must be checked from native usage records.
