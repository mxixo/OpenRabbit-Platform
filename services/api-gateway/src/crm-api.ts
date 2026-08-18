import type { ApiRequestEnvelope } from "./contracts.js";
import type { PlatformApiRouteResult } from "./platform-api.js";
import type {
  CreateNativeCrmRelationshipInput,
  InMemoryNativeCrmStore,
  UpdateNativeCrmRelationshipInput
} from "./native-crm.js";

const PRIORITIES = new Set(["low", "medium", "high"]);

function parts(path: string): string[] {
  return path.split("?")[0].split("/").filter(Boolean);
}

function invalid(message: string, code = "INVALID_CRM_REQUEST"): PlatformApiRouteResult {
  return { matched: true, status: 400, error: { code, message } };
}

function parseCreate(body: unknown): CreateNativeCrmRelationshipInput | PlatformApiRouteResult {
  const value = (body ?? {}) as Partial<CreateNativeCrmRelationshipInput>;
  if (!value.displayName?.trim()) return invalid("displayName is required", "CRM_DISPLAY_NAME_REQUIRED");
  if (value.priority && !PRIORITIES.has(value.priority)) return invalid("priority must be low, medium, or high", "INVALID_CRM_PRIORITY");
  if (value.propertyIds && !Array.isArray(value.propertyIds)) return invalid("propertyIds must be an array", "INVALID_CRM_PROPERTY_IDS");
  if (value.tags && !Array.isArray(value.tags)) return invalid("tags must be an array", "INVALID_CRM_TAGS");
  return value as CreateNativeCrmRelationshipInput;
}

function parseUpdate(body: unknown): UpdateNativeCrmRelationshipInput | PlatformApiRouteResult {
  const value = (body ?? {}) as UpdateNativeCrmRelationshipInput;
  if (!Object.keys(value).length) return invalid("at least one CRM field is required", "EMPTY_CRM_UPDATE");
  if (value.priority && !PRIORITIES.has(value.priority)) return invalid("priority must be low, medium, or high", "INVALID_CRM_PRIORITY");
  if (value.propertyIds && !Array.isArray(value.propertyIds)) return invalid("propertyIds must be an array", "INVALID_CRM_PROPERTY_IDS");
  if (value.tags && !Array.isArray(value.tags)) return invalid("tags must be an array", "INVALID_CRM_TAGS");
  return value;
}

function isRouteResult(value: unknown): value is PlatformApiRouteResult {
  return Boolean(value && typeof value === "object" && "matched" in value);
}

export async function routeNativeCrmApi(
  request: ApiRequestEnvelope,
  store: InMemoryNativeCrmStore
): Promise<PlatformApiRouteResult> {
  const method = request.method.toUpperCase();
  const path = parts(request.path);
  if (path[0] !== "v1" || path[1] !== "orgs" || !path[2] || path[3] !== "crm" || path[4] !== "relationships") {
    return { matched: false };
  }

  const orgId = path[2];

  if (method === "GET" && path.length === 5) {
    return { matched: true, status: 200, data: await store.list(orgId) };
  }

  if (method === "POST" && path.length === 5) {
    const parsed = parseCreate(request.body);
    if (isRouteResult(parsed)) return parsed;
    try {
      return { matched: true, status: 201, data: await store.create(orgId, parsed) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "CRM relationship could not be created";
      return { matched: true, status: message.includes("already exists") ? 409 : 400, error: { code: message.includes("already exists") ? "CRM_RELATIONSHIP_EXISTS" : "INVALID_CRM_REQUEST", message } };
    }
  }

  if (path.length === 6) {
    const id = path[5];
    if (method === "GET") {
      const record = await store.get(orgId, id);
      return record
        ? { matched: true, status: 200, data: record }
        : { matched: true, status: 404, error: { code: "CRM_RELATIONSHIP_NOT_FOUND", message: `CRM relationship not found: ${id}` } };
    }
    if (method === "PATCH") {
      const parsed = parseUpdate(request.body);
      if (isRouteResult(parsed)) return parsed;
      try {
        return { matched: true, status: 200, data: await store.update(orgId, id, parsed) };
      } catch (error) {
        const message = error instanceof Error ? error.message : "CRM relationship could not be updated";
        return { matched: true, status: message.includes("not found") ? 404 : 400, error: { code: message.includes("not found") ? "CRM_RELATIONSHIP_NOT_FOUND" : "INVALID_CRM_REQUEST", message } };
      }
    }
    if (method === "DELETE") {
      const removed = await store.remove(orgId, id);
      return removed
        ? { matched: true, status: 200, data: { id, deleted: true } }
        : { matched: true, status: 404, error: { code: "CRM_RELATIONSHIP_NOT_FOUND", message: `CRM relationship not found: ${id}` } };
    }
  }

  return { matched: false };
}
