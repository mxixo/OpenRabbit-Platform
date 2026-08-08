import { describe, expect, it } from "vitest";
import { InMemoryApprovalRequestStore } from "../../src/core/in-memory-approval-request-store.js";

describe("InMemoryApprovalRequestStore", () => {
  it("creates, lists, and approves a request", () => {
    const store = new InMemoryApprovalRequestStore();
    const created = store.create({
      id: "approval-1",
      orgId: "org-1",
      workerId: "worker-1",
      taskId: "task-1",
      taskType: "crm.write",
      input: { email: "investor@example.com" },
      policyId: "policy-1"
    });

    expect(created.status).toBe("pending");
    expect(store.list("org-1", { status: "pending" })).toHaveLength(1);

    const approved = store.approve("approval-1", "user-1");
    expect(approved.status).toBe("approved");
    expect(approved.decidedBy).toBe("user-1");
    expect(approved.decidedAt).toBeTruthy();
  });

  it("supports denial and prevents a second decision", () => {
    const store = new InMemoryApprovalRequestStore();
    store.create({
      id: "approval-2",
      orgId: "org-1",
      workerId: "worker-1",
      taskId: "task-2",
      taskType: "email.send",
      input: {},
      policyId: "policy-1"
    });

    expect(store.deny("approval-2", "user-2").status).toBe("denied");
    expect(() => store.approve("approval-2", "user-3")).toThrow(
      "already denied"
    );
  });
});
