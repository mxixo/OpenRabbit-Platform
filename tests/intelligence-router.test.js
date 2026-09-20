"use strict";

const assert = require("assert");
const {
  normalizeRoutingPolicy,
  routeExecution,
} = require("../runtime/intelligence-router");

function candidate(routeId, tier, cost, reliability, capabilities = ["summarize"]) {
  return {
    routeId,
    tier,
    available: true,
    reliability,
    estimatedVariableCostUsd: cost,
    capabilities,
    provider: tier.startsWith("cloud_") ? "provider-a" : undefined,
    model: tier.includes("inference") || tier.startsWith("cloud_") ? `${routeId}-model` : undefined,
  };
}

function run() {
  const policy = normalizeRoutingPolicy({ minimumReliability: 0.95 });
  assert.deepStrictEqual(policy.orderedTiers, [
    "deterministic",
    "local_inference",
    "cloud_routine",
    "cloud_reasoning",
    "cloud_frontier",
  ]);

  const deterministicFirst = routeExecution({
    request: { requiredCapabilities: ["summarize"] },
    policy,
    candidates: [
      candidate("frontier", "cloud_frontier", 0.20, 0.999),
      candidate("routine", "cloud_routine", 0.01, 0.99),
      candidate("code", "deterministic", 0, 1),
    ],
  });
  assert.strictEqual(deterministicFirst.routeId, "code");
  assert.strictEqual(deterministicFirst.tier, "deterministic");

  const cheapestReliableWithinTier = routeExecution({
    request: { requiredCapabilities: ["summarize"] },
    policy,
    candidates: [
      candidate("routine-expensive", "cloud_routine", 0.03, 0.995),
      candidate("routine-cheap", "cloud_routine", 0.01, 0.97),
      candidate("reasoning", "cloud_reasoning", 0.005, 0.999),
    ],
  });
  assert.strictEqual(cheapestReliableWithinTier.routeId, "routine-cheap");
  assert.strictEqual(cheapestReliableWithinTier.estimatedVariableCostUsd, 0.01);

  const skipsUnreliableAndIncapable = routeExecution({
    request: { requiredCapabilities: ["summarize", "vision"] },
    policy,
    candidates: [
      candidate("local-low-reliability", "local_inference", 0, 0.8, ["summarize", "vision"]),
      candidate("routine-no-vision", "cloud_routine", 0.01, 0.99, ["summarize"]),
      candidate("reasoning", "cloud_reasoning", 0.08, 0.98, ["summarize", "vision"]),
      candidate("frontier", "cloud_frontier", 0.20, 0.999, ["summarize", "vision"]),
    ],
  });
  assert.strictEqual(skipsUnreliableAndIncapable.routeId, "reasoning");

  const restrictedDataStaysOffCloudByDefault = routeExecution({
    request: {
      requiredCapabilities: ["summarize"],
      dataClassification: "restricted",
    },
    policy,
    candidates: [
      candidate("cloud", "cloud_routine", 0.01, 0.99),
      candidate("local", "local_inference", 0.02, 0.98),
    ],
  });
  assert.strictEqual(restrictedDataStaysOffCloudByDefault.routeId, "local");

  const noRoute = routeExecution({
    request: {
      requiredCapabilities: ["vision"],
      dataClassification: "restricted",
    },
    policy,
    candidates: [candidate("cloud", "cloud_routine", 0.01, 0.99, ["vision"])],
  });
  assert.strictEqual(noRoute.decision, "no_route_available");
  assert.strictEqual(noRoute.routeId, null);

  const reconfiguredPolicy = normalizeRoutingPolicy({
    policyVersion: "routing-v2-test",
    orderedTiers: ["cloud_reasoning", "cloud_routine"],
    minimumReliability: 0.95,
  });
  const changedWithoutWorkflowChange = routeExecution({
    request: { requiredCapabilities: ["summarize"] },
    policy: reconfiguredPolicy,
    candidates: [
      candidate("routine", "cloud_routine", 0.01, 0.99),
      candidate("reasoning", "cloud_reasoning", 0.08, 0.99),
    ],
  });
  assert.strictEqual(changedWithoutWorkflowChange.routeId, "reasoning");
  assert.strictEqual(changedWithoutWorkflowChange.policyVersion, "routing-v2-test");

  assert.throws(
    () => routeExecution({ request: {}, candidates: [candidate("bad", "cloud_routine", 0.01, 1.2)] }),
    /finite number in \[0, 1\]/
  );

  console.log("intelligence router tests passed");
}

run();
