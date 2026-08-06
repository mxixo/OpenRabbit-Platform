import { describe, expect, it } from "vitest";
import { InMemoryWorkerRegistry } from "../../src/core/in-memory-worker-registry.js";
import {
  materializeWorkerPreset,
  WorkerDefinition,
  WorkerPreset
} from "../../src/interfaces/worker.js";

const baseWorker: WorkerDefinition = {
  id: "worker-ea-1",
  orgId: "org-1",
  role: "executive_assistant",
  displayName: "Executive Assistant",
  mission: "Coordinate the founder calendar and follow-ups",
  runtimePreference: ["openclaw", "mock-runtime"],
  allowedCapabilities: ["calendar", "email"],
  allowedTools: ["calendar.list", "email.draft"],
  memoryScope: "worker",
  approvalPolicy: { policyId: "default-worker", requiresApproval: false },
  status: "active",
  tags: ["core"]
};

describe("InMemoryWorkerRegistry", () => {
  it("registers, filters, and updates workers", () => {
    const registry = new InMemoryWorkerRegistry();
    registry.register(baseWorker);
    registry.register({
      ...baseWorker,
      id: "worker-acq-1",
      role: "acquisitions_analyst",
      displayName: "Acquisitions Analyst",
      allowedCapabilities: ["real-estate"],
      allowedTools: ["deal.underwrite"]
    });

    expect(registry.list({ orgId: "org-1" })).toHaveLength(2);
    expect(registry.list({ role: "executive_assistant" })).toHaveLength(1);

    const updated = registry.update("worker-ea-1", { status: "suspended" });
    expect(updated.status).toBe("suspended");
    expect(registry.list({ status: "active" })).toHaveLength(1);
  });

  it("validates required worker fields", () => {
    const registry = new InMemoryWorkerRegistry();
    expect(() =>
      registry.register({
        ...baseWorker,
        runtimePreference: []
      })
    ).toThrow("runtimePreference");

    expect(() =>
      registry.register({
        ...baseWorker,
        id: "worker-2",
        approvalPolicy: { policyId: "" }
      })
    ).toThrow("approvalPolicy.policyId");
  });

  it("throws when updating unknown workers", () => {
    const registry = new InMemoryWorkerRegistry();
    expect(() => registry.update("missing", { status: "active" })).toThrow("Worker not found");
  });
});

describe("materializeWorkerPreset", () => {
  it("creates an org-scoped worker from a preset", () => {
    const preset: WorkerPreset = {
      id: "preset-acquisitions",
      role: "acquisitions_analyst",
      displayName: "Acquisitions Analyst",
      mission: "Source and underwrite deals",
      runtimePreference: ["openclaw"],
      allowedCapabilities: ["real-estate"],
      allowedTools: ["deal.underwrite"],
      memoryScope: "org",
      approvalPolicy: { policyId: "acq-approvals", requiresApproval: true },
      tags: ["pack:real-estate"]
    };

    const worker = materializeWorkerPreset(preset, {
      id: "worker-acq-9",
      orgId: "org-9",
      displayName: "Acq Analyst — West"
    });

    expect(worker.orgId).toBe("org-9");
    expect(worker.displayName).toBe("Acq Analyst — West");
    expect(worker.role).toBe("acquisitions_analyst");
    expect(worker.runtimePreference).toEqual(["openclaw"]);
    expect(worker.allowedTools).toEqual(["deal.underwrite"]);
    expect(worker.status).toBe("active");
  });
});
