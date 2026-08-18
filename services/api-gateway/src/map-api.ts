import type { ApiRequestEnvelope } from "./contracts.js";
import type { PlatformApiRouteResult } from "./platform-api.js";
import type { InMemoryPropertyStore, MapBounds, PropertyProviderRecord } from "./map-adapter.js";
import type { InMemoryContextGraphStore } from "./context-graph.js";
import { autoLinkRecordContext } from "./context-auto-link.js";

function parts(path: string): string[] { return path.split("?")[0].split("/").filter(Boolean); }
function invalid(message: string, code = "INVALID_MAP_REQUEST"): PlatformApiRouteResult { return { matched: true, status: 400, error: { code, message } }; }
function parseBounds(path: string): MapBounds | undefined {
  const query = new URLSearchParams(path.split("?")[1] ?? "");
  const raw = [query.get("north"), query.get("south"), query.get("east"), query.get("west")];
  if (raw.every((value) => value === null)) return undefined;
  const [north, south, east, west] = raw.map((value) => Number(value));
  if (![north, south, east, west].every(Number.isFinite) || north < south || east < west) return undefined;
  return { north, south, east, west };
}

export async function routeMapApi(
  request: ApiRequestEnvelope,
  store: InMemoryPropertyStore,
  graph?: InMemoryContextGraphStore
): Promise<PlatformApiRouteResult> {
  const method = request.method.toUpperCase();
  const path = parts(request.path);
  if (path[0] !== "v1" || path[1] !== "orgs" || !path[2] || path[3] !== "map") return { matched: false };
  const orgId = path[2];

  if (method === "GET" && path.length === 5 && path[4] === "items") {
    const bounds = parseBounds(request.path);
    const hasAnyBound = ["north", "south", "east", "west"].some((key) => new URLSearchParams(request.path.split("?")[1] ?? "").has(key));
    if (hasAnyBound && !bounds) return invalid("north, south, east, and west must be valid map bounds", "INVALID_MAP_BOUNDS");
    return { matched: true, status: 200, data: await store.list(orgId, bounds) };
  }
  if (method === "GET" && path.length === 6 && path[4] === "items") {
    const item = await store.get(orgId, path[5]);
    return item ? { matched: true, status: 200, data: item } : { matched: true, status: 404, error: { code: "MAP_ITEM_NOT_FOUND", message: `Map item not found: ${path[5]}` } };
  }
  if (method === "POST" && path.length === 5 && path[4] === "import") {
    const body = (request.body ?? {}) as Partial<{ provider: string; records: PropertyProviderRecord[] }>;
    if (!body.provider?.trim()) return invalid("provider is required", "MAP_PROVIDER_REQUIRED");
    if (!Array.isArray(body.records)) return invalid("records must be an array", "INVALID_MAP_RECORDS");
    try {
      const result = await store.import({ orgId, provider: body.provider, records: body.records });
      if (graph) {
        for (const item of result.items) {
          await autoLinkRecordContext(graph, orgId, { type: "property", id: item.id, label: item.label }, { relationshipIds: item.relationshipIds });
        }
      }
      return { matched: true, status: 200, data: result };
    } catch (error) {
      return invalid(error instanceof Error ? error.message : "map import failed", "INVALID_MAP_RECORD");
    }
  }
  return { matched: false };
}
