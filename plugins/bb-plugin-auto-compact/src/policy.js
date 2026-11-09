export const MINUTE = 60_000;
export const HEARTBEAT_MS = 15_000;
export const MAX_LATE_MS = MINUTE;
export const MAX_HEARTBEAT_GAP_MS = 90_000;
export const EVENT_TYPES = [
  "client/turn/requested",
  "thread/tokenUsage/updated",
  "thread/compacted",
  "thread/context/cleared",
];

export const DEFAULTS = Object.freeze({
  mode: "off",
  scope: "selected",
  threadIds: "",
  contextPercent: 70,
  idleMinutes: 15,
  maxAttempts: 1,
  model: "all",
});

// Public structured builtin-command input, identical to BB's composer /compact.
export function compactInput() {
  return [
    {
      type: "text",
      text: "/compact",
      mentions: [
        {
          start: 0,
          end: 8,
          resource: {
            kind: "command",
            trigger: "/",
            name: "compact",
            source: "command",
            origin: "builtin",
            label: "compact",
            argumentHint: null,
          },
        },
      ],
    },
  ];
}

export function configFrom(values) {
  const config = { ...DEFAULTS, ...values };
  if (!["off", "observe", "compact"].includes(config.mode)) throw new Error("Invalid mode");
  if (!["selected", "all"].includes(config.scope)) throw new Error("Invalid scope");
  for (const [key, low, high] of [
    ["contextPercent", 1, 99],
    ["idleMinutes", 1, 240],
    ["maxAttempts", 0, 1000000],
  ]) {
    if (!Number.isInteger(config[key]) || config[key] < low || config[key] > high) {
      throw new Error(`${key} must be an integer from ${low} to ${high}`);
    }
  }
  if (typeof config.threadIds !== "string") throw new Error("threadIds must be a string");
  const ids = [...new Set(config.threadIds.split(/[\s,]+/).filter(Boolean))];
  if (ids.length > 50 || ids.some((id) => !/^thr_[a-z0-9]+$/.test(id))) {
    throw new Error("Use at most 50 explicit BB thread IDs; wildcards are not supported");
  }
  if (!["all", "gpt-6.1-sol", "gpt-6-astra"].includes(config.model))
    throw new Error("Use all Codex models, gpt-6.1-sol, or gpt-6-astra");
  return { ...config, ids };
}

export function isMaintenance(input) {
  if (!Array.isArray(input)) return false;
  return input.some(
    (block) =>
      block.type === "text" &&
      Array.isArray(block.mentions) &&
      block.mentions.some(
        (mention) =>
          mention.resource?.kind === "command" &&
          mention.resource.origin === "builtin" &&
          mention.resource.source === "command" &&
          mention.resource.trigger === "/" &&
          ["compact", "clear"].includes(mention.resource.name),
      ),
  );
}

export function tokenCounts(usage) {
  if (!usage || typeof usage !== "object") return null;
  return Object.fromEntries(
    [
      "inputTokens",
      "cachedInputTokens",
      "cacheReadInputTokens",
      "cacheWriteInputTokens",
      "outputTokens",
      "reasoningOutputTokens",
      "totalTokens",
    ]
      .filter((key) => Number.isFinite(usage[key]) && usage[key] >= 0)
      .map((key) => [key, usage[key]]),
  );
}

export function createState(threadId, consumedContentSeq = 0) {
  return {
    threadId,
    cursor: 0,
    contentSeq: 0,
    consumedContentSeq,
    lastUsageAt: null,
    lastUsageSeq: 0,
    lastUsage: null,
    status: null,
    idleSince: null,
    arm: null,
    revision: 0,
    reason: "waiting-for-fresh-usage",
    executionKey: null,
  };
}

export function invalidate(state, reason, { clearUsage = false } = {}) {
  state.revision += 1;
  state.arm = null;
  state.reason = reason;
  if (clearUsage) {
    state.lastUsageAt = null;
    state.lastUsageSeq = 0;
    state.idleSince = null;
  }
}

