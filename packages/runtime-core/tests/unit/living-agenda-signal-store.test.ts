import { describe, expect, it } from "vitest";
import { InMemoryLivingAgendaSignalStore } from "../../src/core/in-memory-living-agenda-signal-store.js";

function signal(id: string, userId = "user-1") {
  return {
    id,
    userId,
    type: "execution_check_in" as const,
    source: "living-agenda-app",
    observedAt: "2026-08-11T12:00:00.000Z",
    receivedAt: "2026-08-11T12:00:01.000Z",
    confidence: 1,
    provenance: "user_action" as const,
    payload: { completed: true }
  };
}

describe("InMemoryLivingAgendaSignalStore", () => {
  it("keeps signals isolated by user", () => {
    const store = new InMemoryLivingAgendaSignalStore();
    store.append(signal("s1", "user-1"));
    store.append(signal("s2", "user-2"));

    expect(store.list("user-1").map((s) => s.id)).toEqual(["s1"]);
    expect(store.list("user-2").map((s) => s.id)).toEqual(["s2"]);
  });

  it("quarantines suspicious signals from default learning queries", () => {
    const store = new InMemoryLivingAgendaSignalStore();
    store.append(signal("s1"));
    store.quarantine("user-1", "s1");

    expect(store.list("user-1")).toEqual([]);
    expect(store.list("user-1", { includeQuarantined: true })[0]?.quarantined).toBe(true);
  });

  it("records corrections without erasing provenance history", () => {
    const store = new InMemoryLivingAgendaSignalStore();
    store.append(signal("s1"));

    const corrected = store.correct("user-1", "s1", {
      ...signal("s1-corrected"),
      payload: { completed: false }
    });

    expect(corrected.correctionOf).toBe("s1");
    expect(store.get("user-1", "s1")?.quarantined).toBe(true);
    expect(store.list("user-1").map((s) => s.id)).toEqual(["s1-corrected"]);
  });

  it("rejects invalid confidence values", () => {
    const store = new InMemoryLivingAgendaSignalStore();
    expect(() => store.append({ ...signal("bad"), confidence: 1.5 })).toThrow(
      "signal confidence must be between 0 and 1"
    );
  });
});
