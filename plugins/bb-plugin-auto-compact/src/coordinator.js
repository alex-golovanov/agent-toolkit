import {
  configFrom,
  createState,
  invalidate,
  reduceEvents,
  armState,
  eligibility,
  executionKey,
  compactInput,
  tokenCounts,
  EVENT_TYPES,
  MAX_LATE_MS,
  MAX_HEARTBEAT_GAP_MS,
} from "./policy.js";

const LEDGER_KEY = "attempt-ledger-v1";
const HISTORY_KEY = "decision-history-v1";
const EMPTY_LEDGER = { version: 1, attemptsUsed: 0, consumed: {} };
const DISCOVERY_MS = 60_000;
const PAGE_SIZE = 100;

function discoverable(thread) {
  return (
    thread &&
    typeof thread.id === "string" &&
    /^thr_[a-z0-9]+$/.test(thread.id) &&
    thread.providerId === "codex" &&
    thread.visibility === "visible" &&
    thread.archivedAt == null &&
    thread.deletedAt == null
  );
}

export class Coordinator {
  constructor(bb, values, { now = Date.now } = {}) {
    this.bb = bb;
    this.now = now;
    this.config = configFrom(values);
    this.freshAfter = now();
    this.lastTick = now();
    this.states = new Map();
    this.jobs = new Map();
    this.reservations = Promise.resolve();
    this.records = Promise.resolve();
    this.ledgerCache = null;
    this.permits = new Map();
    this.abort = new AbortController();
    this.disposed = false;
    this.discovery = { at: null, error: null };
    this.discoveryJob = null;
  }

  static async create(bb, values, options) {
    const coordinator = new Coordinator(bb, values, options);
    coordinator.ledgerCache = await coordinator.ledger();
    return coordinator;
  }

  async ledger() {
    const value = (await this.bb.storage.kv.get(LEDGER_KEY)) ?? structuredClone(EMPTY_LEDGER);
    if (
      value.version !== 1 ||
      !Number.isSafeInteger(value.attemptsUsed) ||
      value.attemptsUsed < 0 ||
      !value.consumed ||
      typeof value.consumed !== "object" ||
      Array.isArray(value.consumed)
    ) {
      throw new Error("Invalid persisted allowance; refusing compaction");
    }
    return structuredClone(value);
  }

  record(threadId, action, detail = {}) {
    const next = this.records
      .catch(() => {})
      .then(async () => {
        if (this.disposed) return;
        const history = (await this.bb.storage.kv.get(HISTORY_KEY)) ?? [];
        if (!Array.isArray(history)) throw new Error("Invalid decision history");
        const row = { at: this.now(), threadId, action, ...detail };
        await this.bb.storage.kv.set(HISTORY_KEY, [...history.slice(-49), row]);
        if (!this.disposed) this.bb.log.info(JSON.stringify(row));
      });
    this.records = next;
    return next;
  }

  scoped(threadId) {
    return (
      !this.disposed &&
      this.config.mode !== "off" &&
      typeof threadId === "string" &&
      /^thr_[a-z0-9]+$/.test(threadId) &&
      (this.config.scope === "all" || this.config.ids.includes(threadId))
    );
  }

  state(threadId) {
    if (!this.states.has(threadId)) {
      if (!this.ledgerCache) throw new Error("Coordinator has not been initialized");
      const consumed = this.ledgerCache.consumed[threadId] ?? 0;
      if (!Number.isSafeInteger(consumed) || consumed < 0)
        throw new Error("Invalid content checkpoint");
      this.states.set(threadId, createState(threadId, consumed));
    }
    return this.states.get(threadId);
  }

  queue(threadId, job) {
    if (!this.scoped(threadId)) return Promise.resolve();
    const prior = this.jobs.get(threadId) ?? Promise.resolve();
    const next = prior
      .catch(() => {})
      .then(async () => {
        if (this.scoped(threadId)) await job();
      });
    this.jobs.set(threadId, next);
    // Keep failures visible without creating an unhandled rejection.
    next
      .catch((error) => {
        const state = this.states.get(threadId);
        if (state) invalidate(state, "read-or-state-error", { clearUsage: true });
        if (!this.disposed) this.bb.log.error(`auto-compact ${threadId}: ${error.message}`);
      })
      .finally(() => {
        if (this.jobs.get(threadId) === next) this.jobs.delete(threadId);
      });
    return next;
  }

