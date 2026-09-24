import { describe, expect, it } from "vitest";
import { InMemoryExecutionNodeRegistry } from "../src/core/in-memory-node-registry.js";

const NOW = new Date("2026-09-24T00:00:00.000Z");

function registry() {
  return new InMemoryExecutionNodeRegistry({
    now: () => NOW,
    staleAfterMs: 60_000,
    offlineAfterMs: 300_000,
  });
}

function node(overrides: Record<string, unknown> = {}) {
  return {
    nodeId: "mac-1",
    orgId: "org-a",
    kind: "desktop" as const,
    displayName: "MacBook",
    runtimeVersion: "1.0.0",
    capabilities: ["local.files", "desktop.apps"],
    network: {
      fabricNodeId: "tailscale-mac-1",
      deviceName: "macbook",
      privateAddresses: ["100.64.0.10"],
      advertisesExitNode: false,
    },
    enabled: true,
    registeredAt: "2026-09-23T23:00:00.000Z",
    lastSeenAt: "2026-09-23T23:59:45.000Z",
    ...overrides,
  };
}

describe("InMemoryExecutionNodeRegistry", () => {
  it("routes only to online capability-bearing nodes in the same org", () => {
    const nodes = registry();
    nodes.register(node());
    nodes.register(node({ nodeId: "server-1", kind: "server", capabilities: ["web.fetch"] }));
    nodes.register(node({ nodeId: "other-org", orgId: "org-b", capabilities: ["local.files"] }));

    const selection = nodes.resolveCapability({ orgId: "org-a", capability: "local.files" });
    expect(selection.node.nodeId).toBe("mac-1");
    expect(selection.node.health).toBe("online");
    expect(selection.reason).toBe("capability_online");
  });

  it("fails closed for stale, offline, disabled, or unavailable nodes", () => {
    const nodes = registry();
    nodes.register(node({ nodeId: "stale", lastSeenAt: "2026-09-23T23:58:30.000Z" }));
    nodes.register(node({ nodeId: "offline", lastSeenAt: "2026-09-23T23:50:00.000Z" }));
    nodes.register(node({ nodeId: "disabled", enabled: false }));
    nodes.register(node({ nodeId: "reported", reportedOffline: true }));

    expect(nodes.get("org-a", "stale")?.health).toBe("stale");
    expect(nodes.get("org-a", "offline")?.health).toBe("offline");
    expect(() => nodes.resolveCapability({ orgId: "org-a", capability: "local.files" }))
      .toThrow("no online execution node");
  });

  it("uses explicit kind preference and node allow-lists deterministically", () => {
    const nodes = registry();
    nodes.register(node({ nodeId: "desktop-a", kind: "desktop" }));
    nodes.register(node({ nodeId: "server-a", kind: "server" }));

    const preferred = nodes.resolveCapability({
      orgId: "org-a",
      capability: "local.files",
      preferredKinds: ["server", "desktop"],
    });
    expect(preferred.node.nodeId).toBe("server-a");
    expect(preferred.reason).toBe("preferred_kind_online");

    const allowed = nodes.resolveCapability({
      orgId: "org-a",
      capability: "local.files",
      allowedNodeIds: ["desktop-a"],
    });
    expect(allowed.node.nodeId).toBe("desktop-a");
  });

  it("treats exit-node advertisement as transport metadata, not authority", () => {
    const nodes = registry();
    nodes.register(node({
      nodeId: "exit-only",
      capabilities: [],
      network: { advertisesExitNode: true, privateAddresses: ["100.64.0.20"] },
    }));

    expect(() => nodes.resolveCapability({ orgId: "org-a", capability: "web.fetch" }))
      .toThrow("no online execution node");
  });

  it("accepts monotonic heartbeats and refreshes declared capabilities", () => {
    const nodes = registry();
    nodes.register(node());

    const updated = nodes.heartbeat({
      orgId: "org-a",
      nodeId: "mac-1",
      observedAt: "2026-09-23T23:59:55.000Z",
      runtimeVersion: "1.1.0",
      capabilities: ["local.files", "desktop.apps", "desktop.screen"],
    });
    expect(updated.runtimeVersion).toBe("1.1.0");
    expect(updated.capabilities).toContain("desktop.screen");

    expect(() => nodes.heartbeat({
      orgId: "org-a",
      nodeId: "mac-1",
      observedAt: "2026-09-23T23:59:00.000Z",
    })).toThrow("cannot move backwards");
  });

  it("returns clones so callers cannot mutate registry authority", () => {
    const nodes = registry();
    nodes.register(node());
    const first = nodes.get("org-a", "mac-1");
    if (!first) throw new Error("missing node");
    first.capabilities.push("unauthorized.capability");
    expect(nodes.get("org-a", "mac-1")?.capabilities).not.toContain("unauthorized.capability");
  });
});
