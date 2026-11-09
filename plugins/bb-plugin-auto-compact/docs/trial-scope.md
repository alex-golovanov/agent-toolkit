# Activation and ongoing operation

BB Auto Compact starts off. Installation and billable compaction require the user's applicable
approval. Agree on provider/model coverage, conversation scope, operation allowance, native retry
policy, and expected or maximum cost before activation. Never publish private thread IDs or
conversation records in this repository.

## Installation defaults

New installs use selected scope, an empty thread list, one persistent submission attempt, and the
all-model filter. The policy is context strictly above 70% and 15 continuously idle minutes.
`model=all` accepts every configured Codex model, including Sol and Astra, preserving each chat's
resolved model, speed, and reasoning setting. Optional explicit filters select Sol or Astra. Other
providers are outside this plugin's scope.

## Install and activate after approval

From this plugin directory, use `bb plugin install path:. --yes` only for the approved source. From
the collection root, the equivalent is
`bb plugin install path:. --plugin bb-plugin-auto-compact --yes`. Verify the plugin is running with
mode off before configuration.

For approved global ongoing operation, use `scope=all`, `model=all`, and `maxAttempts=0`, then
enable mode `compact`. All scope ignores the selected thread list and discovers existing and new
conversations across projects. Zero removes the count limit; positive values cap cumulative attempts
across the scope. It is not a daily allowance or a credit cap. Observe mode records candidates
without submitting compaction.

Native Codex internal retries remain unchanged. The plugin does not retry a failed or ambiguous
submission for the same content generation and declines BB Provider Retry consent for its requests.
New conversation content and fresh usage can qualify again. New providers, changed model coverage,
and forced or shortened live tests require their own applicable approval.

## Eligibility and inspection

A fresh non-maintenance turn must produce model usage after activation or reload. Old idle history
never creates overdue timers. Hidden/archived chats, active or pending work, unavailable hosts,
unknown context usage, and malformed execution settings prevent submission. Model or speed changes
during a timer cancel that decision. The threshold requires measured context strictly above 70%.

Use `bb auto-compact status --json` for discovery health and a bounded overview, including each
thread's model, speed, context, and waiting reason. Add `--thread THREAD_ID` to inspect one
conversation. History and usage accept the same filter. After a natural trigger, confirm the native
outcome and inspect cached-input/output tokens. Submitted does not mean completed; usage samples are
not an account billing reconciliation. Exact cache expiry and net savings are not guaranteed.

Pause new submissions with `bb plugin config auto-compact set mode off`. Keep the plugin loaded
until any admitted operation finishes, so its retry guards remain available.
