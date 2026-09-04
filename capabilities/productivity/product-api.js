"use strict";

function parts(path) {
  return path.split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
}

function errorResponse(error) {
  const message = error instanceof Error ? error.message : "Request failed";
  const lower = message.toLowerCase();
  if (lower.includes("not found")) return { status: 404, error: { code: "RESOURCE_NOT_FOUND", message, retryable: false } };
  if (lower.includes("approved before execution") || lower.includes("cannot change") || lower.includes("cannot edit")) {
    return { status: 409, error: { code: "STATE_CONFLICT", message, retryable: false } };
  }
  if (lower.includes("required")) return { status: 400, error: { code: "VALIDATION_ERROR", message, retryable: false } };
  return { status: 500, error: { code: "INTERNAL_ERROR", message: "Request failed", retryable: true } };
}

class ProductivityProductApi {
  constructor({ meetingWorkflow }) {
    if (!meetingWorkflow) throw new Error("meetingWorkflow is required");
    this.meetingWorkflow = meetingWorkflow;
  }

  async handle({ method, path, body = {}, actorId }) {
    const route = parts(path);
    const verb = String(method || "").toUpperCase();
    if (route[0] !== "v1" || route[1] !== "orgs" || !route[2]) return { status: 404, error: { code: "ROUTE_NOT_FOUND", message: "Route not found", retryable: false } };
    const orgId = route[2];
    try {
      if (verb === "POST" && route.length === 5 && route[3] === "meeting-proposals" && route[4] === "scan") {
        return { status: 201, data: await this.meetingWorkflow.scanMail({ orgId, actorId, query: body.query, limit: body.limit }) };
      }
      if (verb === "GET" && route.length === 4 && route[3] === "meeting-proposals") {
        return { status: 200, data: this.meetingWorkflow.list(body.status) };
      }
      if (route.length === 5 && route[3] === "meeting-proposals") {
        const id = route[4];
        if (verb === "PATCH") return { status: 200, data: this.meetingWorkflow.edit(id, body.event || body, actorId) };
      }
      if (verb === "POST" && route.length === 6 && route[3] === "meeting-proposals") {
        const id = route[4];
        if (route[5] === "approve") return { status: 200, data: this.meetingWorkflow.approve(id, actorId) };
        if (route[5] === "reject") return { status: 200, data: this.meetingWorkflow.reject(id, actorId) };
        if (route[5] === "execute") return { status: 200, data: await this.meetingWorkflow.execute(id, actorId) };
      }
      return { status: 404, error: { code: "ROUTE_NOT_FOUND", message: "Route not found", retryable: false } };
    } catch (error) {
      return errorResponse(error);
    }
  }
}

module.exports = { ProductivityProductApi, errorResponse };
