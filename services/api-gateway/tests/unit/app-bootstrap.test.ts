import { describe, expect, it } from "vitest";
import { InMemoryAppIdentityStore } from "../../src/app-bootstrap.js";

describe("app bootstrap", () => {
  it("returns only organizations the authenticated actor belongs to", () => {
    const store = new InMemoryAppIdentityStore();
    store.upsertUser({ id: "user-1", displayName: "Agent One", email: "agent@example.com" });
    store.addMembership("user-1", { orgId: "org-a", orgName: "Brokerage A", role: "owner", permissions: ["workspace.read", "workspace.write"] });
    store.addMembership("user-1", { orgId: "org-b", orgName: "Team B", role: "member", permissions: ["workspace.read"] });

    const result = store.bootstrap({ requestId: "r1", method: "GET", path: "/v1/app/bootstrap", actorId: "user-1" }, "org-b");

    expect(result.user.id).toBe("user-1");
    expect(result.activeOrganization.orgId).toBe("org-b");
    expect(result.organizations.map((org) => org.orgId)).toEqual(["org-a", "org-b"]);
    expect(result.environment.workspacePath).toContain("org-b");
  });

  it("fails closed for anonymous actors and unauthorized organizations", () => {
    const store = new InMemoryAppIdentityStore();
    store.upsertUser({ id: "user-1", displayName: "Agent One" });
    store.addMembership("user-1", { orgId: "org-a", orgName: "Brokerage A", role: "member", permissions: ["workspace.read"] });

    expect(() => store.bootstrap({ requestId: "r1", method: "GET", path: "/v1/app/bootstrap" })).toThrow("AUTHENTICATION_REQUIRED");
    expect(() => store.bootstrap({ requestId: "r2", method: "GET", path: "/v1/app/bootstrap", actorId: "user-1" }, "org-x")).toThrow("ORGANIZATION_ACCESS_DENIED");
  });
});
