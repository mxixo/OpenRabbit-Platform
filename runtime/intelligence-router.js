"use strict";

const ROUTE_TIERS = Object.freeze([
  "deterministic",
  "local_inference",
  "cloud_routine",
  "cloud_reasoning",
  "cloud_frontier",
]);

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function finiteProbability(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be a finite number in [0, 1]`);
  }
  return value;
}

function nonNegativeNumber(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number`);
  }
  return value;
}

function normalizeCapabilityList(value, name) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return [...new Set(value.map((item, index) => requiredString(item, `${name}[${index}]`)))].sort();
}

function normalizeRoutingPolicy(input = {}) {
  const orderedTiers = input.orderedTiers === undefined ? [...ROUTE_TIERS] : [...input.orderedTiers];
  if (!orderedTiers.length) throw new Error("orderedTiers must not be empty");
  for (const tier of orderedTiers) {
    if (!ROUTE_TIERS.includes(tier)) throw new Error(`unsupported routing tier: ${tier}`);
  }
  if (new Set(orderedTiers).size !== orderedTiers.length) {
    throw new Error("orderedTiers must not contain duplicates");
  }
  return Object.freeze({
    policyVersion: requiredString(input.policyVersion || "routing-v1", "policyVersion"),
    orderedTiers: Object.freeze(orderedTiers),
    minimumReliability: finiteProbability(
      input.minimumReliability === undefined ? 0.95 : input.minimumReliability,
      "minimumReliability"
    ),
    allowCloudForRestrictedData: input.allowCloudForRestrictedData === true,
  });
}

function normalizeCandidate(input) {
  if (!input || typeof input !== "object") throw new Error("routing candidate is required");
  const tier = requiredString(input.tier, "candidate.tier");
  if (!ROUTE_TIERS.includes(tier)) throw new Error(`unsupported routing tier: ${tier}`);
  const candidate = {
    routeId: requiredString(input.routeId, "candidate.routeId"),
    tier,
    available: input.available !== false,
    reliability: finiteProbability(input.reliability, "candidate.reliability"),
    estimatedVariableCostUsd: nonNegativeNumber(
      input.estimatedVariableCostUsd,
      "candidate.estimatedVariableCostUsd"
    ),
    capabilities: normalizeCapabilityList(input.capabilities, "candidate.capabilities"),
    cloud: tier.startsWith("cloud_"),
  };
  if (input.provider) candidate.provider = requiredString(input.provider, "candidate.provider");
  if (input.model) candidate.model = requiredString(input.model, "candidate.model");
  return Object.freeze(candidate);
}

function supportsAll(candidate, requiredCapabilities) {
  const supported = new Set(candidate.capabilities);
  return requiredCapabilities.every((capability) => supported.has(capability));
}

function routeExecution({ request, candidates, policy } = {}) {
  if (!request || typeof request !== "object") throw new Error("routing request is required");
  if (!Array.isArray(candidates) || !candidates.length) {
    throw new Error("at least one routing candidate is required");
  }
  const normalizedPolicy = normalizeRoutingPolicy(policy);
  const requiredCapabilities = normalizeCapabilityList(
    request.requiredCapabilities,
    "request.requiredCapabilities"
  );
  const dataClassification = request.dataClassification || "standard";
  if (!["standard", "restricted"].includes(dataClassification)) {
    throw new Error("dataClassification must be standard or restricted");
  }

  const normalizedCandidates = candidates.map(normalizeCandidate);
  const eligible = normalizedCandidates.filter((candidate) => {
    if (!candidate.available) return false;
    if (candidate.reliability < normalizedPolicy.minimumReliability) return false;
    if (!supportsAll(candidate, requiredCapabilities)) return false;
    if (
      dataClassification === "restricted" &&
      candidate.cloud &&
      !normalizedPolicy.allowCloudForRestrictedData
    ) {
      return false;
    }
    return normalizedPolicy.orderedTiers.includes(candidate.tier);
  });

  for (const tier of normalizedPolicy.orderedTiers) {
    const tierCandidates = eligible
      .filter((candidate) => candidate.tier === tier)
      .sort((a, b) => {
        if (a.estimatedVariableCostUsd !== b.estimatedVariableCostUsd) {
          return a.estimatedVariableCostUsd - b.estimatedVariableCostUsd;
        }
        if (a.reliability !== b.reliability) return b.reliability - a.reliability;
        return a.routeId.localeCompare(b.routeId);
      });
    if (tierCandidates.length) {
      const selected = tierCandidates[0];
      return Object.freeze({
        decision: "routed",
        policyVersion: normalizedPolicy.policyVersion,
        routeId: selected.routeId,
        tier: selected.tier,
        provider: selected.provider || null,
        model: selected.model || null,
        reliability: selected.reliability,
        estimatedVariableCostUsd: selected.estimatedVariableCostUsd,
        requiredCapabilities: Object.freeze(requiredCapabilities),
        dataClassification,
      });
    }
  }

  return Object.freeze({
    decision: "no_route_available",
    policyVersion: normalizedPolicy.policyVersion,
    routeId: null,
    tier: null,
    provider: null,
    model: null,
    requiredCapabilities: Object.freeze(requiredCapabilities),
    dataClassification,
  });
}

module.exports = {
  ROUTE_TIERS,
  normalizeRoutingPolicy,
  normalizeCandidate,
  routeExecution,
};
