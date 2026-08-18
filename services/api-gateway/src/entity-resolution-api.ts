import type { ApiRequestEnvelope } from "./contracts.js";
import type { PlatformApiRouteResult } from "./platform-api.js";
import type { EntityResolutionService } from "./entity-resolution.js";

function parts(path: string): string[] { return path.split("?")[0].split("/").filter(Boolean); }

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

  return { matched: false };
}
