import { describe, expect, it } from "vitest";
import { createPolicyService } from "../../src/service.js";

describe("policy service infrastructure", () => {
  it("evaluates policy decisions after startup", async () => {
    const service = createPolicyService();
    expect(service.evaluate({ subjectId: "u1", action: "read", resourceType: "doc" })).toEqual({
      allowed: false,
      reason: "service not started"
    });
    await service.start();
    expect(service.evaluate({ subjectId: "u1", action: "read", resourceType: "doc" }).allowed).toBe(
      true
    );
  });

  it("honors admin wildcard role", async () => {
    const service = createPolicyService();
    await service.start();
    const output = service.evaluate({
      subjectId: "admin-1",
      roles: ["admin"],
      action: "delete",
      resourceType: "doc"
    });
    expect(output.allowed).toBe(true);
  });
});