export function reduceEvents(state, events, freshAfter) {
  const boundaries = [];
  for (const event of [...events].sort((a, b) => a.seq - b.seq)) {
    if (!Number.isSafeInteger(event.seq) || event.seq <= state.cursor) continue;
    const data = event.data ?? {};
    state.cursor = event.seq;
    if (event.type === "client/turn/requested") {
      invalidate(state, "new-input");
      state.idleSince = null;
      if (isMaintenance(data.input)) {
        state.consumedContentSeq = Math.max(state.consumedContentSeq, state.contentSeq);
      } else if (Array.isArray(data.input)) {
        state.contentSeq = event.seq;
      } else {
        // Unknown historical requests do not authorize spending.
        state.consumedContentSeq = Math.max(state.consumedContentSeq, state.contentSeq);
      }
    } else if (event.type === "thread/tokenUsage/updated") {
      if (Number.isFinite(event.createdAt) && event.createdAt >= freshAfter) {
        invalidate(state, "fresh-model-usage");
        state.lastUsageAt = event.createdAt;
        state.lastUsageSeq = event.seq;
        const usage = data.tokenUsage?.last;
        state.lastUsage = tokenCounts(usage);
      }
    } else if (["thread/compacted", "thread/context/cleared"].includes(event.type)) {
      state.consumedContentSeq = Math.max(state.consumedContentSeq, state.contentSeq);
      invalidate(state, event.type, { clearUsage: true });
      boundaries.push({ type: event.type, seq: event.seq, at: event.createdAt });
    }
  }
  return boundaries;
}

export function executionKey(execution) {
  return JSON.stringify([execution?.model, execution?.serviceTier, execution?.reasoningLevel]);
}

export function eligibility(snapshot, config) {
  const thread = snapshot.thread;
  if (!thread || thread.providerId !== "codex") return "not-codex";
  if (thread.status !== "idle" || thread.runtime?.displayStatus !== "idle") return "not-idle";
  if (thread.archivedAt != null || thread.deletedAt != null || thread.visibility !== "visible")
    return "not-visible";
  if (thread.activeBackgroundAgentCount !== 0) return "background-work";
  if (
    !snapshot.environment ||
    snapshot.environment.status !== "ready" ||
    snapshot.environment.hostLifecycle !== "active"
  )
    return "environment-unavailable";
  if (snapshot.host?.status !== "connected" || snapshot.host?.lifecycle?.phase !== "active")
    return "host-unavailable";
  if (!Array.isArray(snapshot.interactions) || !Array.isArray(snapshot.queued))
    return "unknown-pending-work";
  if (snapshot.interactions.length) return "pending-interaction";
  if (snapshot.queued.length || thread.queuedMessageCount !== 0) return "queued-work";
  const execution = snapshot.execution;
  if (
    !execution ||
    typeof execution.model !== "string" ||
    !execution.model.trim() ||
    (execution.serviceTier != null && typeof execution.serviceTier !== "string") ||
    (execution.reasoningLevel != null && typeof execution.reasoningLevel !== "string")
  )
    return "unknown-execution";
  if (config.model !== "all" && execution.model !== config.model) return "model-filtered";
  const usage = snapshot.usage;
  if (
    !usage ||
    usage.estimated !== false ||
    !Number.isFinite(usage.usedTokens) ||
    !Number.isFinite(usage.modelContextWindow) ||
    usage.usedTokens < 0 ||
    usage.modelContextWindow <= 0 ||
    usage.usedTokens > usage.modelContextWindow
  )
    return "unknown-context";
  return usage.usedTokens * 100 > config.contextPercent * usage.modelContextWindow
    ? null
    : "below-context-threshold";
}

export function armState(state, snapshot, config, now) {
  const reason = eligibility(snapshot, config);
  if (reason) {
    invalidate(state, reason);
    return;
  }
  if (
    state.contentSeq <= state.consumedContentSeq ||
    state.lastUsageSeq <= state.contentSeq ||
    state.lastUsageAt === null
  ) {
    invalidate(state, "waiting-for-fresh-usage");
    return;
  }
  if (state.lastUsageAt > now) {
    invalidate(state, "clock-changed", { clearUsage: true });
    return;
  }
  if (!state.arm && now - state.lastUsageAt > config.idleMinutes * MINUTE) {
    invalidate(state, "stale-usage", { clearUsage: true });
    return;
  }
  if (state.idleSince === null) state.idleSince = now;
  const key = executionKey(snapshot.execution);
  if (state.arm && state.arm.executionKey !== key) {
    invalidate(state, "execution-changed", { clearUsage: true });
    return;
  }
  state.executionKey = key;
  state.arm = {
    dueAt: Math.max(state.idleSince, state.lastUsageAt) + config.idleMinutes * MINUTE,
    contentSeq: state.contentSeq,
    usageSeq: state.lastUsageSeq,
    executionKey: key,
  };
  state.reason = "armed";
}
