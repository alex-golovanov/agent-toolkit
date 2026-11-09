# Verification and practical limits

The plugin supports selected and global scope with an early idle policy, not an exact expiry
guarantee.

## Checked locally

- Node's existing test runner verifies pure policy, async coordinator behavior, settings/factory
  registration and heartbeat cancellation with fake SDK/KV calls.
- Threshold checks require strictly above 70%; the idle deadline is 15 minutes.
- Race checks cancel when activity arrives during a read or durable reservation.
- Shared allowance, reload persistence, retry-consent refusal, deferred admission rejection,
  cancellation of only the plugin's queue row, pending work, invalid settings and corrupt state are
  covered.
- Sleep/clock changes and stale usage discard old timers rather than catching up.
- BB's installed compiler builds the real backend bundle and stamps SDK/identity metadata.
- No package install, model call or plugin installation is part of these checks.

## Native outcome validation

The toolkit local-path installation was verified on 2026-11-09: the background service and CLI
loaded, off defaults were checked, and the approved selected-thread trial was configured. No
compaction has been submitted. A natural, scoped trigger must still verify native admission and
cache usage. Do not substitute a shortened or forced compaction without changing the approved scope.

The native operation can encounter queue/admission races after the initial SDK checks. The plugin's
own admission hook and sender retry-consent handler prevent joining active turns or escaping into
later BB automatic retries. It cancels a returned queue row by its own ID. Codex can still retry
internally. There is no operation-specific credit cap or native transport-retry override on this
public SDK action. Submitted is therefore an acknowledgement, not a completion or billing verdict.
Exact expiry and total net savings remain unproven.

Historical compaction samples used to motivate this policy came from Codex Desktop, not a live BB
plugin trial. Personal audit records are not distributed with this plugin.

## Global operation extension

Global discovery and ongoing accounting are covered by fake-SDK tests: paginated cross-project
listing, filtering of hidden/archived/other-provider threads, new conversations, settings changes
during discovery, disposal, repeated content generations, and persistent counters across reloads.
The public thread list returns a bare array and accepts limit/offset without a project selector.
Status includes project/title/context fields and bounded per-thread output. Natural native
compaction and cache reuse remain unverified until an eligible conversation reaches its cutoff.

The global scope is enabled in the live local-path installation. A read-only check confirmed
`maxAttempts=0`, so the initial one-attempt cap is no longer active. The agent's earlier setting
change was rejected, and no indirect workaround was executed.

## All Codex models and speeds

Version 0.3.0 removes the Sol/Standard restriction. The all-model filter accepts a configured Codex
model and preserves its resolved speed and reasoning setting; malformed execution shapes fail
closed. Fake tests cover Sol, Astra, another configured model, Standard/Fast/Flex/default tiers, and
concurrent submissions with distinct execution settings. A model or speed change during an armed
timer still invalidates that decision. No forced paid test is part of this verification.
