import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { WorkflowDefinition } from "../../src/contracts.js";
import { FilesystemWorkflowReconciliationStore } from "../../src/reconciliation.js";
import {
  WorkflowIdempotencyStore,
  workflowIdempotencyScopeKey
} from "../../src/reliability.js";
import { InMemoryWorkflowRunner } from "../../src/runner.js";

const roots: string[] = [];

class CompletionFailingIdempotencyStore implements WorkflowIdempotencyStore {
  async claim() {
    return { state: "acquired" as const, claimToken: "claim-owner" };
  }

  async complete(): Promise<void> {
    throw new Error("simulated durable-store outage after provider side effects");
  }
}

const definition: WorkflowDefinition = {
  workflowId: "provider-write",
  version: "1.0.0",
  name: "Provider write",
  steps: [
    {
      id: "write",
      name: "Write",
      action: "provider.write",
      guardrails: { policyCheck: true, requiresApproval: false, maxRetries: 0 }
    }
  ]
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("runner reconciliation integration", () => {
  it("persists a reconciliation requirement when completion fencing fails after side effects", async () => {
    const root = await mkdtemp(join(tmpdir(), "openrabbit-runner-reconcile-"));
    roots.push(root);
    const reconciliation = new FilesystemWorkflowReconciliationStore(root);
    const runner = new InMemoryWorkflowRunner(
      { maxAttempts: 1 },
      new CompletionFailingIdempotencyStore(),
      reconciliation
    );
    const context = {
      correlationId: "corr-42",
      initiatedBy: "test",
      variables: {},
      tenantId: "tenant-a",
      idempotencyKey: "request-42"
    };

    const result = await runner.run(definition, context, {
      "provider.write": async () => ({ ok: true, output: { providerReceipt: "receipt-1" } })
    });

    expect(result.status).toBe("failed");
    expect(result.completedSteps).toEqual(["write"]);
    expect(result.deadLetterReason).toMatch(/reconciliation is required before retry/);

    const scope = workflowIdempotencyScopeKey(definition, context);
    expect(scope).toBeDefined();
    const record = await reconciliation.get(scope!);
    expect(record).toMatchObject({
      state: "required",
      scopeKey: scope,
      evidenceRefs: ["correlation:corr-42", "workflow:provider-write"]
    });

    const terminalEvent = result.events.at(-1);
    expect(terminalEvent?.details).toMatchObject({
      phase: "complete",
      reconciliationRequired: true,
      reconciliationRecorded: true
    });
  });
});
