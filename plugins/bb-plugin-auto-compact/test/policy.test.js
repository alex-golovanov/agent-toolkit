import test from "node:test";
import assert from "node:assert/strict";
import {
  configFrom,
  isMaintenance,
  createState,
  reduceEvents,
  armState,
  eligibility,
  MINUTE,
} from "../src/policy.js";
import { config, snapshot, request, usage, event, BASE, THREAD } from "./fixtures.js";

test("off is the default and scope/model/numeric values are validated", () => {
  assert.equal(configFrom({}).mode, "off");
  assert.deepEqual(configFrom({ threadIds: "thr_a, thr_a thr_b" }).ids, ["thr_a", "thr_b"]);
  for (const values of [
    { mode: "yes" },
    { scope: "everything" },
    { threadIds: "*" },
    { idleMinutes: 0 },
    { contextPercent: 100 },
    { maxAttempts: 1.5 },
    { maxAttempts: -1 },
    { model: "other" },
  ]) {
    assert.throws(() => configFrom(values));
  }
  assert.equal(configFrom({ scope: "all", maxAttempts: 0 }).maxAttempts, 0);
});

test("only structured builtin maintenance commands are recognized", () => {
  assert.equal(isMaintenance([{ type: "text", text: "/compact", mentions: [] }]), false);
  assert.equal(
    isMaintenance([
      {
        type: "text",
        mentions: [
          {
            resource: {
              kind: "command",
              source: "command",
              origin: "builtin",
              trigger: "/",
              name: "compact",
            },
          },
        ],
      },
    ]),
    true,
  );
});

test("context must be strictly above 70%, with exact finite usage", () => {
  const value = snapshot();
  value.usage.usedTokens = 350000;
  assert.equal(eligibility(value, config), "below-context-threshold");
  value.usage.usedTokens += 1;
  assert.equal(eligibility(value, config), null);
  value.usage.estimated = true;
  assert.equal(eligibility(value, config), "unknown-context");
  value.usage = { usedTokens: NaN, modelContextWindow: 0, estimated: false };
  assert.equal(eligibility(value, config), "unknown-context");
});

test("pending work, hidden threads, offline hosts and model filters fail closed", () => {
  const mutations = [
    [(s) => (s.thread.status = "active"), "not-idle"],
    [(s) => (s.thread.runtime.displayStatus = "awaiting-input"), "not-idle"],
    [(s) => (s.thread.visibility = "hidden"), "not-visible"],
    [(s) => (s.thread.activeBackgroundAgentCount = 1), "background-work"],
    [(s) => (s.environment.status = "destroyed"), "environment-unavailable"],
    [(s) => (s.host.status = "disconnected"), "host-unavailable"],
    [(s) => (s.interactions = [{}]), "pending-interaction"],
    [(s) => (s.queued = [{}]), "queued-work"],
    [(s) => (s.queued = {}), "unknown-pending-work"],
    [(s) => (s.execution.model = "gpt-6-astra"), "model-filtered"],
    [(s) => (s.execution = null), "unknown-execution"],
    [(s) => (s.execution.serviceTier = {}), "unknown-execution"],
  ];
  for (const [mutate, expected] of mutations) {
    const value = snapshot();
    mutate(value);
    assert.equal(eligibility(value, config), expected);
  }
});

test("old usage never arms on load; fresh usage plus content does", () => {
  const state = createState(THREAD);
  reduceEvents(state, [request(), usage()], BASE + 2);
  armState(state, snapshot(), config, BASE + 10);
  assert.equal(state.arm, null);
  reduceEvents(state, [usage(3, BASE + 11)], BASE + 2);
  armState(state, snapshot(), config, BASE + 12);
  assert.equal(state.arm.dueAt, BASE + 12 + 15 * MINUTE);
});

test("new model usage resets the idle deadline; unrelated events do not", () => {
  const state = createState(THREAD);
  reduceEvents(state, [request(), usage()], BASE);
  armState(state, snapshot(), config, BASE + 10);
  const first = state.arm.dueAt;
  reduceEvents(state, [event("thread/name/updated", 3, BASE + MINUTE)], BASE);
  armState(state, snapshot(), config, BASE + MINUTE);
  assert.equal(state.arm.dueAt, first);
  reduceEvents(state, [usage(4, BASE + 2 * MINUTE)], BASE);
  armState(state, snapshot(), config, BASE + 2 * MINUTE);
  assert.equal(state.arm.dueAt, BASE + 17 * MINUTE);
});

test("new input cancels and requires a later usage record", () => {
  const state = createState(THREAD);
  reduceEvents(state, [request(), usage()], BASE);
  armState(state, snapshot(), config, BASE + 10);
  reduceEvents(state, [request(3, BASE + MINUTE)], BASE);
  armState(state, snapshot(), config, BASE + MINUTE);
  assert.equal(state.arm, null);
  reduceEvents(state, [usage(4, BASE + MINUTE + 10)], BASE);
  armState(state, snapshot(), config, BASE + MINUTE + 10);
  assert.ok(state.arm);
});

test("compaction/clear consume a generation even when usage follows the boundary", () => {
  for (const kind of ["thread/compacted", "thread/context/cleared"]) {
    const state = createState(THREAD);
    reduceEvents(state, [request(), usage(), event(kind, 3, BASE + 10), usage(4, BASE + 11)], BASE);
    armState(state, snapshot(), config, BASE + 12);
    assert.equal(state.arm, null);
    reduceEvents(state, [request(5, BASE + 20), usage(6, BASE + 21)], BASE);
    armState(state, snapshot(), config, BASE + 22);
    assert.ok(state.arm);
  }
});

test("duplicate/out-of-order events do not regress usage", () => {
  const state = createState(THREAD);
  reduceEvents(state, [usage(2, BASE + 2), request(1)], BASE);
  reduceEvents(state, [usage(2, BASE + 99)], BASE);
  assert.equal(state.lastUsageAt, BASE + 2);
});

test("all-model policy accepts Sol, Astra, other Codex models and each conversation's speed", () => {
  const all = configFrom({ model: "all" });
  assert.equal(configFrom({}).model, "all");
  assert.equal(configFrom({ model: "gpt-6-astra" }).model, "gpt-6-astra");
  for (const model of ["gpt-6.1-sol", "gpt-6-astra", "other-configured-codex-model"]) {
    for (const serviceTier of ["default", "fast", "flex", null]) {
      const current = snapshot();
      current.execution = { model, serviceTier, reasoningLevel: "high" };
      assert.equal(eligibility(current, all), null);
    }
  }
  const unknown = snapshot();
  unknown.execution.model = "";
  assert.equal(eligibility(unknown, all), "unknown-execution");
  unknown.execution = { model: "gpt-6-astra", reasoningLevel: {} };
  assert.equal(eligibility(unknown, all), "unknown-execution");
});
