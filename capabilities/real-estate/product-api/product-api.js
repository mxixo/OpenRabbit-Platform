"use strict";

function parts(path) {
  return path.split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
}

function errorStatus(error) {
  const message = error instanceof Error ? error.message : "Request failed";
  if (message.includes("not found") || message.includes("not allowed")) return 404;
  if (message.includes("requires approved") || message.includes("already")) return 409;
  return 400;
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
      return { status: 404, error: { code: "ROUTE_NOT_FOUND", message: "Route not found" } };
    }
    const orgId = route[2];
    try {
      if (verb === "POST" && route.length === 4 && route[3] === "deals") {
        return { status: 201, data: await this.durableService.createDeal({ ...body, orgId }) };
      }
      if (verb === "GET" && route.length === 5 && route[3] === "deals") {
        const deal = await this.durableService.getDeal(orgId, route[4]);
        return deal
          ? { status: 200, data: deal }
          : { status: 404, error: { code: "DEAL_NOT_FOUND", message: `Deal not found: ${route[4]}` } };
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
      return { status: 404, error: { code: "ROUTE_NOT_FOUND", message: "Route not found" } };
    } catch (error) {
      return {
        status: errorStatus(error),
        error: {
          code: "PRODUCT_API_ERROR",
          message: error instanceof Error ? error.message : "Request failed",
        },
      };
    }
  }
}

module.exports = { RealEstateProductApi };
