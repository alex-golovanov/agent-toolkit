---
name: auto-compact
description: Inspect the Auto Compact BB plugin's timers, scope and persistent operation allowance.
---

# BB Auto Compact

This is plugin documentation. The manifest deliberately disables automatic skill injection so this
file does not become a new agent instruction.

Use `bb auto-compact status --json` to inspect mode, selected thread IDs, armed deadlines and
remaining submission allowance. Use `bb auto-compact history --json` to inspect the latest 50
decisions. Neither command invokes a model.

Use `bb auto-compact usage --json` to read native token-usage samples from recent compaction turns.
They are scoped to BB turns, not independently reconciled provider charges.

The starting policy is exact context above 70% and 15 minutes idle. Codex cache expiry is not
observable directly. Only explicitly scoped visible GPT-6.1 Sol threads at Standard speed qualify in
this trial version.

Installation starts off. Do not install, enable compact mode, broaden scope or increase allowance
without the user's applicable exact approval. Native compaction is billable and may have
provider-internal retries; the plugin does not retry failed or ambiguous submissions.

Pause with `bb plugin config auto-compact set mode off`. Changing settings discards old timers;
fresh model usage is required to arm again. Do not interpret `submitted` as completed compaction or
a confirmed price.
