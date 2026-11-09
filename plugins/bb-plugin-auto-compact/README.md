# BB Auto Compact

[![Quality](https://github.com/alex-golovanov/agent-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/alex-golovanov/agent-toolkit/actions/workflows/ci.yml)

**Automatic native compaction for Codex conversations in [BB](https://getbb.app).**

Keep working across projects without remembering which conversations need compaction. BB Auto
Compact watches context usage and requests native Codex compaction after an early idle cutoff, while
the large conversation prefix may still be cached.

| Policy                                  | Coverage                                     | Model behavior                                | Runtime dependencies |
| --------------------------------------- | -------------------------------------------- | --------------------------------------------- | -------------------- |
| **Above 70% context · 15 minutes idle** | Existing and new Codex chats across projects | Keeps each chat's model, speed, and reasoning | **None**             |

Experimental · Version 0.3.0 · [MIT license](LICENSE)

[Quick start](#quick-start) · [Models and verification](#models-and-verification) ·
[All settings](#all-settings) · [Check that it works](#check-that-it-works) ·
[Troubleshooting](#troubleshooting) · [Updates and removal](#updates-and-removal)

> **An early idle policy, not an expiry detector.** This integration does not expose Codex's exact
> prompt-cache expiration time. Compaction consumes ordinary Codex usage; a cache hit and net
> savings are not guaranteed.

## Quick start

### 1. Check the prerequisites

- BB with a compatible Plugin SDK: `>=0.6.132 <0.7.0`. The reference environment is BB **0.49.0**.
- An existing, working Codex provider in BB. Use the model and account you already use for chats.
- For the Git installation below, Git and network access. BB handles its normal checkout/build
  pipeline; you do not need to run a package manager in this plugin.

This is a **BB plugin**. It does not install into Codex Desktop or Claude Code. The collection's
[Style Skills](../style-skills/README.md) package is a separate plugin for a different workflow.

### 2. Install from this public repository

Run in your terminal and review BB's source confirmation:

```sh
bb plugin install git:https://github.com/alex-golovanov/agent-toolkit.git@main --plugin bb-plugin-auto-compact
```

The repository contains several packages, so **keep the `--plugin` selector**. For reference:

| Name                               | Where it is used                                      |
| ---------------------------------- | ----------------------------------------------------- |
| `bb-plugin-auto-compact`           | Package directory and collection selector             |
| `auto-compact`                     | Installed plugin ID, settings, logs, and CLI commands |
| **BB Auto Compact [Experimental]** | Display name in BB                                    |

The plugin is dependency-free; BB may prepare its own build toolchain as part of a first install.
There is no npm publication or marketplace registration required to install this Git source.

### 3. Enable global, ongoing operation

**Installation alone does not activate compaction.** A fresh installation starts off, with selected
scope, an empty thread list, and a one-attempt allowance. To watch all Codex conversations and keep
running, configure the following:

```sh
bb plugin config auto-compact set scope all
bb plugin config auto-compact set model all
bb plugin config auto-compact set contextPercent 70
bb plugin config auto-compact set idleMinutes 15
bb plugin config auto-compact set maxAttempts 0
bb plugin config auto-compact set mode compact
```

**`maxAttempts=0` means ongoing operation with no submission-count or total credit cap.** A positive
value limits cumulative submission attempts across all watched threads, including failed or
uncertain submissions. It is not a daily limit.

You can make the same changes in BB's **Installed plugins → BB Auto Compact** settings:

| Setting                          | Global ongoing value |
| -------------------------------- | -------------------- |
| Mode                             | `compact`            |
| Conversation scope               | `all`                |
| Model filter                     | `all`                |
| Compact above context percentage | `70`                 |
| Idle cutoff in minutes           | `15`                 |
| Lifetime submission allowance    | `0`                  |

The selected thread list is ignored in all scope. **Sol, Astra, and other configured Codex models
are included.** Each conversation retains its current speed and reasoning setting; the plugin does
not switch it to another model or to Standard speed.

### 4. Confirm the effective configuration

```sh
bb auto-compact status --json
```

Look for `mode: "compact"`, `scope: "all"`, `model: "all"`, and `maxAttempts: 0`. `discovery.error`
should be null. `watchedCount` counts discovered Codex conversations, including ones currently
waiting on another condition; it is not a count of armed timers or completed actions.

Then continue using your chats normally. **Each chat needs fresh model activity after activation, a
settings change, or a reload.** Opening an old, already-idle conversation does not immediately
compact it. Once measured context is strictly above the threshold and the chat settles idle, its
status can show an armed `dueAt` deadline.

## Models and verification

**Supported** means the plugin accepts a model already configured in the existing Codex provider. It
does not add providers, model access, credentials, or subscriptions. **Tested** below identifies the
actual evidence, rather than treating support as proof of a successful live run.

| Model / execution setting                               | Supported                    | Automated tests                                                              | Live evidence as of 2026-11-09                 |
| ------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| **GPT-6.1 Sol · Standard**                              | Yes                          | Policy, eligibility, and fake native submission                              | Three completed automatic native compactions   |
| **GPT-6 Astra · Fast**                                  | Yes                          | Concurrent fake submission verifies model, tier, and reasoning are preserved | No separately verified Astra run recorded      |
| **Sol and Astra · Standard / Fast / Flex / unset tier** | Yes, when available in Codex | Eligibility tested across these values                                       | No live claim for every model/tier combination |
| Other configured Codex models                           | Yes, with `model=all`        | A synthetic model ID verifies no Sol/Astra allowlist is imposed              | Not individually live-tested                   |
| Claude Code, Pi, and other providers                    | No                           | Excluded from Codex discovery/eligibility                                    | Outside this plugin's scope                    |

The live completion observations match attributed plugin requests to completed native
`contextCompaction` items and completed turns. This is an observational check, not a controlled
benchmark. **Native completion does not establish cache reuse or billed savings.** The inspected
compaction samples did not expose a useful input/cache breakdown. See the
[verification snapshot](docs/live-verification.json) and [practical limits](docs/verification.md).
No additional billable tests were submitted to write this documentation.

The reference development environment uses **macOS, BB 0.49.0, SDK 0.6.132, and Node 25.9.0**. The
package declares Node **22+** and the SDK range above. A declared range is not a claim that every BB
release, operating system, or Codex model has been tested. The automated suite has **41 plugin
tests**, also run from a relocated temporary copy by the repository test suite.

## How the idle policy works

1. **Discover conversations.** Global mode lists visible, unarchived Codex threads across projects
   at startup and once a minute. Activity events can enroll new conversations immediately.
2. **Observe fresh usage.** A non-maintenance conversation turn and a later model-usage event
   establish new content. Existing idle history does not authorize a catch-up action.
3. **Check context and idle state.** Context must be an exact measurement strictly above the
   configured percentage. At exactly 70%, the default policy waits. The chat and runtime must be
   idle.
4. **Arm a deadline.** Fresh model usage resets the idle timing. Ordinary title or timeline changes
   do not. Status exposes the deadline as `dueAt` in Unix milliseconds.
5. **Recheck and submit.** At the cutoff, the plugin rereads current conditions, persists an attempt
   reservation, and sends the structured native `/compact` command with the captured execution
   settings.
6. **Wait for new content.** The same content generation cannot repeatedly trigger compaction. A new
   conversation turn and fresh usage are required to qualify again.

The scheduler checks every **15 seconds**. A deadline more than **one minute late** is skipped. A
heartbeat gap over **90 seconds**, backward clock movement, or disposal discards timers. Sleeping or
restarting the machine does not cause a burst of overdue compactions.

### Conditions that prevent submission

- Hidden, archived, or deleted conversations; other agent providers.
- Active runtime work, background agents, pending interactions, or queued input.
- An unavailable environment, disconnected host, or inactive host lifecycle.
- Missing, estimated, nonfinite, or inconsistent context usage.
- Missing or malformed resolved model/execution settings.
- A model, speed, or reasoning change after the timer armed.
- An exhausted positive attempt allowance, or content already consumed by an earlier attempt.
- Stale usage, an overdue timer, or a read/persistence error.

Global mode does not mean busy conversations are interrupted. An invalid or unknown state prevents
submission. The discovery scan is bounded to **100 pages of 100 rows** and reports an error if that
bound is reached; it does not silently claim complete enumeration beyond it.

## All settings

Use `bb plugin config auto-compact --json` to read the schema and effective values, or edit them in
the Installed plugins page. These are **fresh-install defaults**, not the recommended global values:

| Key              | Default    | Allowed values and meaning                                                                                      |
| ---------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| `mode`           | `off`      | `off`: no new submissions; `observe`: record candidates without compaction; `compact`: submit native compaction |
| `scope`          | `selected` | `selected`: explicit thread IDs; `all`: existing and new visible Codex chats across projects                    |
| `threadIds`      | Empty      | Up to 50 explicit `thr_…` IDs, comma- or whitespace-separated; ignored in all scope; no wildcard syntax         |
| `model`          | `all`      | `all`, `gpt-6.1-sol`, or `gpt-6-astra`; a filter, not a model override                                          |
| `contextPercent` | `70`       | Integer 1–99; measured context must be strictly above it                                                        |
| `idleMinutes`    | `15`       | Integer 1–240; the early idle cutoff                                                                            |
| `maxAttempts`    | `1`        | Integer 0–1,000,000; zero is ongoing; positive values cap the persistent global count                           |

Changing settings invalidates existing timers and requires fresh usage. Reloading preserves attempt
accounting and consumed-content checkpoints, but does not restore old idle deadlines. Raising a
positive allowance does not reset the cumulative counter.

### Watch selected conversations instead

Pause before changing scope, replace the illustrative IDs with actual BB thread IDs, then resume:

```sh
bb plugin config auto-compact set mode off
bb plugin config auto-compact set scope selected
bb plugin config auto-compact set threadIds 'thr_example1,thr_example2'
bb plugin config auto-compact set model all
bb plugin config auto-compact set maxAttempts 1
bb plugin config auto-compact set mode compact
```

That allowance is one cumulative attempt **shared by both threads**, not one attempt per thread. If
the persistent counter is already at least one, this example cannot submit until an applicable
larger allowance is configured. Choose `0` only when ongoing paid operation is intended.

### Observe without submitting compaction

```sh
bb plugin config auto-compact set mode observe
```

The same eligibility and cutoff apply. A qualifying candidate produces `would-compact` history; it
does not submit compaction or consume the paid-attempt counter. Ordinary activity in the chats still
uses their existing model as usual.

## Check that it works

All three inspection commands are read-only. Use them from a terminal while waiting; asking an agent
inside the watched conversation for an update creates activity and resets the idle timing.

```sh
bb auto-compact status --json
bb auto-compact history --json
bb auto-compact usage --json
```

Add `--thread` to inspect one conversation:

```sh
bb auto-compact status --thread thr_example1 --json
bb auto-compact history --thread thr_example1 --json
bb auto-compact usage --thread thr_example1 --json
```

| Command   | What to look for                                                                                                     | Output bounds                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `status`  | Effective configuration, discovery health, thread title/project/model/speed, measured context, `reason`, and `dueAt` | Up to 100 thread rows; `truncated` flags more; `--thread` selects one                                               |
| `history` | Attempt reservations, accepted submissions, observed context boundaries, skipped/failed/deferred outcomes            | Latest 50 decisions, then optional thread filter                                                                    |
| `usage`   | Native compaction boundaries and token samples in the same BB turn                                                   | Latest 100 relevant events per inspected thread; global default covers up to ten recently recorded boundary threads |

The lifetime counter means **attempts reserved**, not successful compactions. It is saved before the
native call and can increase even when admission later fails or the outcome is uncertain.

### Read the decision history

| Entry                           | Meaning                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `would-compact`                 | Observe mode reached an eligible cutoff; no native submission                                          |
| `attempt-reserved`              | A persistent attempt was consumed before calling BB                                                    |
| `submitted`                     | BB acknowledged native command admission; completion is not established by this row alone              |
| `context-boundary`              | The watcher observed a native compaction or context-clear boundary; inspect `type` to distinguish them |
| `skipped`                       | The final recheck rejected the opportunity; inspect `reason`                                           |
| `failed-or-unknown`             | Native rejection or ambiguous outcome; no automatic retry for that content generation                  |
| `deferred-submission-cancelled` | A race queued the plugin's message; the plugin removed that specific queue row                         |
| `deferred-submission-blocked`   | A queued response lacked its ID; the dispatch permit was revoked to prevent replay                     |

An empty `usage` result does **not** prove no submission or completion happened. The verified Codex
path emitted an `item/completed` event with item type `contextCompaction`, rather than a
`thread/compacted` boundary. The current helper relies on boundary events, so it may miss that
successful native result. Its reads are also bounded. Inspect the chat's native compaction timeline
entry and completed turn; compare those with the plugin's submission time. Logs are also available:

```sh
bb plugin logs auto-compact --lines 50
```

Usage samples can contain multiple model requests from one turn. They are not an account billing
reconciliation or an automatic calculation of total savings.

## Troubleshooting

| What you see                                                        | Why / what to check                                                                                                                          |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Nothing happens immediately after installation                      | Default mode is off, selected scope is empty, and the allowance is one. Apply the full global setup above.                                   |
| It stops after one attempt                                          | `maxAttempts=1` caps cumulative attempts. Ongoing mode requires `0`.                                                                         |
| Astra or another model is skipped                                   | Use `model=all`; explicit filters exclude other models. Confirm the plugin version and actual resolved execution in status.                  |
| `below-context-threshold`                                           | The measured percentage is not strictly above the threshold. There is no trigger at exactly 70%.                                             |
| `not-idle`, `background-work`, `pending-interaction`, `queued-work` | Work or input still needs attention. The plugin waits rather than interrupting it.                                                           |
| `settings-changed`, `waiting-for-fresh-usage`, `stale-usage`        | Use the conversation normally again; fresh model usage is needed. Simply reopening it is insufficient.                                       |
| `clock-or-suspend-gap`, `missed-deadline`, `clock-changed`          | An old timer was discarded. Fresh activity is needed; the plugin does not catch up after sleep.                                              |
| `execution-changed`                                                 | Model, speed, or reasoning changed during the armed interval. A fresh decision is required.                                                  |
| `unknown-context`, `unknown-execution`, `read-or-state-error`       | A required measurement or SDK response is unavailable or malformed. Check logs; the plugin fails closed.                                     |
| `environment-unavailable`, `host-unavailable`                       | Restore the environment/host, then continue the chat normally.                                                                               |
| `attempt-limit`, `already-attempted`                                | The global allowance or content-generation checkpoint prevents another attempt. New content is still required even with unlimited allowance. |
| No threads in status yet                                            | Allow the next heartbeat/discovery scan. Check mode, selected scope, visibility/archive state, and `discovery.error`.                        |
| `discovery.error` is non-null                                       | Enumeration failed or hit its explicit bound. Check logs; activity events can still enroll threads individually.                             |

## Costs, retries, and stored data

Compaction uses your existing Codex account and conversation context. Normal provider usage applies.
`maxAttempts` limits operations, not HTTP requests, output tokens, or credits. Ongoing mode has no
total spending cap, and the idle cutoff cannot guarantee the cache is still warm. Future turns may
benefit from a smaller context, but net savings depend on actual reuse and subsequent work.

The plugin does not retry failed/uncertain compaction submissions. It preserves sender attribution,
rechecks its own dispatch admission, declines BB Provider Retry consent for its failed turns, and
cancels its own unexpectedly queued row when BB returns that row's ID. It does not change retry
settings for other senders. **Codex can still retry internally under its existing native policy.**
SDK reads and user actions are not one atomic transaction; a submission acknowledgement alone is not
a guarantee of completed compaction or a particular charge.

Plugin storage contains a cumulative attempt counter, consumed content sequences, and the latest 50
decision records. Records contain timestamps, thread IDs, measurements, and outcomes—not prompt
text. Status reads titles/project IDs for inspection. Native conversation history and token events
remain in BB/Codex. The plugin adds no agent tools, provider, authored summarization prompt, or
automatically injected skills, helping avoid unnecessary conversation-prefix changes.

## Updates and removal

### Git installation

The quick-start source tracks `main`; published commits make this source available without an npm
release. Check and apply compatible updates through BB:

```sh
bb plugin outdated
bb plugin update auto-compact
```

Review update prompts. After a reload, fresh activity is required before a new timer can arm. A
future tagged release would be a separate distribution choice; no release tag is required for this
explicit branch-tracking source.

### Local checkout

From the collection root, install the local source instead:

```sh
bb plugin install path:. --plugin bb-plugin-auto-compact
```

A local path installation uses the source in place. Keep that checkout at its installed location.
After pulling an update, build from the plugin directory and reload:

```sh
cd plugins/bb-plugin-auto-compact
bb plugin build .
bb plugin reload auto-compact
```

### Pause or uninstall

To stop **new** submissions while retaining the retry guards:

```sh
bb plugin config auto-compact set mode off
```

An operation already admitted may finish. Wait for its outcome before disabling or removing the
plugin; unloading it also removes the retry-consent and dispatch guards, and BB's fallback retry
behavior can then apply.

After admitted work settles, removal is:

```sh
bb plugin remove auto-compact
```

Removal unregisters the plugin and removes its settings, secrets, and schedules. Managed Git source
files are removed; a local source checkout is not deleted. Export any inspection records you intend
to retain before removal.

## Development and deeper references

No package install is needed for this plugin's tests or build with an already prepared BB toolchain:

```sh
node --test test/*.test.js
bb plugin build .
```

Tests use injected clocks and fake asynchronous BB SDK/storage calls. They cover threshold
boundaries, activity cancellation, reload/sleep, malformed responses, persistence failures, global
allowance races, discovery pagination/filtering, new threads, model/speed preservation, and retry
refusal. Repository checks run them again from a temporary relocated plugin copy. Tests do not
invoke a real provider or mutate live runtime data.

- [Verification evidence and practical limits](docs/verification.md)
- [Machine-readable verification snapshot](docs/verification-results.json)
- [Public SDK contract](docs/sdk-contract.md)
- [Activation reference](docs/trial-scope.md)
- [Design and lifecycle decisions](docs/design.md)
- [Plugin command reference](skills/auto-compact/SKILL.md)
- [Repository contribution guide](../../CONTRIBUTING.md)
- [MIT license](LICENSE)
