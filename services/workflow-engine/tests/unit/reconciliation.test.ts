import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { FilesystemWorkflowReconciliationStore } from "../../src/reconciliation.js";

const roots: string[] = [];

async function store() {
  const root = await mkdtemp(join(tmpdir(), "openrabbit-reconcile-"));
  roots.push(root);
  return new FilesystemWorkflowReconciliationStore(root);
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("workflow reconciliation registry", () => {
  it("persists an uncertain provider outcome without enabling retry", async () => {
    const registry = await store();
    const required = await registry.require(
      '["tenant-a","wf","1","key"]',
      "provider timed out after request dispatch",
      ["provider-receipt:abc"]
    );

    expect(required.state).toBe("required");
    expect(required.outcome).toBeUndefined();

    const reloaded = await registry.get(required.scopeKey);
    expect(reloaded).toEqual(required);
  });

  it("requires evidence before an uncertain outcome can be resolved", async () => {
    const registry = await store();
    await registry.require("scope-no-evidence", "unknown provider outcome");

    await expect(
      registry.resolve("scope-no-evidence", "safe_to_retry", "provider reports no write")
    ).rejects.toThrow(/evidence/i);
  });

  it("records an evidence-backed safe-to-retry decision", async () => {
    const registry = await store();
    await registry.require("scope-safe", "provider timeout");

    const resolved = await registry.resolve(
      "scope-safe",
      "safe_to_retry",
      "provider lookup confirmed no matching external object",
      ["provider-query:request-42"]
    );

    expect(resolved.state).toBe("resolved");
    expect(resolved.outcome).toBe("safe_to_retry");
    expect(resolved.evidenceRefs).toContain("provider-query:request-42");
  });

  it("rejects credential-like evidence strings", async () => {
    const registry = await store();
    await expect(
      registry.require("scope-secret", "provider timeout", ["token=do-not-store"])
    ).rejects.toThrow(/credential/i);
  });

  it("merges evidence references deterministically", async () => {
    const registry = await store();
    await registry.require("scope-merge", "timeout", ["provider:b", "provider:a"]);
    const updated = await registry.require("scope-merge", "still unresolved", ["provider:a", "audit:c"]);
    expect(updated.evidenceRefs).toEqual(["audit:c", "provider:a", "provider:b"]);
  });
});