  async events(state) {
    const validate = (events) => {
      if (
        !Array.isArray(events) ||
        events.some(
          (event) =>
            !Number.isSafeInteger(event.seq) ||
            event.seq < 1 ||
            !Number.isFinite(event.createdAt) ||
            !EVENT_TYPES.includes(event.type),
        )
      ) {
        throw new Error("Unknown events response");
      }
      return events;
    };
    if (state.cursor === 0) {
      const [recent, request] = await Promise.all([
        this.bb.sdk.threads.events.list({
          threadId: state.threadId,
          types: EVENT_TYPES,
          order: "desc",
          limit: 100,
          signal: this.abort.signal,
        }),
        this.bb.sdk.threads.events.list({
          threadId: state.threadId,
          types: ["client/turn/requested"],
          order: "desc",
          limit: 1,
          signal: this.abort.signal,
        }),
      ]);
      validate(recent);
      validate(request);
      return [...new Map([...request, ...recent].map((event) => [event.seq, event])).values()];
    }
    const collected = [];
    let cursor = state.cursor;
    for (let page = 0; page < 10; page += 1) {
      const events = await this.bb.sdk.threads.events.list({
        threadId: state.threadId,
        types: EVENT_TYPES,
        order: "asc",
        afterSeq: cursor,
        limit: 100,
        signal: this.abort.signal,
      });
      validate(events);
      collected.push(...events);
      if (events.length < 100) return collected;
      const next = Math.max(...events.map((event) => event.seq));
      if (!Number.isSafeInteger(next) || next <= cursor)
        throw new Error("Non-advancing event cursor");
      cursor = next;
    }
    throw new Error("Event backlog exceeded safe read bound");
  }

  async snapshot(threadId) {
    const [response, context, interactions, queued, execution] = await Promise.all([
      this.bb.sdk.threads.get({ threadId, include: "environment", signal: this.abort.signal }),
      this.bb.sdk.threads.context({ threadId, signal: this.abort.signal }),
      this.bb.sdk.threads.interactions.list({ threadId, signal: this.abort.signal }),
      this.bb.sdk.threads.queuedMessages.list({ threadId, signal: this.abort.signal }),
      this.bb.sdk.threads.defaultExecutionOptions({ threadId, signal: this.abort.signal }),
    ]);
    const host = response?.environment?.hostId
      ? await this.bb.sdk.hosts.get({
          hostId: response.environment.hostId,
          signal: this.abort.signal,
        })
      : null;
    return {
      thread: response,
      environment: response?.environment,
      host,
      usage: context?.usage,
      interactions,
      queued,
      execution,
    };
  }

  async checkpoint(threadId, contentSeq) {
    const job = this.reservations
      .catch(() => {})
      .then(async () => {
        if (this.disposed) return;
        const ledger = await this.ledger();
        ledger.consumed[threadId] = Math.max(ledger.consumed[threadId] ?? 0, contentSeq);
        if (this.disposed) return;
        await this.bb.storage.kv.set(LEDGER_KEY, ledger);
        this.ledgerCache = ledger;
      });
    this.reservations = job;
    await job;
  }

  async refresh(threadId, { idleEvent = false } = {}) {
    if (!this.scoped(threadId)) return;
    const state = this.state(threadId);
    const revision = state.revision;
    const [events, snapshot] = await Promise.all([this.events(state), this.snapshot(threadId)]);
    if (!this.scoped(threadId) || state.revision !== revision) return;
    const boundaries = reduceEvents(state, events, this.freshAfter);
    const reducedRevision = state.revision;
    state.status = snapshot.thread?.status ?? null;
    state.projectId = snapshot.thread?.projectId ?? null;
    state.title = snapshot.thread?.title ?? snapshot.thread?.titleFallback ?? null;
    state.usedTokens = snapshot.usage?.usedTokens ?? null;
    state.modelContextWindow = snapshot.usage?.modelContextWindow ?? null;
    state.model = snapshot.execution?.model ?? null;
    state.serviceTier = snapshot.execution?.serviceTier ?? null;
    if (idleEvent && state.idleSince === null) state.idleSince = this.now();
    for (const boundary of boundaries) {
      await this.checkpoint(threadId, state.consumedContentSeq);
      if (boundary.at >= this.freshAfter)
        await this.record(threadId, "context-boundary", { type: boundary.type, seq: boundary.seq });
    }
    if (!this.scoped(threadId) || state.revision !== reducedRevision) return;
    armState(state, snapshot, this.config, this.now());
  }

