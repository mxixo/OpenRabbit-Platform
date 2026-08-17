"use strict";

const { buildDealWorkspace } = require("./deal-workspace");

function parts(path) {
  return path.split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
}

function extractField(message) {
  const match = String(message || "").match(/\b(input\.[A-Za-z0-9_.]+|message\.[A-Za-z0-9_.]+)\b/);
  return match ? match[1] : undefined;
}

function normalizeProductError(error) {
  const message = error instanceof Error ? error.message : "Request failed";
  const lower = message.toLowerCase();
  const field = extractField(message);

  if (lower.includes("not found")) {
    return { status: 404, error: { code: "RESOURCE_NOT_FOUND", message, retryable: false } };
  }
  if (lower.includes("not allowed")) {
    return { status: 403, error: { code: "ACTION_FORBIDDEN", message, retryable: false } };
  }
  if (lower.includes("requires approved")) {
    return { status: 409, error: { code: "APPROVAL_REQUIRED", message, retryable: false } };
  }
  if (lower.includes("already")) {
    return { status: 409, error: { code: "STATE_CONFLICT", message, retryable: false } };
  }
  if (
    lower.includes("required") ||
    lower.includes("must be") ||
    lower.includes("is invalid") ||
    lower.includes("must be greater") ||
    lower.includes("must be at least") ||
    lower.includes("must be no greater")
  ) {
    return {
      status: 400,
      error: {
        code: "VALIDATION_ERROR",
        message,
        ...(field ? { field } : {}),
        retryable: false,
      },
    };
  }

  return {
    status: 500,
    error: {
      code: "INTERNAL_ERROR",
      message: "Request failed",
      retryable: true,
    },
  };
}

class RealEstateProductApi {
  constructor({ durableService, repository, outreachService }) {
    this.durableService = durableService;
    this.repository = repository;
    this.outreachService = outreachService;
  }

  async handle({ method, path, body = {}, actorId }) {
    const route = parts(path);
    const verb = String(method || "").toUpperCase();
    if (route[0] !== "v1" || route[1] !== "orgs" || !route[2]) {
      return { status: 404, error: { code: "ROUTE_NOT_FOUND", message: "Route not found", retryable: false } };
    }
    const orgId = route[2];
    try {
      if (verb === "GET" && route.length === 4 && route[3] === "deals") {
        return { status: 200, data: await this.repository.listDeals(orgId) };
      }
      if (verb === "POST" && route.length === 4 && route[3] === "deals") {
        return { status: 201, data: await this.durableService.createDeal({ ...body, orgId }) };
      }
      if (verb === "GET" && route.length === 5 && route[3] === "deals") {
        const deal = await this.durableService.getDeal(orgId, route[4]);
        return deal
          ? { status: 200, data: deal }
          : { status: 404, error: { code: "DEAL_NOT_FOUND", message: `Deal not found: ${route[4]}`, retryable: false } };
      }
      if (verb === "GET" && route.length === 6 && route[3] === "deals" && route[5] === "workspace") {
        return {
          status: 200,
          data: await buildDealWorkspace({
            repository: this.repository,
            durableService: this.durableService,
            orgId,
            dealId: route[4],
          }),
        };
      }
      if (verb === "POST" && route.length === 6 && route[3] === "deals" && route[5] === "underwriting-runs") {
        return { status: 201, data: await this.durableService.runUnderwriting({ orgId, dealId: route[4], ...body }) };
      }
      if (verb === "GET" && route.length === 6 && route[3] === "deals" && route[5] === "underwriting-runs") {
        return { status: 200, data: await this.durableService.listRuns(orgId, route[4]) };
      }
      if (verb === "POST" && route.length === 6 && route[3] === "deals" && route[5] === "outreach-approvals") {
        return {
          status: 201,
          data: await this.outreachService.request({ ...body, orgId, dealId: route[4], requestedBy: actorId }),
        };
      }
      if (verb === "POST" && route.length === 6 && route[3] === "approvals" && route[5] === "decision") {
        return {
          status: 200,
          data: await this.outreachService.decide({
            orgId, approvalId: route[4], decision: body.decision, decidedBy: actorId,
          }),
        };
      }
      if (verb === "POST" && route.length === 6 && route[3] === "approvals" && route[5] === "execute") {
        return { status: 200, data: await this.outreachService.execute({ orgId, approvalId: route[4] }) };
      }
      if (verb === "GET" && route.length === 4 && route[3] === "approvals") {
        return { status: 200, data: await this.repository.listApprovals(orgId) };
      }
      if (verb === "GET" && route.length === 4 && route[3] === "audit") {
        return { status: 200, data: await this.repository.listAudit(orgId) };
      }
      return { status: 404, error: { code: "ROUTE_NOT_FOUND", message: "Route not found", retryable: false } };
    } catch (error) {
      return normalizeProductError(error);
    }
  }
}

module.exports = { RealEstateProductApi, normalizeProductError };
