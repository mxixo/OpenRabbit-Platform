import { describe, expect, it } from "vitest";
import { InMemoryProviderConnectionStore } from "../../src/provider-connections.js";
import { InMemoryEmailDraftStore } from "../../src/email-drafts.js";
import { routeProviderApi } from "../../src/provider-api.js";

describe("provider connections and email drafts", () => {
  it("stores connection metadata without credentials", async () => {
    const connections = new InMemoryProviderConnectionStore();
    const drafts = new InMemoryEmailDraftStore();
    const result = await routeProviderApi({
      requestId: "c1",
      method: "PUT",
      path: "/v1/orgs/org-1/connections/google",
      body: {
        status: "connected",
        accountLabel: "agent@example.com",
        capabilities: ["email.read", "email.draft", "calendar.read", "calendar.write"],
        scopes: ["gmail.readonly", "calendar.events"]
      }
    }, connections, drafts);

    expect(result).toMatchObject({ matched: true, status: 200, data: { provider: "google", status: "connected" } });
    const stored = await connections.get("org-1", "google");
    expect(stored?.capabilities).toContain("calendar.write");
    expect(stored).not.toHaveProperty("accessToken");
    expect(stored).not.toHaveProperty("refreshToken");
  });

  it("keeps connection state tenant scoped", async () => {
    const connections = new InMemoryProviderConnectionStore();
    await connections.upsert("org-1", { provider: "microsoft", status: "connected", capabilities: ["email.read"] });
    expect(await connections.get("org-2", "microsoft")).toBeUndefined();
  });

  it("creates worker drafts pending approval and advances status explicitly", async () => {
    const connections = new InMemoryProviderConnectionStore();
    const drafts = new InMemoryEmailDraftStore();
    const created = await routeProviderApi({
      requestId: "d1",
      method: "POST",
      path: "/v1/orgs/org-1/email/drafts",
      body: {
        provider: "google",
        to: ["client@example.com"],
        subject: "Showing confirmation",
        body: "Thursday at 3 works. Please confirm.",
        createdBy: "worker",
        status: "pending_approval",
        relationshipId: "rel-1"
      }
    }, connections, drafts);
    if (!created.matched || !created.data) throw new Error("draft not created");
    const draft = created.data as { id: string; status: string; relationshipId?: string };
    expect(draft.status).toBe("pending_approval");
    expect(draft.relationshipId).toBe("rel-1");

    const approved = await routeProviderApi({
      requestId: "d2",
      method: "PATCH",
      path: `/v1/orgs/org-1/email/drafts/${draft.id}`,
      body: { status: "approved" }
    }, connections, drafts);
    expect(approved).toMatchObject({ matched: true, status: 200, data: { status: "approved" } });
  });

  it("rejects unsupported provider capability claims", async () => {
    const result = await routeProviderApi({
      requestId: "c2",
      method: "PUT",
      path: "/v1/orgs/org-1/connections/google",
      body: { status: "connected", capabilities: ["drive.admin"] }
    }, new InMemoryProviderConnectionStore(), new InMemoryEmailDraftStore());
    expect(result).toMatchObject({ matched: true, status: 400, error: { code: "INVALID_PROVIDER_CAPABILITY" } });
  });
});
