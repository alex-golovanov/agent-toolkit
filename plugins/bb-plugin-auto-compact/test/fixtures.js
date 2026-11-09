import { Coordinator } from "../src/coordinator.js";
import { isMaintenance } from "../src/policy.js";

export const THREAD = "thr_test1";
export const BASE = 1_000_000;
export const config = {
  mode: "compact",
  threadIds: THREAD,
  contextPercent: 70,
  idleMinutes: 15,
  maxAttempts: 1,
  model: "gpt-6.1-sol",
};

export function event(type, seq, createdAt, data = {}) {
  return {
    id: `event-${seq}`,
    threadId: THREAD,
    seq,
    type,
    createdAt,
    scope: { kind: "turn", turnId: "turn-1" },
    data,
  };
}

export function request(
  seq = 1,
  at = BASE,
  input = [{ type: "text", text: "Continue", mentions: [] }],
) {
  return event("client/turn/requested", seq, at, { input });
}

export function usage(seq = 2, at = BASE + 1) {
  return event("thread/tokenUsage/updated", seq, at, {
    tokenUsage: { last: { inputTokens: 350001, cachedInputTokens: 349000, outputTokens: 500 } },
  });
}

export function snapshot() {
  return {
    thread: {
      id: THREAD,
      providerId: "codex",
      status: "idle",
      runtime: { displayStatus: "idle" },
      archivedAt: null,
      deletedAt: null,
      visibility: "visible",
      activeBackgroundAgentCount: 0,
      queuedMessageCount: 0,
    },
    environment: { id: "env_test", hostId: "host_test", status: "ready", hostLifecycle: "active" },
    host: { id: "host_test", status: "connected", lifecycle: { phase: "active" } },
    usage: { usedTokens: 350001, modelContextWindow: 500000, estimated: false },
    interactions: [],
    queued: [],
    execution: { model: "gpt-6.1-sol", serviceTier: "default", reasoningLevel: "high" },
  };
}

export async function fixture(options = {}) {
  let time = BASE;
  const store = options.store ?? new Map();
  const snapshots = new Map([[THREAD, snapshot()]]);
  const events = new Map([[THREAD, [request(), usage()]]]);
  const calls = [];
  const logs = [];
  const faults = {};
  const bb = {
    pluginId: "auto-compact",
    log: Object.fromEntries(
      ["info", "warn", "error"].map((level) => [level, (text) => logs.push({ level, text })]),
    ),
    storage: {
      kv: {
        async get(key) {
          if (faults.get) await faults.get(key);
          return structuredClone(store.get(key));
        },
        async set(key, value) {
          if (faults.set) await faults.set(key, value);
          store.set(key, structuredClone(value));
        },
      },
    },
    sdk: {
      hosts: {
        async get() {
          return structuredClone(snapshotForHost().host);
        },
      },
      threads: {
        async get({ threadId, include }) {
          if (faults.threadGet) await faults.threadGet(threadId);
          const { thread, environment } = snapshots.get(threadId);
          return structuredClone({
            ...thread,
            ...(include === "environment" ? { environment } : {}),
          });
        },
        async context({ threadId }) {
          return structuredClone({ usage: snapshots.get(threadId).usage });
        },
        interactions: {
          async list({ threadId }) {
            return structuredClone(snapshots.get(threadId).interactions);
          },
        },
        queuedMessages: {
          async list({ threadId }) {
            return structuredClone(snapshots.get(threadId).queued);
          },
          async delete({ threadId, queuedMessageId }) {
            snapshots.get(threadId).queued = snapshots
              .get(threadId)
              .queued.filter((row) => row.id !== queuedMessageId);
          },
        },
        async defaultExecutionOptions({ threadId }) {
          return structuredClone(snapshots.get(threadId).execution);
        },
        events: {
          async list({ threadId, types, afterSeq = 0, order, limit }) {
            if (faults.events) return faults.events();
            let rows = (events.get(threadId) ?? []).filter(
              (row) => types.includes(row.type) && row.seq > afterSeq,
            );
            rows = rows.sort((a, b) => (order === "desc" ? b.seq - a.seq : a.seq - b.seq));
            return structuredClone(rows.slice(0, limit));
          },
        },
        async send(input) {
          const { threadId } = input;
          if (!isMaintenance(input.input)) throw new Error("Expected structured native compaction");
          const decision = coordinator.admit({
            originPluginId: bb.pluginId,
            thread: snapshots.get(threadId).thread,
            host: snapshots.get(threadId).host,
            environment: snapshots.get(threadId).environment,
            attempt: "start-turn",
            queuedMessages: [],
            ...faults.admission,
          });
          if (decision.action === "reject") throw new Error(decision.message);
          calls.push({ threadId, at: time });
          if (faults.compact) await faults.compact();
          return faults.outcome ?? { delivery: "sent" };
        },
      },
    },
  };
  function snapshotForHost() {
    return snapshots.get(THREAD);
  }
  const coordinator = await Coordinator.create(
    bb,
    { ...config, ...options.config },
    { now: () => time },
  );
  return {
    bb,
    coordinator,
    store,
    snapshots,
    events,
    calls,
    logs,
    faults,
    setTime(value) {
      time = value;
    },
    now() {
      return time;
    },
    async arm(threadId = THREAD) {
      time += 10;
      await coordinator.onLifecycle(threadId, "idle");
    },
    async due(threadId = THREAD) {
      time = coordinator.state(threadId).arm.dueAt;
      await coordinator.submit(threadId);
    },
  };
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
