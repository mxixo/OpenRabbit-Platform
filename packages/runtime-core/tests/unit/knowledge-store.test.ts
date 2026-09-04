import { describe, expect, it } from "vitest";
import { InMemoryKnowledgeStore } from "../../src/core/in-memory-knowledge-store.js";

describe("InMemoryKnowledgeStore", () => {
  it("stores and retrieves knowledge records", () => {
    const store = new InMemoryKnowledgeStore();
    const saved = store.putRecord({
      id: "k1",
      orgId: "org-1",
      namespace: "tenant-a",
      sourceId: "doc-1",
      content: "ACME onboarding runbook",
      tags: ["runbook", "onboarding"]
    });

    expect(saved.id).toBe("k1");
    expect(
      store.getRecord({ orgId: "org-1", namespace: "tenant-a", id: "k1" })?.sourceId
    ).toBe("doc-1");
  });

  it("ranks records by text and embedding similarity", () => {
    const store = new InMemoryKnowledgeStore();
    store.putRecord({
      id: "k2",
      orgId: "org-1",
      namespace: "tenant-a",
      content: "customer onboarding checklist",
      embedding: [0.9, 0.1, 0]
    });
    store.putRecord({
      id: "k3",
      orgId: "org-1",
      namespace: "tenant-a",
      content: "invoice reconciliation process",
      embedding: [0, 0.1, 0.9]
    });

    const results = store.search({
      orgId: "org-1",
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
      orgId: "org-1",
      namespace: "tenant-a",
      content: "customer onboarding checklist",
      quality: {
        confidence: { score: 0.95 }
      }
    });
    store.putRecord({
      id: "k7",
      orgId: "org-1",
      namespace: "tenant-a",
      content: "customer onboarding checklist",
      quality: {
        confidence: { score: 0.2 }
      }
    });

    const highConfidenceOnly = store.search({
      orgId: "org-1",
      namespace: "tenant-a",
      text: "onboarding checklist",
      minConfidenceScore: 0.8
    });
    const ranked = store.search({
      orgId: "org-1",
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
      orgId: "org-1",
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
      orgId: "org-1",
      namespace: "tenant-a",
      content: "incident response runbook",
      quality: {
        confidence: { score: 0.1 },
        freshnessTimestamp: new Date().toISOString()
      }
    });
    store.putRecord({
      id: "k10",
      orgId: "org-1",
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
      orgId: "org-1",
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
      orgId: "org-1",
      namespace: "tenant-a",
      content: "sales process doc",
      tags: ["sales", "process"]
    });
    store.putRecord({
      id: "k5",
      orgId: "org-1",
      namespace: "tenant-a",
      content: "engineering runbook",
      tags: ["engineering"]
    });

    store.upsertEntity({
      id: "e1",
      orgId: "org-1",
      namespace: "tenant-a",
      type: "account",
      name: "ACME Corp"
    });
    store.upsertEntity({
      id: "e2",
      orgId: "org-1",
      namespace: "tenant-a",
      type: "contact",
      name: "Jane Doe"
    });
    store.upsertRelationship({
      id: "r1",
      orgId: "org-1",
      namespace: "tenant-a",
      fromEntityId: "e1",
      toEntityId: "e2",
      type: "has-contact"
    });

    const tagged = store.search({
      orgId: "org-1",
      namespace: "tenant-a",
      tags: ["sales"]
    });
    const relationships = store.listRelationships({
      orgId: "org-1",
      namespace: "tenant-a",
      entityId: "e1"
    });

    expect(tagged.map((entry) => entry.record.id)).toEqual(["k4"]);
    expect(relationships.map((relationship) => relationship.id)).toEqual(["r1"]);
  });

  it("isolates identical record, entity, and relationship ids across organizations", () => {
    const store = new InMemoryKnowledgeStore();
    for (const orgId of ["org-1", "org-2"]) {
      store.putRecord({ id: "k", orgId, namespace: "shared", content: orgId });
      store.upsertEntity({ id: "e1", orgId, namespace: "shared", type: "account", name: orgId });
      store.upsertEntity({ id: "e2", orgId, namespace: "shared", type: "contact", name: orgId });
      store.upsertRelationship({
        id: "r",
        orgId,
        namespace: "shared",
        fromEntityId: "e1",
        toEntityId: "e2",
        type: "contains"
      });
    }

    expect(store.getRecord({ orgId: "org-1", namespace: "shared", id: "k" })?.content).toBe(
      "org-1"
    );
    expect(store.getRecord({ orgId: "org-2", namespace: "shared", id: "k" })?.content).toBe(
      "org-2"
    );
    expect(
      store.listRelationships({ orgId: "org-1", namespace: "shared", entityId: "e1" })
    ).toHaveLength(1);
    expect(store.deleteRecord({ orgId: "org-1", namespace: "shared", id: "k" })).toBe(true);
    expect(store.getRecord({ orgId: "org-2", namespace: "shared", id: "k" })?.content).toBe(
      "org-2"
    );
  });

  it("does not expose mutable references to stored knowledge", () => {
    const store = new InMemoryKnowledgeStore();
    const record = store.putRecord({
      id: "mutable",
      orgId: "org-1",
      namespace: "worker",
      content: "original",
      tags: ["safe"],
      metadata: { nested: { value: "safe" } }
    });
    const relationship = store.upsertRelationship({
      id: "rel",
      orgId: "org-1",
      namespace: "worker",
      fromEntityId: "one",
      toEntityId: "two",
      type: "contains",
      metadata: { nested: { value: "safe" } }
    });

    record.orgId = "org-2";
    record.tags?.push("poisoned");
    (record.metadata?.nested as { value: string }).value = "poisoned";
    relationship.orgId = "org-2";

    expect(
      store.getRecord({ orgId: "org-1", namespace: "worker", id: "mutable" })
    ).toMatchObject({ orgId: "org-1", tags: ["safe"], metadata: { nested: { value: "safe" } } });
    expect(store.search({ orgId: "org-2", namespace: "worker" })).toHaveLength(0);
    expect(
      store.listRelationships({ orgId: "org-1", namespace: "worker", entityId: "one" })
    ).toMatchObject([{ orgId: "org-1" }]);
  });

  it("rejects unscoped runtime inputs without creating a shared partition", () => {
    const store = new InMemoryKnowledgeStore();
    expect(() =>
      store.putRecord({ id: "shared", namespace: "worker", content: "missing org" } as never)
    ).toThrow("requires orgId, namespace, and id");
    expect(() =>
      store.upsertEntity({
        id: "shared",
        orgId: null,
        namespace: "worker",
        type: "contact",
        name: "bad org"
      } as never)
    ).toThrow("requires orgId, namespace, and id");
    expect(() => store.search({ orgId: "", namespace: "worker" })).toThrow(
      "requires orgId and namespace"
    );

    expect(store.search({ orgId: "org-1", namespace: "worker" })).toEqual([]);
  });
});
