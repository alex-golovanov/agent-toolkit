import { Coordinator } from "./src/coordinator.js";
import { HEARTBEAT_MS, configFrom } from "./src/policy.js";

function integerRange(low, high) {
  return {
    "~standard": {
      version: 1,
      vendor: "auto-compact",
      validate(value) {
        return Number.isInteger(value) && value >= low && value <= high
          ? { value }
          : { issues: [{ message: `Use an integer from ${low} to ${high}` }] };
      },
    },
  };
}

const threadScopeSchema = {
  "~standard": {
    version: 1,
    vendor: "auto-compact",
    validate(value) {
      try {
        configFrom({ threadIds: value });
        return { value };
      } catch (error) {
        return { issues: [{ message: error.message }] };
      }
    },
  },
};

const retryConsentContract = {
  "provider-retry.v1.consent": {
    input: {
      "~standard": {
        version: 1,
        vendor: "auto-compact",
        validate(value) {
          return value &&
            typeof value.threadId === "string" &&
            typeof value.requestId === "string" &&
            ["Rate limited", "Provider overloaded", "Provider unavailable"].includes(
              value.reason,
            ) &&
            Number.isSafeInteger(value.sendAt) &&
            value.sendAt >= 0
            ? { value }
            : { issues: [{ message: "Invalid retry consent request" }] };
        },
      },
    },
    output: {
      "~standard": {
        version: 1,
        vendor: "auto-compact",
        validate(value) {
          return value?.kind === "decline" &&
            typeof value.reason === "string" &&
            value.reason.length > 0
            ? { value }
            : { issues: [{ message: "Expected a retry refusal" }] };
        },
      },
    },
  },
};

export function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
  });
}

export default async function plugin(bb) {
  const settings = bb.settings.define({
    mode: { type: "select", label: "Mode", options: ["off", "observe", "compact"], default: "off" },
    scope: {
      type: "select",
      label: "Conversation scope",
      options: ["selected", "all"],
      default: "selected",
    },
    threadIds: {
      type: "string",
      label: "Selected BB thread IDs (comma-separated)",
      default: "",
      experimental_schema: threadScopeSchema,
    },
    contextPercent: {
      type: "number",
      label: "Compact above context percentage",
      default: 70,
      experimental_schema: integerRange(1, 99),
    },
    idleMinutes: {
      type: "number",
      label: "Idle cutoff in minutes (estimated policy)",
      default: 15,
      experimental_schema: integerRange(1, 240),
    },
    maxAttempts: {
      type: "number",
      label: "Lifetime submission allowance (0 = ongoing, no limit)",
      default: 1,
      experimental_schema: integerRange(0, 1000000),
    },
    model: {
      type: "select",
      label: "Model filter (all = every Codex model; keep each chat's speed)",
      options: ["all", "gpt-6.1-sol", "gpt-6-astra"],
      default: "all",
    },
  });
  const coordinator = await Coordinator.create(bb, await settings.get());
  bb.onDispose(() => coordinator.dispose());
  bb.experimental_hooks.on("message.dispatch", (context) => coordinator.admit(context));
  bb.rpc.register(retryConsentContract, {
    "provider-retry.v1.consent": () => ({
      kind: "decline",
      reason: "Auto Compact does not retry failed or ambiguous compaction submissions.",
    }),
  });
  settings.onChange((next) => coordinator.update(next));
  bb.events.on("experimental_thread.events", ({ thread }) => coordinator.onEvents(thread.id));
  for (const kind of ["active", "idle", "failed", "archived", "deleted"]) {
    bb.events.on(`thread.${kind}`, ({ thread }) => coordinator.onLifecycle(thread.id, kind));
  }
  bb.events.on("interaction.pending", ({ thread }) =>
    coordinator.onLifecycle(thread.id, "pending-interaction"),
  );
  bb.events.on("message.queued", ({ entry }) =>
    coordinator.onLifecycle(entry.threadId, "queued-work"),
  );
  bb.background.service("idle-cutoff", {
    async start(signal) {
      const stop = () => coordinator.dispose();
      if (signal.aborted) {
        stop();
        return;
      }
      signal.addEventListener("abort", stop, { once: true });
      try {
        await coordinator.start();
        while (!signal.aborted) {
          await sleep(HEARTBEAT_MS, signal);
          if (!signal.aborted) await coordinator.tick();
        }
      } finally {
        signal.removeEventListener("abort", stop);
      }
    },
  });
  bb.cli.register({
    name: "auto-compact",
    summary: "Inspect preventive Codex compaction timers and submission allowance",
    commands: [
      {
        name: "status",
        summary: "Read settings, per-thread timers and submission accounting",
        usage: "bb auto-compact status [--thread ID] [--json]",
      },
      {
        name: "history",
        summary: "Read the latest 50 decisions without conversation content",
        usage: "bb auto-compact history [--thread ID] [--json]",
      },
      {
        name: "usage",
        summary: "Read native usage samples from recent compaction turns",
        usage: "bb auto-compact usage [--thread ID] [--json]",
      },
    ],
    async run(argv) {
      const [command = "status", ...flags] = argv;
      let threadId;
      let validFlags = true;
      for (let i = 0; i < flags.length; i += 1) {
        if (flags[i] === "--json") continue;
        if (flags[i] === "--thread" && !threadId && /^thr_[a-z0-9]+$/.test(flags[i + 1] ?? "")) {
          threadId = flags[++i];
        } else validFlags = false;
      }
      if (!["status", "history", "usage"].includes(command) || !validFlags) {
        return {
          exitCode: 1,
          stderr: "Usage: bb auto-compact status|history|usage [--thread ID] [--json]",
        };
      }
      const value =
        command === "status"
          ? await coordinator.status(threadId)
          : command === "history"
            ? (await coordinator.history()).filter((row) => !threadId || row.threadId === threadId)
            : await coordinator.usage(threadId);
      return { exitCode: 0, stdout: JSON.stringify(value, null, 2) };
    },
  });
}
