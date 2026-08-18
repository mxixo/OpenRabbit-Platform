import type { ApiRequestEnvelope } from "./contracts.js";
import type { PlatformApiRouteResult } from "./platform-api.js";
import type { InMemorySocialStore, SocialAutonomyMode, SocialPostStatus } from "./social-adapter.js";

const MODES = new Set<SocialAutonomyMode>(["draft_only", "approval_required", "trusted_autopilot"]);
const STATUSES = new Set<SocialPostStatus>(["draft", "pending_approval", "scheduled", "published", "failed"]);

function parts(path: string): string[] {
  return path.split("?")[0].split("/").filter(Boolean);
}

function invalid(message: string, code = "INVALID_SOCIAL_REQUEST"): PlatformApiRouteResult {
  return { matched: true, status: 400, error: { code, message } };
}

export async function routeSocialApi(request: ApiRequestEnvelope, store: InMemorySocialStore): Promise<PlatformApiRouteResult> {
  const method = request.method.toUpperCase();
  const path = parts(request.path);
  if (path[0] !== "v1" || path[1] !== "orgs" || !path[2] || path[3] !== "social") return { matched: false };
  const orgId = path[2];

  if (path[4] === "posts") {
    if (method === "GET" && path.length === 5) {
      return { matched: true, status: 200, data: await store.list(orgId) };
    }
    if (method === "POST" && path.length === 5) {
      const body = (request.body ?? {}) as Partial<{
        title: string;
        network: string;
        body: string;
        campaign: string;
        summary: string;
        scheduledAt: string;
        relationshipId: string;
        propertyId: string;
        createdBy: "user" | "worker";
        status: "draft" | "pending_approval" | "scheduled";
      }>;
      if (!body.network?.trim()) return invalid("network is required", "SOCIAL_NETWORK_REQUIRED");
      if (!body.body?.trim()) return invalid("post body is required", "SOCIAL_BODY_REQUIRED");
      return { matched: true, status: 201, data: await store.create(orgId, body) };
    }
    if (method === "GET" && path.length === 6) {
      const post = await store.get(orgId, path[5]);
      return post
        ? { matched: true, status: 200, data: post }
        : { matched: true, status: 404, error: { code: "SOCIAL_POST_NOT_FOUND", message: "Social post not found" } };
    }
    if (method === "PATCH" && path.length === 6) {
      const body = (request.body ?? {}) as Partial<{
        title: string;
        body: string;
        campaign: string;
        scheduledAt: string;
        status: SocialPostStatus;
        summary: string;
      }>;
      if (body.status && !STATUSES.has(body.status)) return invalid("invalid social post status", "INVALID_SOCIAL_POST_STATUS");
      try {
        return { matched: true, status: 200, data: await store.update(orgId, path[5], body) };
      } catch (error) {
        return { matched: true, status: 404, error: { code: "SOCIAL_POST_NOT_FOUND", message: error instanceof Error ? error.message : "Social post not found" } };
      }
    }
  }

  if (path[4] === "policy") {
    if (method === "GET" && path.length === 5) {
      return { matched: true, status: 200, data: await store.getPolicy(orgId) };
    }
    if (method === "PUT" && path.length === 5) {
      const body = (request.body ?? {}) as Partial<{
        autonomyMode: SocialAutonomyMode;
        allowedNetworks: string[];
        maxPostsPerDay: number;
        approvalRequiredForNetworks: string[];
        quietHours: { start: string; end: string };
      }>;
      if (body.autonomyMode && !MODES.has(body.autonomyMode)) return invalid("invalid autonomy mode", "INVALID_SOCIAL_AUTONOMY_MODE");
      if (body.allowedNetworks && !Array.isArray(body.allowedNetworks)) return invalid("allowedNetworks must be an array");
      if (body.approvalRequiredForNetworks && !Array.isArray(body.approvalRequiredForNetworks)) return invalid("approvalRequiredForNetworks must be an array");
      if (body.maxPostsPerDay !== undefined && (!Number.isFinite(body.maxPostsPerDay) || body.maxPostsPerDay < 1)) return invalid("maxPostsPerDay must be at least 1");
      return { matched: true, status: 200, data: await store.setPolicy(orgId, body) };
    }
  }

  return { matched: false };
}
