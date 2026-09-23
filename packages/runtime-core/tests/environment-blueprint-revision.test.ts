import { describe, expect, it } from "vitest";

import { resolveEnvironmentBlueprint } from "../src/core/environment-blueprint.js";
import {
  InMemoryEnvironmentBlueprintRevisionStore,
  sealEnvironmentBlueprintRevision,
  verifyEnvironmentBlueprintRevision,
} from "../src/core/environment-blueprint-revision.js";

function blueprint(revision: string, generatedAt: string) {
  return resolveEnvironmentBlueprint({
    orgId: "org-a",
    revision,
    generatedAt,
    capabilities: [
      {
        orgId: "org-a",
        id: "calendar",
        version: "1.0.0",
        enabled: true,
        surfaces: ["calendar"],
      },
    ],
  });
}

describe("Environment Blueprint revision integrity", () => {
  it("seals append-only revisions into a predecessor-linked chain", () => {
    const first = sealEnvironmentBlueprintRevision(
      blueprint("rev-1", "2026-09-23T07:00:00Z"),
    );
    const second = sealEnvironmentBlueprintRevision(
      blueprint("rev-2", "2026-09-23T07:01:00Z"),
      first.recordHash,
    );

    expect(verifyEnvironmentBlueprintRevision(first)).toBe(true);
    expect(verifyEnvironmentBlueprintRevision(second)).toBe(true);
    expect(second.previousRecordHash).toBe(first.recordHash);
    expect(second.recordHash).not.toBe(first.recordHash);
  });

  it("fails integrity verification after persisted blueprint drift", () => {
    const record = sealEnvironmentBlueprintRevision(
      blueprint("rev-1", "2026-09-23T07:00:00Z"),
    );
    const tampered = JSON.parse(JSON.stringify(record)) as typeof record;
    tampered.blueprint.revision = "rev-substituted";

    expect(verifyEnvironmentBlueprintRevision(tampered)).toBe(false);
  });

  it("rejects stale predecessor branches and duplicate revisions", () => {
    const store = new InMemoryEnvironmentBlueprintRevisionStore();
    const first = sealEnvironmentBlueprintRevision(
      blueprint("rev-1", "2026-09-23T07:00:00Z"),
    );
    const second = sealEnvironmentBlueprintRevision(
      blueprint("rev-2", "2026-09-23T07:01:00Z"),
      first.recordHash,
    );
    store.append(first);
    store.append(second);

    const staleFork = sealEnvironmentBlueprintRevision(
      blueprint("rev-3", "2026-09-23T07:02:00Z"),
      first.recordHash,
    );
    expect(() => store.append(staleFork)).toThrow("predecessor does not match latest record");

    const duplicate = sealEnvironmentBlueprintRevision(
      blueprint("rev-2", "2026-09-23T07:03:00Z"),
      second.recordHash,
    );
    expect(() => store.append(duplicate)).toThrow("revision already exists");
  });

  it("keeps revision history org-scoped and returns clones", () => {
    const store = new InMemoryEnvironmentBlueprintRevisionStore();
    const record = sealEnvironmentBlueprintRevision(
      blueprint("rev-1", "2026-09-23T07:00:00Z"),
    );
    store.append(record);

    expect(store.getLatest("org-b")).toBeUndefined();
    expect(store.getRevision("org-b", "rev-1")).toBeUndefined();
    expect(store.listRevisions("org-b")).toEqual([]);

    const loaded = store.getLatest("org-a");
    expect(loaded).toEqual(record);
    if (!loaded) throw new Error("expected revision record");
    loaded.blueprint.revision = "mutated-client-copy";
    expect(store.getLatest("org-a")?.blueprint.revision).toBe("rev-1");
  });

  it("rejects a first revision with a predecessor and backward generatedAt", () => {
    const store = new InMemoryEnvironmentBlueprintRevisionStore();
    const invalidFirst = sealEnvironmentBlueprintRevision(
      blueprint("rev-1", "2026-09-23T07:00:00Z"),
      "a".repeat(64),
    );
    expect(() => store.append(invalidFirst)).toThrow(
      "first environment blueprint revision cannot reference a predecessor",
    );

    const first = sealEnvironmentBlueprintRevision(
      blueprint("rev-1", "2026-09-23T07:00:00Z"),
    );
    store.append(first);
    const backward = sealEnvironmentBlueprintRevision(
      blueprint("rev-2", "2026-09-23T06:59:59Z"),
      first.recordHash,
    );
    expect(() => store.append(backward)).toThrow("generatedAt cannot move backward");
  });
});
