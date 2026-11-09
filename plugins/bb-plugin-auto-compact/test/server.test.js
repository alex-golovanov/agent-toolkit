import test from "node:test";
import assert from "node:assert/strict";
import plugin, { sleep } from "../server.js";
import { fixture } from "./fixtures.js";

test("factory registers inactive defaults, validated settings and read-only CLI", async () => {
  const f = await fixture();
  const events = new Map();
  const services = new Map();
  let cli, descriptors, dispose, changed, hook, consent;
  const bb = {
    ...f.bb,
    settings: {
      define(value) {
        descriptors = value;
        return {
          get: async () =>
            Object.fromEntries(Object.entries(value).map(([key, field]) => [key, field.default])),
          onChange(fn) {
            changed = fn;
          },
        };
      },
    },
    events: {
      on(name, callback) {
        events.set(name, callback);
      },
    },
    background: {
      service(name, value) {
        services.set(name, value);
      },
    },
    cli: {
      register(value) {
        cli = value;
      },
    },
    experimental_hooks: {
      on(name, callback) {
        assert.equal(name, "message.dispatch");
        hook = callback;
      },
    },
    rpc: {
      register(contract, handlers) {
        consent = handlers["provider-retry.v1.consent"];
        const schema = contract["provider-retry.v1.consent"].output;
        assert.equal(schema["~standard"].validate(consent()).value.kind, "decline");
      },
    },
    onDispose(fn) {
      dispose = fn;
    },
  };
  await plugin(bb);
  assert.equal(descriptors.mode.default, "off");
  assert.equal(descriptors.contextPercent.default, 70);
  assert.equal(descriptors.idleMinutes.default, 15);
  assert.equal(
    descriptors.idleMinutes.experimental_schema["~standard"].validate(0).issues.length,
    1,
  );
  assert.equal(
    descriptors.threadIds.experimental_schema["~standard"].validate("*").issues.length,
    1,
  );
  assert.ok(events.has("experimental_thread.events"));
  assert.ok(events.has("message.queued"));
  assert.equal(consent().kind, "decline");
  assert.equal(hook({ originPluginId: "other-plugin" }).action, "proceed");
  assert.equal(
    hook({ originPluginId: "auto-compact", thread: { id: "thr_test1" } }).action,
    "reject",
  );
  assert.equal(JSON.parse((await cli.run(["status", "--json"])).stdout).settings.mode, "off");
  assert.equal((await cli.run(["compact-now"])).exitCode, 1);
  assert.equal((await cli.run(["status", "--unknown"])).exitCode, 1);
  changed({ mode: "observe" });
  assert.equal(JSON.parse((await cli.run(["status"])).stdout).settings.mode, "observe");
  const controller = new AbortController();
  controller.abort();
  await services.get("idle-cutoff").start(controller.signal);
  dispose();
  assert.equal(f.calls.length, 0);
});

test("abort cancels the heartbeat wait promptly", async () => {
  const controller = new AbortController();
  const waiting = sleep(60_000, controller.signal);
  controller.abort();
  await waiting;
  await sleep(60_000, controller.signal);
});
