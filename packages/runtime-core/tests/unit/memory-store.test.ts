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
});
