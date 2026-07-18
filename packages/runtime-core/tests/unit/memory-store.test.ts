import { describe, expect, it } from "vitest";
import { InMemoryMemoryStore } from "../../src/core/in-memory-memory-store.js";

describe("InMemoryMemoryStore", () => {
  it("stores and retrieves memory records", () => {
    const store = new InMemoryMemoryStore();
    store.put({
      id: "m1",
      namespace: "tenant-a",
      sessionId: "s1",
      content: "Agent discussed onboarding"
    });

    expect(store.get("m1")?.namespace).toBe("tenant-a");
    expect(store.search({ namespace: "tenant-a", text: "onboarding" })).toHaveLength(1);
  });

  it("deletes records", () => {
    const store = new InMemoryMemoryStore();
    store.put({
      id: "m2",
      namespace: "tenant-b",
      content: "temp"
    });
    expect(store.delete("m2")).toBe(true);
    expect(store.get("m2")).toBeUndefined();
  });

  it("filters by domain/agent and confidence score", () => {
    const store = new InMemoryMemoryStore();
    store.put({
      id: "m3",
      namespace: "tenant-a",
      agentId: "agent-alpha",
      domain: "working",
      content: "fresh confident memory",
      quality: {
        confidence: { score: 0.95 }
      }
    });
    store.put({
      id: "m4",
      namespace: "tenant-a",
      agentId: "agent-beta",
      domain: "working",
      content: "low confidence memory",
      quality: {
        confidence: { score: 0.2 }
      }
    });
    store.put({
      id: "m5",
      namespace: "tenant-a",
      agentId: "agent-alpha",
      domain: "long-term",
      content: "historical memory",
      quality: {
        confidence: { score: 0.99 }
      }
    });

    const results = store.search({
      namespace: "tenant-a",
      agentId: "agent-alpha",
      domain: "working",
      minConfidenceScore: 0.8
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("m3");
  });

  it("tracks access count for consolidation hooks", () => {
    const store = new InMemoryMemoryStore();
    store.put({
      id: "m6",
      namespace: "tenant-a",
      content: "access tracked memory"
    });

    store.get("m6");
    store.get("m6");
    const record = store.get("m6");

    expect(record?.quality?.consolidation?.accessCount).toBe(3);
    expect(record?.quality?.consolidation?.lastAccessedAt).toBeDefined();
  });

  it("de-prioritizes stale records based on staleAfterSeconds decay policy", () => {
    const store = new InMemoryMemoryStore();
    const staleTimestamp = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const freshTimestamp = new Date(Date.now() - 30 * 1000).toISOString();

    store.put({
      id: "stale-1",
      namespace: "tenant-decay",
      content: "old but high confidence",
      quality: {
        confidence: { score: 0.99 },
        freshnessTimestamp: staleTimestamp,
        decayPolicy: { staleAfterSeconds: 300 }
      }
    });
    store.put({
      id: "fresh-1",
      namespace: "tenant-decay",
      content: "fresh medium confidence",
      quality: {
        confidence: { score: 0.5 },
        freshnessTimestamp: freshTimestamp,
        decayPolicy: { staleAfterSeconds: 300 }
      }
    });

    const results = store.search({ namespace: "tenant-decay", limit: 2 });
    expect(results.map((record) => record.id)).toEqual(["fresh-1", "stale-1"]);
  });

  it("de-prioritizes expired records based on expiresAt decay policy", () => {
    const store = new InMemoryMemoryStore();

    store.put({
      id: "expired-1",
      namespace: "tenant-expiry",
      content: "expired memory",
      quality: {
        confidence: { score: 0.95 },
        decayPolicy: {
          expiresAt: new Date(Date.now() - 60_000).toISOString()
        }
      }
    });
    store.put({
      id: "active-1",
      namespace: "tenant-expiry",
      content: "active memory",
      quality: {
        confidence: { score: 0.2 },
        decayPolicy: {
          expiresAt: new Date(Date.now() + 60_000).toISOString()
        }
      }
    });

    const results = store.search({ namespace: "tenant-expiry", limit: 2 });
    expect(results.map((record) => record.id)).toEqual(["active-1", "expired-1"]);
  });
});
