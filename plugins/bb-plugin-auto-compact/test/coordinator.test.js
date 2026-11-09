import test from "node:test";
import assert from "node:assert/strict";
import { Coordinator } from "../src/coordinator.js";
import { MINUTE } from "../src/policy.js";
import {
  fixture,
  config,
  request,
  usage,
  event,
  deferred,
  BASE,
  THREAD,
  snapshot,
} from "./fixtures.js";

test("exactly one native submission occurs at the deadline, with a persisted reservation", async () => {
  const f = await fixture();
  await f.arm();
  const due = f.coordinator.state(THREAD).arm.dueAt;
  f.setTime(due - 1);
  await f.coordinator.submit(THREAD);
  assert.equal(f.calls.length, 0);
  // A premature submit invalidates that timer; fresh usage rearms it.
  f.events.get(THREAD).push(usage(3, due));
  f.setTime(due);
  await f.coordinator.onEvents(THREAD);
  f.faults.compact = async () => {
    assert.equal(f.store.get("attempt-ledger-v1").attemptsUsed, 1);
  };
  await f.due();
  await f.coordinator.submit(THREAD);
  assert.equal(f.calls.length, 1);
  assert.equal((await f.coordinator.status()).ledger.attemptsUsed, 1);
});

test("observe mode records the candidate and never spends or repeats", async () => {
  const f = await fixture({ config: { mode: "observe" } });
  await f.arm();
  await f.due();
  await f.coordinator.onLifecycle(THREAD, "idle");
  assert.equal(f.coordinator.state(THREAD).arm, null);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.coordinator.status()).ledger.attemptsUsed, 0);
  assert.equal(
    (await f.coordinator.history()).filter((row) => row.action === "would-compact").length,
    1,
  );
});

test("inactive or unselected threads are never inspected or submitted", async () => {
  for (const cfg of [{ mode: "off" }, { threadIds: "thr_other" }]) {
    const f = await fixture({ config: cfg });
    await f.coordinator.onEvents(THREAD);
    assert.equal(f.coordinator.states.has(THREAD), false);
    assert.equal(f.calls.length, 0);
  }
});

test("new messages, pending interactions and queued input cancel due operations", async () => {
  for (const mutate of [
    (f) => f.snapshots.get(THREAD).interactions.push({ id: "question" }),
    (f) => f.snapshots.get(THREAD).queued.push({ id: "queued" }),
    (f) => f.events.get(THREAD).push(request(3, f.now())),
  ]) {
    const f = await fixture();
    await f.arm();
    f.setTime(f.coordinator.state(THREAD).arm.dueAt);
    mutate(f);
    await f.coordinator.submit(THREAD);
    assert.equal(f.calls.length, 0);
  }
});

test("active event during an awaited snapshot invalidates the old decision", async () => {
  const f = await fixture();
  await f.arm();
  f.setTime(f.coordinator.state(THREAD).arm.dueAt);
  const blocked = deferred();
  f.faults.threadGet = () => blocked.promise;
  const submit = f.coordinator.submit(THREAD);
  await f.coordinator.onLifecycle(THREAD, "active");
  blocked.resolve();
  await submit;
  assert.equal(f.calls.length, 0);
  assert.equal((await f.coordinator.status()).ledger.attemptsUsed, 0);
});

test("late wake and clock reversal discard old timers without catching up", async () => {
  for (const target of [BASE - 1, BASE + 60 * MINUTE]) {
    const f = await fixture();
    await f.arm();
    f.setTime(target);
    await f.coordinator.tick();
    assert.equal(f.coordinator.state(THREAD).arm, null);
    assert.equal(f.calls.length, 0);
  }
});

test("a healthy heartbeat submits once without a real-time wait", async () => {
  const f = await fixture();
  await f.arm();
  const due = f.coordinator.state(THREAD).arm.dueAt;
  while (f.now() < due) {
    f.setTime(Math.min(due, f.now() + 15000));
    await f.coordinator.tick();
  }
  assert.equal(f.calls.length, 1);
});

test("changing effective model, tier or reasoning after arming prevents submission", async () => {
  for (const [key, value] of [
    ["model", "gpt-6-astra"],
    ["serviceTier", "fast"],
    ["reasoningLevel", "low"],
  ]) {
    const f = await fixture();
    await f.arm();
    f.snapshots.get(THREAD).execution[key] = value;
    await f.due();
    assert.equal(f.calls.length, 0);
  }
});

test("failed or ambiguous submissions consume the allowance and are never retried", async () => {
  const f = await fixture();
  await f.arm();
  f.faults.compact = async () => {
    throw new Error("request timed out");
  };
  await f.due();
  f.events.get(THREAD).push(request(3, f.now()), usage(4, f.now() + 1));
  f.setTime(f.now() + 10);
  await f.coordinator.onLifecycle(THREAD, "idle");
  await f.due();
  assert.equal(f.calls.length, 1);
  assert.equal((await f.coordinator.status()).ledger.attemptsUsed, 1);
  assert.ok((await f.coordinator.history()).some((row) => row.action === "failed-or-unknown"));
});

test("a failed durable reservation never invokes compaction", async () => {
  const f = await fixture();
  await f.arm();
  f.faults.set = (key) => {
    if (key === "attempt-ledger-v1") throw new Error("disk unavailable");
  };
  await assert.rejects(f.due(), /disk unavailable/);
  assert.equal(f.calls.length, 0);
});

test("active work arriving during reservation persistence prevents submission", async () => {
  const f = await fixture();
  await f.arm();
  const blocked = deferred();
  const entered = deferred();
  f.faults.set = (key) => {
    if (key === "attempt-ledger-v1") {
      entered.resolve();
      return blocked.promise;
    }
  };
  const submit = f.due();
  await entered.promise;
  await f.coordinator.onLifecycle(THREAD, "active");
  blocked.resolve();
  await submit;
  assert.equal(f.calls.length, 0);
  assert.equal((await f.coordinator.status()).ledger.attemptsUsed, 1);
});

