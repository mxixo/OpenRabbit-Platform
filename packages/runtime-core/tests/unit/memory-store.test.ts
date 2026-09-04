import { describe, expect, it } from "vitest";
import { InMemoryMemoryStore } from "../../src/core/in-memory-memory-store.js";

describe("InMemoryMemoryStore", () => {
  it("stores and retrieves memory records", () => {
    const store = new InMemoryMemoryStore();
    store.put({
      id: "m1",
      orgId: "org-1",
      namespace: "tenant-a",
      sessionId: "s1",
      content: "Agent discussed onboarding"
    });

    expect(store.get({ orgId: "org-1", namespace: "tenant-a", id: "m1" })?.namespace).toBe(
      "tenant-a"
    );
    expect(
      store.search({ orgId: "org-1", namespace: "tenant-a", text: "onboarding" })
    ).toHaveLength(1);
  });

  it("deletes records", () => {
    const store = new InMemoryMemoryStore();
    store.put({
      id: "m2",
      orgId: "org-1",
      namespace: "tenant-b",
      content: "temp"
    });
    const address = { orgId: "org-1", namespace: "tenant-b", id: "m2" };
    expect(store.delete(address)).toBe(true);
    expect(store.get(address)).toBeUndefined();
  });

  it("isolates identical ids across organizations and namespaces", () => {
    const store = new InMemoryMemoryStore();
    store.put({ id: "shared", orgId: "org-1", namespace: "worker", content: "one" });
    store.put({ id: "shared", orgId: "org-2", namespace: "worker", content: "two" });

    expect(store.get({ orgId: "org-1", namespace: "worker", id: "shared" })?.content).toBe(
      "one"
    );
    expect(store.get({ orgId: "org-2", namespace: "worker", id: "shared" })?.content).toBe(
      "two"
    );
    expect(store.delete({ orgId: "org-1", namespace: "worker", id: "shared" })).toBe(true);
    expect(store.get({ orgId: "org-2", namespace: "worker", id: "shared" })?.content).toBe(
      "two"
    );
  });

  it("does not expose mutable references to stored records", () => {
    const store = new InMemoryMemoryStore();
    const saved = store.put({
      id: "mutable",
      orgId: "org-1",
      namespace: "worker",
      content: "original",
      metadata: { nested: { value: "safe" } }
    });

    saved.orgId = "org-2";
    saved.content = "poisoned";
    (saved.metadata?.nested as { value: string }).value = "poisoned";

    expect(store.get({ orgId: "org-1", namespace: "worker", id: "mutable" })).toMatchObject({
      orgId: "org-1",
      content: "original",
      metadata: { nested: { value: "safe" } }
    });
    expect(store.search({ orgId: "org-2", namespace: "worker" })).toHaveLength(0);
  });

  it("rejects unscoped runtime inputs without creating a shared partition", () => {
    const store = new InMemoryMemoryStore();
    expect(() =>
      store.put({ id: "shared", namespace: "worker", content: "missing org" } as never)
    ).toThrow("requires orgId, namespace, and id");
    expect(() =>
      store.put({ id: "shared", orgId: 7, namespace: "worker", content: "bad org" } as never)
    ).toThrow("requires orgId, namespace, and id");
    expect(() => store.search({ orgId: "", namespace: "worker" })).toThrow(
      "requires orgId and namespace"
    );

    expect(store.search({ orgId: "org-1", namespace: "worker" })).toEqual([]);
  });
});
