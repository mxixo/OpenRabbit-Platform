import type { ApiRequestEnvelope } from "./contracts.js";
import type { PlatformApiRouteResult } from "./platform-api.js";
import type { EntityResolutionService, ResolutionDecision, ResolutionTargetType } from "./entity-resolution.js";

function parts(path: string): string[] { return path.split("?")[0].split("/").filter(Boolean); }
function invalid(message: string, code = "INVALID_RESOLUTION_REQUEST"): PlatformApiRouteResult {
  return { matched: true, status: 400, error: { code, message } };
}

export async function routeEntityResolutionApi(
  request: ApiRequestEnvelope,
  resolver: EntityResolutionService
): Promise<PlatformApiRouteResult> {
  const method = request.method.toUpperCase();
  const path = parts(request.path);
  if (path[0] !== "v1" || path[1] !== "orgs" || !path[2] || path[3] !== "resolution") return { matched: false };
  const orgId = path[2];

  if (method === "GET" && path[4] === "email" && path[5] && path.length === 6) {
    try {
      return { matched: true, status: 200, data: await resolver.inspectEmail(orgId, path[5]) };
    } catch (error) {
      return { matched: true, status: 404, error: { code: "RESOLUTION_SUBJECT_NOT_FOUND", message: error instanceof Error ? error.message : "Resolution subject not found" } };
    }
  }

  if (method === "POST" && path[4] === "email" && path[5] && path[6] === "apply-high-confidence" && path.length === 7) {
    try {
      return { matched: true, status: 200, data: await resolver.resolveEmail(orgId, path[5]) };
    } catch (error) {
      return { matched: true, status: 404, error: { code: "RESOLUTION_SUBJECT_NOT_FOUND", message: error instanceof Error ? error.message : "Resolution subject not found" } };
    }
  }

  if (method === "POST" && path[4] === "email" && path[5] && path[6] === "decision" && path.length === 7) {
    const body = (request.body ?? {}) as Partial<{
      targetType: ResolutionTargetType;
      targetId: string;
      decision: ResolutionDecision;
      actorId: string;
    }>;
    if (!body.targetType || !["relationship", "property"].includes(body.targetType)) return invalid("valid targetType is required", "RESOLUTION_TARGET_TYPE_REQUIRED");
    if (!body.targetId?.trim()) return invalid("targetId is required", "RESOLUTION_TARGET_ID_REQUIRED");
    if (!body.decision || !["accepted", "rejected"].includes(body.decision)) return invalid("decision must be accepted or rejected", "RESOLUTION_DECISION_REQUIRED");
    try {
      return {
        matched: true,
        status: 200,
        data: await resolver.decideEmailCandidate({
          orgId,
          emailId: path[5],
          targetType: body.targetType,
          targetId: body.targetId.trim(),
          decision: body.decision,
          actorId: body.actorId
        })
      };
    } catch (error) {
      return { matched: true, status: 404, error: { code: "RESOLUTION_CANDIDATE_NOT_FOUND", message: error instanceof Error ? error.message : "Resolution candidate not found" } };
    }
  }

  if (method === "GET" && path[4] === "feedback" && path.length === 5) {
    const query = new URLSearchParams(request.path.split("?")[1] ?? "");
    return { matched: true, status: 200, data: await resolver.listFeedback(orgId, query.get("emailId") ?? undefined) };
  }

  return { matched: false };
}
