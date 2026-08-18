import type { ApiRequestEnvelope } from "./contracts.js";
import type { PlatformApiRouteResult } from "./platform-api.js";
import { InMemoryContextGraphStore } from "./context-graph.js";

function parts(path: string): string[] { return path.split("?")[0].split("/").filter(Boolean); }
function query(path: string): URLSearchParams { return new URLSearchParams(path.split("?")[1] ?? ""); }
function invalid(message: string, code = "INVALID_CONTEXT_REQUEST"): PlatformApiRouteResult { return { matched: true, status: 400, error: { code, message } }; }

export async function routeContextApi(request: ApiRequestEnvelope, store: InMemoryContextGraphStore): Promise<PlatformApiRouteResult> {
  const method = request.method.toUpperCase();
  const path = parts(request.path);
  if (path[0] !== "v1" || path[1] !== "orgs" || !path[2]) return { matched: false };
  const orgId = path[2];

  if (path[3] === "context" && path[4] === "links") {
    if (method === "GET" && path.length === 5) {
      const params = query(request.path);
      const type = params.get("entityType"); const id = params.get("entityId");
      return { matched: true, status: 200, data: await store.listLinks(orgId, type && id ? { type: type as never, id } : undefined) };
    }
    if (method === "POST" && path.length === 5) {
      const body = request.body as any;
      if (!body?.from?.type || !body?.from?.id || !body?.to?.type || !body?.to?.id || !body?.relation) return invalid("from, to, and relation are required");
      return { matched: true, status: 201, data: await store.addLink(orgId, body) };
    }
  }

  if (path[3] === "context" && path[4] === "neighborhood" && method === "GET") {
    const params = query(request.path);
    const type = params.get("entityType"); const id = params.get("entityId");
    if (!type || !id) return invalid("entityType and entityId are required");
    return { matched: true, status: 200, data: await store.neighborhood(orgId, { type: type as never, id }) };
  }

  if (path[3] === "actions") {
    if (method === "GET" && path.length === 4) return { matched: true, status: 200, data: await store.listActions(orgId, query(request.path).get("date") ?? undefined) };
    if (method === "POST" && path.length === 4) {
      const body = request.body as any;
      if (!body?.actionType || !body?.status || !body?.actorType || !body?.summary) return invalid("actionType, status, actorType, and summary are required", "INVALID_ENVIRONMENT_ACTION");
      return { matched: true, status: 201, data: await store.recordAction(orgId, { ...body, entities: Array.isArray(body.entities) ? body.entities : [] }) };
    }
    if (method === "PATCH" && path.length === 5) {
      try { return { matched: true, status: 200, data: await store.updateAction(orgId, path[4], request.body as any) }; }
      catch (error) { return { matched: true, status: 404, error: { code: "ENVIRONMENT_ACTION_NOT_FOUND", message: error instanceof Error ? error.message : "Environment action not found" } }; }
    }
  }

  return { matched: false };
}