  onEvents(threadId) {
    return this.queue(threadId, () => this.refresh(threadId));
  }

  onLifecycle(threadId, kind) {
    if (!this.scoped(threadId)) return Promise.resolve();
    const state = this.state(threadId);
    invalidate(state, kind, {
      clearUsage: ["failed", "archived", "deleted", "pending-interaction", "queued-work"].includes(
        kind,
      ),
    });
    if (kind !== "idle") {
      state.idleSince = null;
      state.status = kind;
      return Promise.resolve();
    }
    return this.queue(threadId, () => this.refresh(threadId, { idleEvent: true }));
  }

  update(values) {
    let next;
    try {
      next = configFrom(values);
    } catch (error) {
      this.config = { ...this.config, mode: "off" };
      this.freshAfter = this.now();
      for (const state of this.states.values())
        invalidate(state, "invalid-settings", { clearUsage: true });
      throw error;
    }
    this.config = next;
    this.freshAfter = this.now();
    for (const state of this.states.values())
      invalidate(state, "settings-changed", { clearUsage: true });
    for (const id of this.states.keys())
      if (next.scope !== "all" && !next.ids.includes(id)) this.states.delete(id);
    this.discovery = { at: null, error: null };
  }

  async discover() {
    if (this.config.mode === "off" || this.config.scope !== "all" || this.disposed) return;
    if (this.discoveryJob) return this.discoveryJob;
    const config = this.config;
    this.discoveryJob = (async () => {
      try {
        const seen = new Set();
        for (let page = 0; page < 100; page += 1) {
          const rows = await this.bb.sdk.threads.list({
            archived: false,
            includeHidden: false,
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
            signal: this.abort.signal,
          });
          if (this.disposed || this.config !== config) return;
          if (!Array.isArray(rows) || rows.some((row) => !row || typeof row.id !== "string"))
            throw new Error("Unknown thread list response");
          for (const thread of rows.filter(discoverable)) {
            seen.add(thread.id);
            if (!this.states.has(thread.id)) await this.onEvents(thread.id).catch(() => {});
            if (this.disposed || this.config !== config) return;
          }
          if (rows.length < PAGE_SIZE) {
            for (const [id, state] of this.states) {
              if (!seen.has(id)) {
                invalidate(state, "outside-global-scope", { clearUsage: true });
                this.states.delete(id);
              }
            }
            this.discovery = { at: this.now(), error: null };
            return;
          }
        }
        throw new Error("Thread discovery exceeded 100 pages");
      } catch (error) {
        if (!this.disposed && this.config === config) {
          this.discovery = { at: this.now(), error: error.message };
          this.bb.log.error(`auto-compact discovery: ${error.message}`);
        }
      }
    })().finally(() => {
      this.discoveryJob = null;
    });
    return this.discoveryJob;
  }

  async start() {
    await this.discover();
    await Promise.allSettled(this.config.ids.map((id) => this.onEvents(id)));
  }

  async tick() {
    if (this.disposed) return;
    const now = this.now();
    const gap = now - this.lastTick;
    this.lastTick = now;
    if (gap < 0 || gap > MAX_HEARTBEAT_GAP_MS) {
      this.freshAfter = now;
      for (const state of this.states.values())
        invalidate(state, "clock-or-suspend-gap", { clearUsage: true });
      return;
    }
    const jobs = [];
    for (const state of this.states.values()) {
      if (state.arm && now >= state.arm.dueAt)
        jobs.push(this.queue(state.threadId, () => this.submit(state.threadId)));
    }
    await Promise.allSettled(jobs);
    if (this.discovery.at === null || now - this.discovery.at >= DISCOVERY_MS)
      await this.discover();
  }

