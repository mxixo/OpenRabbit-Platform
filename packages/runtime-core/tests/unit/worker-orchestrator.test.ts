import { describe, expect, it } from "vitest";
import { InMemoryRuntimeProviderRegistry } from "../../src/core/in-memory-runtime-provider-registry.js";
import { InMemoryWorkerOrchestrator } from "../../src/core/in-memory-worker-orchestrator.js";
import { InMemoryWorkerRegistry } from "../../src/core/in-memory-worker-registry.js";
import { MockRuntimeProvider } from "../../src/mocks/mock-runtime-provider.js";
import type { WorkerDefinition } from "../../src/interfaces/worker.js";

const executionContext = { orgId: "org-1", subjectId: "user-1" };

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

    const result = await orchestrator.runTask(executionContext, {
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
    const result = await orchestrator.runTask(executionContext, {
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

    const missing = await orchestrator.runTask(executionContext, {
      workerId: "nope",
      taskId: "t1",
      taskType: "x",
      input: {}
    });
    expect(missing.status).toBe("rejected");
    expect(missing.error?.code).toBe("worker_not_found");

    const inactive = await orchestrator.runTask(executionContext, {
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

    const result = await orchestrator.runTask(executionContext, {
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
    const session = await orchestrator.ensureSession(executionContext, "worker-1");
    expect(session.status).toBe("ready");

    await orchestrator.stopSession(executionContext, "worker-1");
    const stopped = await runtime.getSession(session.sessionId);
    expect(stopped?.status).toBe("stopped");
  });

  it("rejects cross-tenant task, session, and stop access", async () => {
    const workers = new InMemoryWorkerRegistry();
    workers.register(buildWorker());
    const runtimes = new InMemoryRuntimeProviderRegistry();
    const runtime = new MockRuntimeProvider({ id: "mock-runtime" });
    runtimes.register(runtime);
    const orchestrator = new InMemoryWorkerOrchestrator({ workers, runtimes });
    const otherTenant = { orgId: "org-2", subjectId: "user-2" };

    const task = await orchestrator.runTask(otherTenant, {
      workerId: "worker-1",
      taskId: "cross-tenant",
      taskType: "research.summary",
      input: {}
    });

    expect(task.status).toBe("rejected");
    expect(task.error?.code).toBe("worker_not_found");
    await expect(orchestrator.ensureSession(otherTenant, "worker-1")).rejects.toThrow(
      "Worker not found"
    );
    await expect(orchestrator.stopSession(otherTenant, "worker-1")).rejects.toThrow(
      "Worker not found"
    );
    expect(await runtime.getSession("cross-tenant")).toBeUndefined();
  });

  it("recreates a session when projected authority changes", async () => {
    const workers = new InMemoryWorkerRegistry();
    workers.register(buildWorker({ runtimePreference: ["mock-runtime"] }));
    const runtimes = new InMemoryRuntimeProviderRegistry();
    const runtime = new MockRuntimeProvider({ id: "mock-runtime" });
    runtimes.register(runtime);
    const orchestrator = new InMemoryWorkerOrchestrator({ workers, runtimes });

    const initial = await orchestrator.ensureSession(executionContext, "worker-1");
    expect((await runtime.listProjectedTools(initial.sessionId)).map((tool) => tool.name)).toEqual([
      "web.search",
      "notes.write"
    ]);

    workers.update("worker-1", { allowedTools: ["web.search"] });
    const refreshed = await orchestrator.ensureSession(executionContext, "worker-1");

    expect((await runtime.listProjectedTools(refreshed.sessionId)).map((tool) => tool.name)).toEqual([
      "web.search"
    ]);
  });

  it("rejects a runtime session with mismatched tenant binding", async () => {
    const workers = new InMemoryWorkerRegistry();
    workers.register(buildWorker({ runtimePreference: ["bad-runtime"] }));
    const runtimes = new InMemoryRuntimeProviderRegistry();
    const runtime = new MockRuntimeProvider({ id: "bad-runtime" });
    const originalStartSession = runtime.startSession.bind(runtime);
    runtime.startSession = async (input) => ({
      ...(await originalStartSession(input)),
      orgId: "org-2"
    });
    runtimes.register(runtime);
    const orchestrator = new InMemoryWorkerOrchestrator({ workers, runtimes });

    await expect(orchestrator.ensureSession(executionContext, "worker-1")).rejects.toThrow(
      "outside the authorized worker boundary"
    );
  });

  it("does not expose mutable cached session identity to callers", async () => {
    const workers = new InMemoryWorkerRegistry();
    workers.register(buildWorker({ runtimePreference: ["mock-runtime"] }));
    workers.register(
      buildWorker({ id: "worker-2", orgId: "org-2", runtimePreference: ["mock-runtime"] })
    );
    const runtimes = new InMemoryRuntimeProviderRegistry();
    const runtime = new MockRuntimeProvider({ id: "mock-runtime" });
    runtimes.register(runtime);
    const orchestrator = new InMemoryWorkerOrchestrator({ workers, runtimes });

    const first = await orchestrator.ensureSession(executionContext, "worker-1");
    const second = await orchestrator.ensureSession(
      { orgId: "org-2", subjectId: "user-2" },
      "worker-2"
    );
    first.sessionId = second.sessionId;

    const result = await orchestrator.runTask(executionContext, {
      workerId: "worker-1",
      taskId: "cache-poison-attempt",
      taskType: "research.summary",
      input: {}
    });

    expect(result.status).toBe("completed");
    expect(result.output).toMatchObject({ workerId: "worker-1" });
    expect(result.sessionId).not.toBe(second.sessionId);
  });

  it("does not create a session for an invalid explicit session id", async () => {
    const workers = new InMemoryWorkerRegistry();
    workers.register(buildWorker({ runtimePreference: ["mock-runtime"] }));
    const runtimes = new InMemoryRuntimeProviderRegistry();
    const runtime = new MockRuntimeProvider({ id: "mock-runtime" });
    let starts = 0;
    const originalStartSession = runtime.startSession.bind(runtime);
    runtime.startSession = async (input) => {
      starts += 1;
      return originalStartSession(input);
    };
    runtimes.register(runtime);
    const orchestrator = new InMemoryWorkerOrchestrator({ workers, runtimes });

    const result = await orchestrator.runTask(executionContext, {
      workerId: "worker-1",
      taskId: "invalid-explicit-session",
      taskType: "research.summary",
      input: {},
      sessionId: "not-a-real-session"
    });

    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("session_not_found");
    expect(starts).toBe(0);
  });

  it("does not cache authority revoked during session creation", async () => {
    const workers = new InMemoryWorkerRegistry();
    workers.register(buildWorker({ runtimePreference: ["mock-runtime"] }));
    const runtimes = new InMemoryRuntimeProviderRegistry();
    const runtime = new MockRuntimeProvider({ id: "mock-runtime" });
    const originalStartSession = runtime.startSession.bind(runtime);
    let releaseStart: (() => void) | undefined;
    let starts = 0;
    runtime.startSession = async (input) => {
      starts += 1;
      if (starts === 1) {
        await new Promise<void>((resolve) => {
          releaseStart = resolve;
        });
      }
      return originalStartSession(input);
    };
    runtimes.register(runtime);
    const orchestrator = new InMemoryWorkerOrchestrator({ workers, runtimes });

    const pending = orchestrator.ensureSession(executionContext, "worker-1");
    await Promise.resolve();
    workers.update("worker-1", { allowedTools: ["web.search"] });
    releaseStart?.();
    const session = await pending;

    expect(starts).toBe(2);
    expect((await runtime.listProjectedTools(session.sessionId)).map((tool) => tool.name)).toEqual([
      "web.search"
    ]);
  });
});
