"use strict";

const SCOPES = Object.freeze({
  READ: "real-estate:read",
  DEAL_WRITE: "real-estate:deal:write",
  UNDERWRITE: "real-estate:underwrite",
  APPROVAL_REQUEST: "real-estate:approval:request",
  APPROVAL_DECIDE: "real-estate:approval:decide",
  ACTION_EXECUTE: "real-estate:action:execute",
  AUDIT_READ: "real-estate:audit:read",
});

function pathParts(path) {
  return String(path || "").split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
}

function requiredScopeForRequest(method, path) {
  const verb = String(method || "").toUpperCase();
  const route = pathParts(path);
  if (route[0] !== "v1" || route[1] !== "orgs" || !route[2]) return undefined;

  if (verb === "POST" && route.length === 4 && route[3] === "deals") return SCOPES.DEAL_WRITE;
  if (verb === "GET" && route[3] === "deals") return SCOPES.READ;
  if (verb === "POST" && route.length === 6 && route[3] === "deals" && route[5] === "underwriting-runs") return SCOPES.UNDERWRITE;
  if (verb === "POST" && route.length === 6 && route[3] === "deals" && route[5] === "outreach-approvals") return SCOPES.APPROVAL_REQUEST;
  if (verb === "POST" && route.length === 6 && route[3] === "approvals" && route[5] === "decision") return SCOPES.APPROVAL_DECIDE;
  if (verb === "POST" && route.length === 6 && route[3] === "approvals" && route[5] === "execute") return SCOPES.ACTION_EXECUTE;
  if (verb === "GET" && route.length === 4 && route[3] === "approvals") return SCOPES.READ;
  if (verb === "GET" && route.length === 4 && route[3] === "audit") return SCOPES.AUDIT_READ;
  return undefined;
}

function hasScope(principal, requiredScope) {
  if (!requiredScope) return true;
  const scopes = Array.isArray(principal?.scopes) ? principal.scopes : [];
  return scopes.includes("*") || scopes.includes(requiredScope);
}

module.exports = { SCOPES, requiredScopeForRequest, hasScope };