test("reload preserves allowance and consumed content, and does not restore idle timers", async () => {
  const f = await fixture();
  await f.arm();
  await f.due();
  f.coordinator.dispose();
  const replacement = await Coordinator.create(f.bb, config, { now: () => f.now() + 1 });
  await replacement.start();
  assert.equal(replacement.state(THREAD).arm, null);
  assert.equal((await replacement.status()).ledger.attemptsUsed, 1);
  assert.equal((await replacement.status()).threads[0].consumedContentSeq, 1);
});

test("the attempt limit is global across concurrent selected threads", async () => {
  const second = "thr_test2";
  const f = await fixture({ config: { threadIds: `${THREAD},${second}` } });
  const other = snapshot();
  other.thread.id = second;
  f.snapshots.set(second, other);
  f.events.set(second, [request(), usage()]);
  await f.arm();
  await f.arm(second);
  f.setTime(Math.max(...[...f.coordinator.states.values()].map((state) => state.arm.dueAt)));
  await Promise.all([f.coordinator.submit(THREAD), f.coordinator.submit(second)]);
  assert.equal(f.calls.length, 1);
  assert.equal((await f.coordinator.status()).ledger.attemptsUsed, 1);
});

test("settings changes require fresh usage and cannot spend from an old timer", async () => {
  const f = await fixture();
  await f.arm();
  f.coordinator.update({ ...config, idleMinutes: 20 });
  assert.equal(f.coordinator.state(THREAD).arm, null);
  await f.coordinator.onEvents(THREAD);
  assert.equal(f.coordinator.state(THREAD).arm, null);
});

test("unknown SDK shapes and corrupt allowance fail closed", async () => {
  const f = await fixture();
  f.faults.events = () => ({ rows: [] });
  await assert.rejects(f.coordinator.onEvents(THREAD), /Unknown events response/);
  assert.equal(f.calls.length, 0);
  await assert.rejects(
    fixture({
      store: new Map([["attempt-ledger-v1", { version: 1, attemptsUsed: -1, consumed: {} }]]),
    }),
    /Invalid persisted allowance/,
  );
});

test("disposal while reads are in flight prevents any model call", async () => {
  const f = await fixture();
  await f.arm();
  const blocked = deferred();
  f.faults.threadGet = () => blocked.promise;
  const submit = f.due();
  f.coordinator.dispose();
  blocked.resolve();
  await submit;
  assert.equal(f.calls.length, 0);
  assert.equal(f.coordinator.abort.signal.aborted, true);
});

test("interactions and queues cannot rearm stale usage when they disappear", async () => {
  for (const reason of ["pending-interaction", "queued-work", "failed"]) {
    const f = await fixture();
    await f.arm();
    await f.coordinator.onLifecycle(THREAD, reason);
    f.setTime(f.now() + 30 * MINUTE);
    await f.coordinator.onEvents(THREAD);
    assert.equal(f.coordinator.state(THREAD).arm, null);
    assert.equal(f.calls.length, 0);
  }
});

test("invalid configuration updates disable the old compacting policy", async () => {
  const f = await fixture();
  await f.arm();
  assert.throws(() => f.coordinator.update({ ...config, threadIds: "*" }));
  assert.equal(f.coordinator.config.mode, "off");
  assert.equal(f.coordinator.state(THREAD).arm, null);
});

test("a context-boundary checkpoint survives reload without consuming an attempt", async () => {
  const f = await fixture();
  await f.arm();
  f.events.get(THREAD).push(event("thread/compacted", 3, f.now()));
  await f.coordinator.onEvents(THREAD);
  assert.equal((await f.coordinator.status()).ledger.attemptsUsed, 0);
  assert.equal((await f.coordinator.status()).ledger.consumed[THREAD], 1);
});

test("read-only usage inspection associates samples by turn and exports no prompt content", async () => {
  const f = await fixture();
  const boundary = event("thread/compacted", 3, BASE + 20);
  f.events.get(THREAD).push(boundary);
  const result = await f.coordinator.usage();
  assert.equal(result.length, 1);
  assert.equal(result[0].turnUsageSamples.length, 1);
  assert.equal(result[0].turnUsageSamples[0].usage.cachedInputTokens, 349000);
  assert.equal(JSON.stringify(result).includes("Continue"), false);
  assert.equal(f.calls.length, 0);
  boundary.scope.turnId = "different-turn";
  assert.equal((await f.coordinator.usage())[0].turnUsageSamples.length, 0);
});

test("admission refuses joining an active turn and replay without a live permit", async () => {
  const f = await fixture();
  await f.arm();
  f.faults.admission = { attempt: "join-turn" };
  await f.due();
  assert.equal(f.calls.length, 0);
  assert.equal(
    f.coordinator.admit({
      originPluginId: "auto-compact",
      thread: f.snapshots.get(THREAD).thread,
      attempt: "start-turn",
      queuedMessages: [],
    }).action,
    "reject",
  );
});

test("an unexpectedly queued native submission is removed instead of left for a cold retry", async () => {
  const f = await fixture();
  await f.arm();
  f.faults.outcome = { delivery: "queued", queuedMessage: { id: "our-message" } };
  f.faults.compact = () => {
    f.snapshots.get(THREAD).queued.push({ id: "our-message" }, { id: "unrelated-message" });
  };
  await f.due();
  assert.deepEqual(f.snapshots.get(THREAD).queued, [{ id: "unrelated-message" }]);
  assert.ok(
    (await f.coordinator.history()).some((row) => row.action === "deferred-submission-cancelled"),
  );
});