  admit(context) {
    if (context.originPluginId !== this.bb.pluginId) return { action: "proceed" };
    const threadId = context.thread?.id;
    const permit = this.permits.get(threadId);
    const state = this.states.get(threadId);
    if (
      !permit ||
      !state ||
      !this.scoped(threadId) ||
      this.config.mode !== "compact" ||
      context.attempt !== "start-turn" ||
      context.thread.status !== "idle" ||
      context.thread.runtime?.displayStatus !== "idle" ||
      context.thread.archivedAt != null ||
      context.thread.deletedAt != null ||
      context.thread.visibility !== "visible" ||
      context.host?.status !== "connected" ||
      context.host?.lifecycle?.phase !== "active" ||
      context.environment?.status !== "ready" ||
      context.thread.activeBackgroundAgentCount !== 0 ||
      context.thread.queuedMessageCount !== 0 ||
      !Array.isArray(context.queuedMessages) ||
      context.queuedMessages.length ||
      state.revision !== permit.revision ||
      this.now() < permit.dueAt ||
      this.now() - permit.dueAt > MAX_LATE_MS
    ) {
      return {
        action: "reject",
        message:
          "Auto Compact: the original idle opportunity is no longer eligible; no deferred retry.",
      };
    }
    return { action: "proceed" };
  }

  async submit(threadId) {
    const state = this.state(threadId);
    const arm = state.arm;
    if (!arm || !this.scoped(threadId)) return;
    const revision = state.revision;
    const snapshot = await this.snapshot(threadId);
    const events = await this.events(state);
    if (!this.scoped(threadId) || state.revision !== revision) return;
    reduceEvents(state, events, this.freshAfter);
    // A usage update, new input or compaction invalidates the original arm.
    if (
      state.arm !== arm ||
      state.contentSeq !== arm.contentSeq ||
      state.lastUsageSeq !== arm.usageSeq
    ) {
      armState(state, snapshot, this.config, this.now());
      return;
    }
    const reason =
      eligibility(snapshot, this.config) ??
      (executionKey(snapshot.execution) !== arm.executionKey ? "execution-changed" : null) ??
      (this.now() < arm.dueAt || this.now() - arm.dueAt > MAX_LATE_MS ? "missed-deadline" : null);
    if (reason) {
      invalidate(state, reason, { clearUsage: true });
      await this.record(threadId, "skipped", { reason });
      return;
    }
    if (this.config.mode === "observe") {
      state.consumedContentSeq = state.contentSeq;
      invalidate(state, "observed");
      await this.record(threadId, "would-compact", {
        usedTokens: snapshot.usage.usedTokens,
        contextWindow: snapshot.usage.modelContextWindow,
      });
      return;
    }
    // Global serialization makes the allowance apply across selected threads.
    const reservation = this.reservations
      .catch(() => {})
      .then(async () => {
        if (!this.scoped(threadId) || state.revision !== revision || state.arm !== arm)
          return false;
        if (this.now() - arm.dueAt > MAX_LATE_MS) {
          invalidate(state, "missed-deadline", { clearUsage: true });
          return false;
        }
        const ledger = await this.ledger();
        if (!this.scoped(threadId) || state.revision !== revision || state.arm !== arm)
          return false;
        if (this.config.maxAttempts !== 0 && ledger.attemptsUsed >= this.config.maxAttempts) {
          invalidate(state, "attempt-limit");
          return false;
        }
        if ((ledger.consumed[threadId] ?? 0) >= state.contentSeq) {
          invalidate(state, "already-attempted");
          return false;
        }
        ledger.attemptsUsed += 1;
        ledger.consumed[threadId] = state.contentSeq;
        // A failed/ambiguous KV write must precede any model call.
        await this.bb.storage.kv.set(LEDGER_KEY, ledger);
        this.ledgerCache = ledger;
        if (!this.scoped(threadId) || state.revision !== revision || state.arm !== arm)
          return false;
        state.consumedContentSeq = state.contentSeq;
        invalidate(state, "attempt-reserved");
        const reservedRevision = state.revision;
        await this.record(threadId, "attempt-reserved", {
          number: ledger.attemptsUsed,
          model: snapshot.execution.model,
          serviceTier: snapshot.execution.serviceTier,
          usedTokens: snapshot.usage.usedTokens,
          contextWindow: snapshot.usage.modelContextWindow,
        });
        return reservedRevision;
      });
    this.reservations = reservation;
    const reservedRevision = await reservation;
    if (
      reservedRevision === false ||
      !this.scoped(threadId) ||
      this.config.mode !== "compact" ||
      state.revision !== reservedRevision ||
      this.now() - arm.dueAt > MAX_LATE_MS
    )
      return;
    this.permits.set(threadId, { dueAt: arm.dueAt, revision: reservedRevision });
    try {
      // Plugin-bound send preserves originPluginId, so Provider Retry asks this
      // plugin for consent. The compact() convenience action loses attribution.
      const outcome = await this.bb.sdk.threads.send({
        threadId,
        mode: "auto",
        input: compactInput(),
        model: snapshot.execution.model,
        serviceTier: snapshot.execution.serviceTier,
        reasoningLevel: snapshot.execution.reasoningLevel,
      });
      if (outcome?.delivery === "queued") {
        const queuedMessageId = outcome.queuedMessage?.id;
        if (typeof queuedMessageId === "string") {
          await this.bb.sdk.threads.queuedMessages.delete({ threadId, queuedMessageId });
          if (!this.disposed) await this.record(threadId, "deferred-submission-cancelled");
        } else {
          if (!this.disposed)
            await this.record(threadId, "deferred-submission-blocked", {
              reason: "missing-queue-id; dispatch-permit-revoked",
            });
        }
      } else if (outcome?.delivery === "sent") {
        if (!this.disposed) await this.record(threadId, "submitted");
      } else {
        if (!this.disposed)
          await this.record(threadId, "failed-or-unknown", {
            reason: "unrecognized-admission-result",
          });
      }
    } catch (error) {
      if (!this.disposed)
        await this.record(threadId, "failed-or-unknown", {
          reason: "native-operation-rejected-or-unconfirmed",
        });
      // An ambiguous request consumes its allowance. There is deliberately no retry.
    } finally {
      this.permits.delete(threadId);
    }
  }

