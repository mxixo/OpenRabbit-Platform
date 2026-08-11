import { describe, expect, it } from "vitest";
import { InMemoryAuditStore } from "../../src/core/in-memory-audit-store.js";

describe("InMemoryAuditStore", () => {
  it("keeps records scoped to an org and supports filters", () => {
    const store = new InMemoryAuditStore();
    store.append({
      id: "audit-1",
      orgId: "org-1",
      kind: "task_requested",
      workerId: "worker-1",
      taskId: "task-1"
    });
    store.append({
      id: "audit-2",
      orgId: "org-2",
      kind: "task_completed",
      workerId: "worker-2",
      taskId: "task-2"
    });

    expect(store.list("org-1")).toHaveLength(1);
    expect(store.list("org-1", { taskId: "task-2" })).toHaveLength(0);
    expect(store.list("org-2", { kind: "task_completed" })).toHaveLength(1);
  });

  it("clones metadata and rejects duplicate ids", () => {
    const store = new InMemoryAuditStore();
    const created = store.append({
      id: "audit-1",
      orgId: "org-1",
      kind: "approval_requested",
      approvalId: "approval-1",
      metadata: { policyId: "policy-1" }
    });

    created.metadata!.policyId = "changed";
    expect(store.list("org-1")[0].metadata?.policyId).toBe("policy-1");
    expect(() =>
      store.append({ id: "audit-1", orgId: "org-1", kind: "task_requested" })
    ).toThrow("already exists");
  });
});
