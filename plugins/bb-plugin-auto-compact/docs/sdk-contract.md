# Verified public BB contract

Verified read-only against installed BB 0.49.0 / Plugin SDK 0.6.132 on 2026-11-09. Runtime code
receives `bb` through its factory and imports no private packages or external modules.

## Public calls used

- `bb.settings.define(descriptors)`: `get()` is async; `onChange(next)` receives effective values.
  Standard Schema synchronous validators enforce integer ranges and thread-ID syntax.
- `bb.storage.kv.get(key)` / `set(key, value)` are **async**, despite the underlying local SQL
  operation. Await persistence before spending. Values are JSON and limited to 256 KiB.
- `bb.sdk.threads.get({threadId, include: "environment", signal})` returns the thread itself, with
  `environment` added only when requested by the include selector. The CLI show wrapper is different
  and must not be used as the SDK contract.
- `threads.context({threadId, signal})` returns `{usage}` with `usedTokens`, `modelContextWindow`
  and `estimated`.
- `threads.defaultExecutionOptions({threadId, signal})` returns the resolved
  `{model, serviceTier, reasoningLevel, ...}` or null.
- `threads.interactions.list` returns a bare array of pending interactions.
  `threads.queuedMessages.list` returns a bare array. Neither is a wrapped `{items}` object.
- `threads.events.list({threadId, types, order, afterSeq?, limit, signal})` returns raw event rows
  `{seq, type, createdAt, data, scope, ...}`. Requests use a bounded page size of 100. Event
  filtering is supported.
- `bb.sdk.hosts.get({hostId, signal})` returns the host descriptor. A connected persistent host has
  `status: "connected"` and `lifecycle.phase: "active"`.
- `threads.compact({threadId})` invokes native compaction but loses plugin attribution and takes the
  operation path, which bypasses plugin dispatch admission hooks. It is intentionally **not used**
  by this plugin.
- `threads.send({threadId, mode: "auto", input, model, serviceTier, reasoningLevel})` supports the
  public structured builtin `/compact` input (command mention with builtin origin). The plugin-bound
  SDK stamps `originPluginId`. Core sends the same native compaction command and returns
  `{delivery: "sent"}` or `{delivery: "queued", queuedMessage}`. A queued race is cancelled using
  the returned ID; no unrelated row is deleted.
- `bb.experimental_hooks.on("message.dispatch", ...)` rejects this plugin's deferred/replayed
  requests without a live idle/deadline permit, including join-turn attempts. Requests from other
  senders proceed unchanged.
- `bb.rpc.register(contract, handlers)` accepts literal Standard Schema contracts
  (`defineRpcContract` is an identity helper). The `provider-retry.v1.consent` handler always
  declines retrying this plugin's failed turns. This uses the existing Provider Retry protocol
  without changing its global settings.

Neither native route has a per-call output-token cap, credit cap or Codex transport-retry override.
An acknowledgement is not a final compaction/billing result.

The coordinator registers lifecycle events and `experimental_thread.events`; that notification
carries no event content. Model usage is read from filtered stored events. A thread entering idle is
an announcement, not an opportunity to veto the preceding turn. `message.queued` carries `entry`;
`interaction.pending` carries `thread`.

Background services start after factory completion and receive an abort signal. Disposal cancels
reads and timers immediately. Runtime imports and plugin agent surfaces are intentionally absent.
CLI registration uses the simple public registration contract because the three commands are
read-only and have no structured arguments.

## Source references

The contract was checked in the installed SDK/client and route implementations, not inferred solely
from examples. Relevant sections were `createThreadsArea`, `eventsListQuery`,
`compactThreadContext`, settings/storage factory, thread interaction routes and host descriptors.
The official skill references are the backend SDK, events, foundation, CLI and testing chapters
under BB Plugin Authoring.

The source lives in the installed BB application and is not copied into the plugin. Fake tests
preserve the verified async behavior and wrapper/array shapes. Native registration/build is verified
separately; live installation requires approval.
