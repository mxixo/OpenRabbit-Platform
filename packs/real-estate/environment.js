"use strict";

const ENVIRONMENT_PROTOCOL = "environment_blueprint_v1";
const REAL_ESTATE_PACK_ID = "pack.real-estate";

function requireText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function environmentUrl(baseUrl, orgId) {
  const base = requireText(baseUrl, "baseUrl").replace(/\/+$/, "");
  const organization = requireText(orgId, "orgId");
  return `${base}/v1/orgs/${encodeURIComponent(organization)}/environment`;
}

function unwrapEnvironmentPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("environment API returned an invalid response body");
  }

  if (payload.protocol === ENVIRONMENT_PROTOCOL) return payload;
  if (payload.result && payload.result.protocol === ENVIRONMENT_PROTOCOL) {
    return payload.result;
  }
  if (
    payload.data &&
    typeof payload.data === "object" &&
    payload.data.result &&
    payload.data.result.protocol === ENVIRONMENT_PROTOCOL
  ) {
    return payload.data.result;
  }

  throw new Error("environment API did not return environment_blueprint_v1");
}

function validateRealEstateEnvironment(blueprint, expectedOrgId) {
  if (!blueprint || typeof blueprint !== "object" || Array.isArray(blueprint)) {
    throw new Error("environment blueprint must be an object");
  }
  if (blueprint.protocol !== ENVIRONMENT_PROTOCOL) {
    throw new Error("environment blueprint protocol is unsupported");
  }

  const orgId = requireText(blueprint.orgId, "blueprint.orgId");
  if (orgId !== requireText(expectedOrgId, "expectedOrgId")) {
    throw new Error("environment blueprint belongs to a different organization");
  }
  if (typeof blueprint.revision !== "string" || blueprint.revision.trim() === "") {
    throw new Error("environment blueprint revision is required");
  }
  if (typeof blueprint.generatedAt !== "string" || blueprint.generatedAt.trim() === "") {
    throw new Error("environment blueprint generatedAt is required");
  }
  if (!Array.isArray(blueprint.packs)) {
    throw new Error("environment blueprint packs must be an array");
  }

  const pack = blueprint.packs.find((candidate) => candidate && candidate.id === REAL_ESTATE_PACK_ID);
  if (!pack || pack.state !== "enabled") {
    throw new Error("real estate pack is not enabled in the canonical environment blueprint");
  }

  return blueprint;
}

async function loadRealEstateEnvironment({ baseUrl, orgId, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation is required");
  }

  const url = environmentUrl(baseUrl, orgId);
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response || typeof response.ok !== "boolean") {
    throw new Error("environment API returned an invalid HTTP response");
  }
  if (!response.ok) {
    const status = Number.isInteger(response.status) ? response.status : "unknown";
    throw new Error(`environment API request failed with status ${status}`);
  }
  if (typeof response.json !== "function") {
    throw new Error("environment API response cannot be decoded as JSON");
  }

  const payload = await response.json();
  const blueprint = unwrapEnvironmentPayload(payload);
  return validateRealEstateEnvironment(blueprint, orgId);
}

module.exports = {
  ENVIRONMENT_PROTOCOL,
  REAL_ESTATE_PACK_ID,
  environmentUrl,
  loadRealEstateEnvironment,
  validateRealEstateEnvironment,
};
