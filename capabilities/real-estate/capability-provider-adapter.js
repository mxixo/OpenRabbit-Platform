"use strict";

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function objectInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object");
  }
  return input;
}

function assertApiSuccess(response, capabilityId) {
  if (!response || typeof response.status !== "number") {
    throw new Error(`Invalid product API response for ${capabilityId}`);
  }
  if (response.status >= 400) {
    const message = response.error?.message || `Capability execution failed: ${capabilityId}`;
    throw new Error(message);
  }
  return response.data;
}

class RealEstateCapabilityProviderAdapter {
  constructor({ productApi }) {
    if (!productApi || typeof productApi.handle !== "function") {
      throw new Error("productApi.handle is required");
    }
    this.productApi = productApi;
    this.providerId = "openrabbit_real_estate";
  }

  isHealthy() {
    return true;
  }

  async execute(request) {
    const capabilityId = required(request?.capabilityId, "capabilityId");
    const orgId = required(request?.orgId, "orgId");
    const actorId = required(request?.actorId, "actorId");
    const input = objectInput(request?.input || {});
    const orgBase = `/v1/orgs/${encodeURIComponent(orgId)}`;

    switch (capabilityId) {
      case "work.deal_create": {
        const response = await this.productApi.handle({
          method: "POST",
          path: `${orgBase}/deals`,
          body: input,
          actorId,
        });
        return assertApiSuccess(response, capabilityId);
      }

      case "work.underwrite": {
        const dealId = required(input.dealId, "input.dealId");
        const { dealId: _dealId, ...body } = input;
        const response = await this.productApi.handle({
          method: "POST",
          path: `${orgBase}/deals/${encodeURIComponent(dealId)}/underwriting-runs`,
          body,
          actorId,
        });
        return assertApiSuccess(response, capabilityId);
      }

      case "work.deal_read": {
        const dealId = required(input.dealId, "input.dealId");
        const response = await this.productApi.handle({
          method: "GET",
          path: `${orgBase}/deals/${encodeURIComponent(dealId)}`,
          actorId,
        });
        return assertApiSuccess(response, capabilityId);
      }

      case "work.deal_compare": {
        const dealId = required(input.dealId, "input.dealId");
        const response = await this.productApi.handle({
          method: "GET",
          path: `${orgBase}/deals/${encodeURIComponent(dealId)}/workspace`,
          actorId,
        });
        const workspace = assertApiSuccess(response, capabilityId);
        return {
          dealId,
          latestRun: workspace.underwriting?.latestRun || null,
          versions: workspace.underwriting?.versions || [],
          runCount: workspace.underwriting?.runCount || 0,
        };
      }

      case "work.outreach_draft": {
        const dealId = required(input.dealId, "input.dealId");
        const message = objectInput(input.message);
        return {
          dealId,
          message: {
            recipient: required(message.recipient, "input.message.recipient").toLowerCase(),
            subject: required(message.subject, "input.message.subject"),
            body: required(message.body, "input.message.body"),
          },
          status: "draft",
          externalSideEffect: false,
        };
      }

      case "work.outreach_execute": {
        const approvalId = required(input.approvalId, "input.approvalId");
        const response = await this.productApi.handle({
          method: "POST",
          path: `${orgBase}/approvals/${encodeURIComponent(approvalId)}/execute`,
          body: {},
          actorId,
        });
        return assertApiSuccess(response, capabilityId);
      }

      default:
        throw new Error(`Unsupported real-estate capability: ${capabilityId}`);
    }
  }
}

module.exports = {
  RealEstateCapabilityProviderAdapter,
  assertApiSuccess,
};
