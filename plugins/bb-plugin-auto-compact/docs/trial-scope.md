# Scoped activation guide

BB Auto Compact starts off. Installation and billable compaction require the user's explicit
approval. Before activation, agree on selected BB thread IDs, the existing Codex model and speed,
source conversation context, purpose, operation allowance, native retry policy, and expected or
maximum cost. Never publish private thread IDs or conversation records in this repository.

## Initial policy

Use GPT-6.1 Sol at Standard speed, context strictly above 70%, 15 continuously idle minutes, and one
persistent native submission attempt across the selected threads. Keep plugin retries disabled.
Codex may retry internally; the allowance limits operations, not HTTP requests or credits. The
plugin declines BB Provider Retry consent for its own attributed submissions.

## Install and activate after approval

From this plugin directory, use `bb plugin install path:. --yes` only for the approved source. From
the collection root, the equivalent is
`bb plugin install path:. --plugin bb-plugin-auto-compact --yes`. Verify the plugin is running and
`bb auto-compact status --json` reports mode off.

Set explicit, comma-separated thread IDs with `bb plugin config auto-compact set threadIds` and
check the effective settings. Keep `maxAttempts` at 1 and the existing 70/15 defaults. Set mode to
`compact` only within the approved paid scope. Mode `observe` records candidates without compaction.
A fresh non-maintenance turn must produce model usage after activation; old idle history cannot arm
an overdue timer. No operation is expected if the selected thread is below threshold.

## Review the outcome

Let the natural policy trigger; do not force compaction or shorten the timer to test it. Read
`bb auto-compact history --json` and `bb auto-compact usage --json` afterward. Confirm the native
outcome and inspect cached input and output tokens. Submitted does not mean completed, and usage
samples are not a billing reconciliation. A failed or ambiguous attempt consumes the allowance. Do
not increase it or retry without expanded approval.

Pause new submissions with `bb plugin config auto-compact set mode off`. Keep the plugin loaded
until any admitted operation finishes, so its retry guards remain available.
