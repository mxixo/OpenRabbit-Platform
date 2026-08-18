import type { ApiRequestEnvelope } from "./contracts.js";
import type { PlatformApiRouteResult } from "./platform-api.js";
import type { ProviderSyncCoordinator, SyncSurface } from "./provider-sync.js";

const SURFACES = new Set<SyncSurface>(["email", "crm", "calendar", "property", "social"]);
function parts(path: string): string[] { return path.split("?")[0].split("/").filter(Boolean); }

export async function routeProviderSyncApi(request: ApiRequestEnvelope, sync: ProviderSyncCoordinator): Promise<PlatformApiRouteResult> {
  const method = request.method.toUpperCase();
  const path = parts(request.path);
  if (path[0] !== "v1" || path[1] !== "orgs" || !path[2] || path[3] !== "sync") return { matched: false };
  const orgId = path[2];

  if (method === "GET" && path.length === 5 && path[4] === "runs") {
    const query = new URLSearchParams(request.path.split("?")[1] ?? "");
    const provider = query.get("provider") ?? undefined;
    return { matched: true, status: 200, data: sync.state.listRuns(orgId, provider) };
  }

  if (method === "GET" && path.length === 6 && path[4] === "providers" && path[5]) {
    const provider = path[5].toLowerCase();
    return { matched: true, status: 200, data: { provider, registeredSurfaces: sync.registeredSurfaces(provider), runs: sync.state.listRuns(orgId, provider) } };
  }

  if (method === "POST" && path.length === 6 && path[4] === "providers" && path[5]) {
    const provider = path[5].toLowerCase();
    const body = (request.body ?? {}) as Partial<{ surfaces: string[]; startAt: string; endAt: string }>;
    const surfaces = body.surfaces?.map((value) => value.trim().toLowerCase());
    if (surfaces?.some((surface) => !SURFACES.has(surface as SyncSurface))) {
      return { matched: true, status: 400, error: { code: "INVALID_SYNC_SURFACE", message: "surfaces may only include email, crm, calendar, property, or social" } };
    }
    const runs = await sync.run({ orgId, provider, surfaces: surfaces as SyncSurface[] | undefined, window: { startAt: body.startAt, endAt: body.endAt } });
    const failed = runs.filter((run) => run.status === "failed");
    return { matched: true, status: failed.length ? 207 : 200, data: { provider, runs, failed: failed.length } };
  }

  return { matched: false };
}