  async status(threadId) {
    const states = [...this.states.values()];
    return {
      settings: this.config,
      ledger: await this.ledger(),
      discovery: this.discovery,
      watchedCount: states.length,
      truncated: !threadId && states.length > 100,
      threads: states
        .filter((state) => !threadId || state.threadId === threadId)
        .slice(0, 100)
        .map((state) => ({
          threadId: state.threadId,
          projectId: state.projectId ?? null,
          title: state.title ?? null,
          usedTokens: state.usedTokens ?? null,
          modelContextWindow: state.modelContextWindow ?? null,
          model: state.model ?? null,
          serviceTier: state.serviceTier ?? null,
          status: state.status,
          reason: state.reason,
          dueAt: state.arm?.dueAt ?? null,
          lastUsageAt: state.lastUsageAt,
          contentSeq: state.contentSeq,
          consumedContentSeq: state.consumedContentSeq,
        })),
    };
  }

  async history() {
    return (await this.bb.storage.kv.get(HISTORY_KEY)) ?? [];
  }

  async usage(selectedThreadId) {
    const result = [];
    const ids = selectedThreadId
      ? [selectedThreadId]
      : this.config.scope === "all"
        ? [
            ...new Set(
              (await this.history())
                .filter((row) => row.action === "context-boundary")
                .reverse()
                .map((row) => row.threadId),
            ),
          ].slice(0, 10)
        : this.config.ids;
    for (const threadId of ids) {
      if (!this.scoped(threadId)) continue;
      if (this.disposed) break;
      const rows = await this.bb.sdk.threads.events.list({
        threadId,
        types: ["thread/compacted", "thread/tokenUsage/updated"],
        order: "desc",
        limit: 100,
        signal: this.abort.signal,
      });
      if (!Array.isArray(rows)) throw new Error("Unknown events response");
      for (const boundary of rows.filter(
        (row) => row.type === "thread/compacted" && row.scope?.kind === "turn",
      )) {
        const samples = rows
          .filter(
            (row) =>
              row.type === "thread/tokenUsage/updated" &&
              row.scope?.kind === "turn" &&
              row.scope.turnId === boundary.scope.turnId,
          )
          .sort((a, b) => a.seq - b.seq)
          .map((row) => ({
            seq: row.seq,
            at: row.createdAt,
            usage: tokenCounts(row.data?.tokenUsage?.last),
          }));
        result.push({
          threadId,
          boundarySeq: boundary.seq,
          at: boundary.createdAt,
          turnUsageSamples: samples,
          note: "Usage from the same BB turn; may include more than one model request. Not a billing reconciliation.",
        });
      }
    }
    return result;
  }

  dispose() {
    this.disposed = true;
    this.permits.clear();
    this.abort.abort();
    for (const state of this.states.values()) invalidate(state, "disposed", { clearUsage: true });
  }
}
