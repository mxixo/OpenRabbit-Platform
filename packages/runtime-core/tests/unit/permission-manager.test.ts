import { describe, expect, it } from "vitest";
import { InMemoryPermissionManager } from "../../src/core/in-memory-permission-manager.js";

describe("InMemoryPermissionManager", () => {
  it("allows by matching allow policy", () => {
    const manager = new InMemoryPermissionManager();
    manager.addPolicy({
      id: "allow-read",
      effect: "allow",
      actions: ["read"],
      resources: ["document"],
      roles: ["analyst"]
    });

    const decision = manager.evaluate({
      subject: { id: "u1", roles: ["analyst"] },
      action: "read",
      resource: { type: "document" }
    });

    expect(decision.allowed).toBe(true);
    expect(decision.matchedPolicyId).toBe("allow-read");
  });

  it("applies deny over allow when both match", () => {
    const manager = new InMemoryPermissionManager();
    manager.addPolicy({
      id: "allow-all-read",
      effect: "allow",
      actions: ["read"],
      resources: ["document"]
    });
    manager.addPolicy({
      id: "deny-u2",
      effect: "deny",
      actions: ["read"],
      resources: ["document"],
      subjects: ["u2"]
    });

    const decision = manager.evaluate({
      subject: { id: "u2" },
      action: "read",
      resource: { type: "document" }
    });

    expect(decision.allowed).toBe(false);
    expect(decision.matchedPolicyId).toBe("deny-u2");
  });
});
