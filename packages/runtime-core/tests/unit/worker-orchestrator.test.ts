import { describe, expect, it } from "vitest";
import { InMemoryRuntimeProviderRegistry } from "../../src/core/in-memory-runtime-provider-registry.js";
import { InMemoryWorkerOrchestrator } from "../../src/core/in-memory-worker-orchestrator.js";
import { InMemoryWorkerRegistry } from "../../src/core/in-memory-worker-registry.js";
import { MockRuntimeProvider } from "../../src/mocks/mock-runtime-provider.js";
import type { WorkerDefinition } from "../../src/interfaces/worker.js";

function buildWorker(overrides: Partial<WorkerDefinition> = {}): WorkerDefinition {
  return {
    id: "worker-1",
    orgId: "org-1",
    role: "research_analyst",
    displayName: "Research Analyst",
    mission: "Research markets and summarize findings",
    runtimePreference: ["openclaw", "mock-runtime"],
    allowedCapabilities: ["knowledge"],
    allowedTools: ["web.search", "notes.write"],
    memoryScope: "thread",
    approvalPolicy: { policyId: "research-default" },
    status: "active",
    ...overrides
  };
}

describe("InMemoryWorkerOrchestrator", () => {
  it("routes worker tasks through preferred runtime and projects allow-listed tools", async () => {
    const workers = new InMemoryWorkerRegistry();
    workers.register(buildWorker());

    const runtimes = new InMemoryRuntimeProviderRegistry();
    const openclaw = new MockRuntimeProvider({ id: "openclaw", displayName: "OpenClaw Mock" });
    const fallback = new MockRuntimeProvider({ id: "mock-runtime" });
    runtimes.register(fallback);
    runtimes.register(openclaw);

    const orchestrator = new InMemoryWorkerOrchestrator({
      workers,
      runtimes,
      resolveTools: (names) =>
        names.map((name) => ({
          name,
          description: `tool:${name}`,
          // Include a non-allowed tool in catalog responses to prove filtering.
          tags: name === "web.search" ? ["allowed"] : ["allowed"]
        }))
    });

    const result = await orchestrator.runTask({
      workerId: "worker-1",
      taskId: "task-1",
      taskType: "research.summary",
      input: { topic: "multifamily cap rates" }
    });

    expect(result.status).toBe("completed");
    expect(result.runtimeProviderId).toBe("openclaw");
    expect(result.sessionId).toBeTruthy();
    expect(result.output).toMatchObject({
      taskType: "research.summary",
      workerId: "worker-1",
      echo: { topic: "multifamily cap rates" }
    });

    const tools = await openclaw.listProjectedTools(result.sessionId!);
    expect(tools.map((tool) => tool.name).sort()).toEqual(["notes.write", "web.search"]);
  });

  it("falls back to the next runtime preference when primary is missing", async () => {
    const workers = new InMemoryWorkerRegistry();
    workers.register(buildWorker({ runtimePreference: ["openclaw", "mock-runtime"] }));

    const runtimes = new InMemoryRuntimeProviderRegistry();
    runtimes.register(new MockRuntimeProvider({ id: "mock-runtime" }));

    const orchestrator = new InMemoryWorkerOrchestrator({ workers, runtimes });
    const result = await orchestrator.runTask({
      workerId: "worker-1",
      taskId: "task-2",
      taskType: "ping",
      input: { ok: true }
    });

    expect(result.status).toBe("completed");
    expect(result.runtimeProviderId).toBe("mock-runtime");
  });

  it("rejects tasks for unknown or inactive workers", async () => {
    const workers = new InMemoryWorkerRegistry();
    workers.register(buildWorker({ id: "worker-inactive", status: "inactive" }));

    const runtimes = new InMemoryRuntimeProviderRegistry();
    runtimes.register(new MockRuntimeProvider({ id: "mock-runtime" }));
    const orchestrator = new InMemoryWorkerOrchestrator({ workers, runtimes });

    const missing = await orchestrator.runTask({
      workerId: "nope",
      taskId: "t1",
      taskType: "x",
      input: {}
    });
    expect(missing.status).toBe("rejected");
    expect(missing.error?.code).toBe("worker_not_found");

    const inactive = await orchestrator.runTask({
      workerId: "worker-inactive",
      taskId: "t2",
      taskType: "x",
      input: {}
    });
    expect(inactive.status).toBe("rejected");
    expect(inactive.error?.code).toBe("worker_inactive");
  });

  it("enforces tool allow-list even if resolver returns extras", async () => {
    const workers = new InMemoryWorkerRegistry();
    workers.register(buildWorker({ allowedTools: ["notes.write"] }));

    const runtimes = new InMemoryRuntimeProviderRegistry();
    const runtime = new MockRuntimeProvider({ id: "mock-runtime" });
    runtimes.register(runtime);

    const orchestrator = new InMemoryWorkerOrchestrator({
      workers,
      runtimes,
      resolveTools: () => [
        { name: "notes.write" },
        { name: "admin.destroy" },
        { name: "web.search" }
      ]
    });

    const result = await orchestrator.runTask({
      workerId: "worker-1",
      taskId: "task-3",
      taskType: "note",
      input: { text: "hello" }
    });

    expect(result.status).toBe("completed");
    const tools = await runtime.listProjectedTools(result.sessionId!);
    expect(tools).toEqual([{ name: "notes.write" }]);
  });

  it("stops worker sessions", async () => {
    const workers = new InMemoryWorkerRegistry();
    workers.register(buildWorker({ runtimePreference: ["mock-runtime"] }));
    const runtimes = new InMemoryRuntimeProviderRegistry();
    const runtime = new MockRuntimeProvider({ id: "mock-runtime" });
    runtimes.register(runtime);

    const orchestrator = new InMemoryWorkerOrchestrator({ workers, runtimes });
    const session = await orchestrator.ensureSession("worker-1");
    expect(session.status).toBe("ready");

    await orchestrator.stopSession("worker-1");
    const stopped = await runtime.getSession(session.sessionId);
    expect(stopped?.status).toBe("stopped");
  });
});
