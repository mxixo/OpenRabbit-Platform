"use strict";

const assert = require("assert");
const {
  RealEstateCapabilityProviderAdapter,
} = require("../capabilities/real-estate/capability-provider-adapter");

async function run() {
  const calls = [];
  const productApi = {
    async handle(request) {
      calls.push(request);
      if (request.path.endsWith("/workspace")) {
        return {
          status: 200,
          data: {
            underwriting: {
              latestRun: { version: 2 },
              versions: [{ version: 1 }, { version: 2 }],
              runCount: 2,
            },
          },
        };
      }
      if (request.path.includes("/approvals/") && request.path.endsWith("/execute")) {
        return { status: 409, error: { message: "Approval is pending; execution requires approved" } };
      }
      return { status: request.method === "POST" ? 201 : 200, data: { ok: true } };
    },
  };

  const adapter = new RealEstateCapabilityProviderAdapter({ productApi });
  assert.strictEqual(adapter.providerId, "openrabbit_real_estate");

  await adapter.execute({
    capabilityId: "work.deal_create",
    orgId: "org-1",
    actorId: "actor-1",
    requestId: "req-1",
    input: { address: "123 Main" },
    dryRun: false,
  });
  assert.strictEqual(calls[0].path, "/v1/orgs/org-1/deals");
  assert.strictEqual(calls[0].actorId, "actor-1");

  await adapter.execute({
    capabilityId: "work.underwrite",
    orgId: "org-1",
    actorId: "actor-2",
    requestId: "req-2",
    input: { dealId: "deal/7", assumptions: { vacancy: 0.05 } },
    dryRun: false,
  });
  assert.strictEqual(
    calls[1].path,
    "/v1/orgs/org-1/deals/deal%2F7/underwriting-runs"
  );
  assert.deepStrictEqual(calls[1].body, { assumptions: { vacancy: 0.05 } });

  const comparison = await adapter.execute({
    capabilityId: "work.deal_compare",
    orgId: "org-1",
    actorId: "actor-3",
    requestId: "req-3",
    input: { dealId: "deal-1" },
    dryRun: false,
  });
  assert.strictEqual(comparison.runCount, 2);
  assert.deepStrictEqual(comparison.versions, [{ version: 1 }, { version: 2 }]);

  const draft = await adapter.execute({
    capabilityId: "work.outreach_draft",
    orgId: "org-1",
    actorId: "actor-4",
    requestId: "req-4",
    input: {
      dealId: "deal-1",
      message: {
        recipient: "Buyer@Example.com",
        subject: "Deal",
        body: "Take a look",
      },
    },
    dryRun: false,
  });
  assert.strictEqual(draft.status, "draft");
  assert.strictEqual(draft.externalSideEffect, false);
  assert.strictEqual(draft.message.recipient, "buyer@example.com");

  await assert.rejects(
    () =>
      adapter.execute({
        capabilityId: "work.outreach_execute",
        orgId: "org-1",
        actorId: "actor-5",
        requestId: "req-5",
        input: { approvalId: "approval-1" },
        dryRun: false,
      }),
    /requires approved/
  );

  console.log("real-estate capability provider tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
