import { describe, expect, it } from "vitest";
import { InMemoryKnowledgeStore } from "../../src/core/in-memory-knowledge-store.js";

describe("InMemoryKnowledgeStore", () => {
  it("stores and retrieves knowledge records", () => {
    const store = new InMemoryKnowledgeStore();
    const saved = store.putRecord({
      id: "k1",
      namespace: "tenant-a",
      sourceId: "doc-1",
      content: "ACME onboarding runbook",
      tags: ["runbook", "onboarding"]
    });

    expect(saved.id).toBe("k1");
    expect(store.getRecord("k1")?.sourceId).toBe("doc-1");
  });

  it("ranks records by text and embedding similarity", () => {
    const store = new InMemoryKnowledgeStore();
    store.putRecord({
      id: "k2",
      namespace: "tenant-a",
      content: "customer onboarding checklist",
      embedding: [0.9, 0.1, 0]
    });
    store.putRecord({
      id: "k3",
      namespace: "tenant-a",
      content: "invoice reconciliation process",
      embedding: [0, 0.1, 0.9]
    });

    const results = store.search({
      namespace: "tenant-a",
      text: "onboarding checklist",
      embedding: [1, 0, 0],
      topK: 2
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.record.id).toBe("k2");
    expect(results[0]?.signals).toContain("text");
    expect(results[0]?.signals).toContain("embedding");
  });

  it("uses confidence metadata and minConfidenceScore in retrieval", () => {
    const store = new InMemoryKnowledgeStore();
    store.putRecord({
      id: "k6",
      namespace: "tenant-a",
      content: "customer onboarding checklist",
      quality: {
        confidence: { score: 0.95 }
      }
    });
    store.putRecord({
      id: "k7",
      namespace: "tenant-a",
      content: "customer onboarding checklist",
      quality: {
        confidence: { score: 0.2 }
      }
    });

    const highConfidenceOnly = store.search({
      namespace: "tenant-a",
      text: "onboarding checklist",
      minConfidenceScore: 0.8
    });
    const ranked = store.search({
      namespace: "tenant-a",
      text: "onboarding checklist",
      topK: 2
    });

    expect(highConfidenceOnly.map((entry) => entry.record.id)).toEqual(["k6"]);
    expect(ranked[0]?.record.id).toBe("k6");
    expect(ranked[0]?.signals).toContain("confidence");
  });

  it("de-prioritizes stale and expired records based on decay policy", () => {
    const store = new InMemoryKnowledgeStore();
    store.putRecord({
      id: "k8",
      namespace: "tenant-a",
      content: "incident response runbook",
      quality: {
        confidence: { score: 1 },
        freshnessTimestamp: new Date(Date.now() - 60_000).toISOString(),
        decayPolicy: {
          staleAfterSeconds: 30
        }
      }
    });
    store.putRecord({
      id: "k9",
      namespace: "tenant-a",
      content: "incident response runbook",
      quality: {
        confidence: { score: 0.1 },
        freshnessTimestamp: new Date().toISOString()
      }
    });
    store.putRecord({
      id: "k10",
      namespace: "tenant-a",
      content: "incident response runbook",
      quality: {
        confidence: { score: 1 },
        freshnessTimestamp: new Date(Date.now() - 60_000).toISOString(),
        decayPolicy: {
          expiresAt: new Date(Date.now() - 10_000).toISOString()
        }
      }
    });

    const ranked = store.search({
      namespace: "tenant-a",
      text: "incident response runbook",
      topK: 3
    });

    expect(ranked.map((entry) => entry.record.id)).toEqual(["k9", "k8", "k10"]);
    expect(ranked[1]?.signals).toContain("decay");
    expect(ranked[2]?.signals).toContain("decay");
  });

  it("supports tag-filtered retrieval and relationship listing", () => {
    const store = new InMemoryKnowledgeStore();
    store.putRecord({
      id: "k4",
      namespace: "tenant-a",
      content: "sales process doc",
      tags: ["sales", "process"]
    });
    store.putRecord({
      id: "k5",
      namespace: "tenant-a",
      content: "engineering runbook",
      tags: ["engineering"]
    });

    store.upsertEntity({
      id: "e1",
      namespace: "tenant-a",
      type: "account",
      name: "ACME Corp"
    });
    store.upsertEntity({
      id: "e2",
      namespace: "tenant-a",
      type: "contact",
      name: "Jane Doe"
    });
    store.upsertRelationship({
      id: "r1",
      namespace: "tenant-a",
      fromEntityId: "e1",
      toEntityId: "e2",
      type: "has-contact"
    });

    const tagged = store.search({
      namespace: "tenant-a",
      tags: ["sales"]
    });
    const relationships = store.listRelationships("tenant-a", "e1");

    expect(tagged.map((entry) => entry.record.id)).toEqual(["k4"]);
    expect(relationships.map((relationship) => relationship.id)).toEqual(["r1"]);
  });
});
