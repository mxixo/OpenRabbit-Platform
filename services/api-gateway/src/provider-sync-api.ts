import type { ApiRequestEnvelope } from "./contracts.js";
import type { PlatformApiRouteResult } from "./platform-api.js";
import type { ProviderSyncCoordinator, SyncSurface } from "./provider-sync.js";
import type { ProviderSyncScheduler } from "./provider-sync-scheduler.js";

const SURFACES = new Set<SyncSurface>(["email", "crm", "calendar", "property", "social"]);
function parts(path: string): string[] { return path.split("?")[0].split("/").filter(Boolean); }
function parseSurfaces(value: unknown): SyncSurface[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("surfaces must be an array");
  const surfaces = value.map((item) => String(item).trim().toLowerCase());
  if (surfaces.some((surface) => !SURFACES.has(surface as SyncSurface))) throw new Error("surfaces may only include email, crm, calendar, property, or social");
  return surfaces as SyncSurface[];
}

export async function routeProviderSyncApi(request: ApiRequestEnvelope, sync: ProviderSyncCoordinator, scheduler?: ProviderSyncScheduler): Promise<PlatformApiRouteResult> {
  const method = request.method.toUpperCase();
  const path = parts(request.path);
  if (path[0] !== "v1" || path[1] !== "orgs" || !path[2] || path[3] !== "sync") return { matched: false };
  const orgId = path[2];

  if (method === "GET" && path.length === 5 && path[4] === "runs") {
    const query = new URLSearchParams(request.path.split("?")[1] ?? "");
    const provider = query.get("provider") ?? undefined;
    return { matched: true, status: 200, data: sync.state.listRuns(orgId, provider) };
  }

  if (method === "GET" && path.length === 5 && path[4] === "schedules") {
    return { matched: true, status: 200, data: scheduler?.list(orgId) ?? [] };
  }

  if (method === "POST" && path.length === 5 && path[4] === "schedules") {
    if (!scheduler) return { matched: true, status: 501, error: { code: "SYNC_SCHEDULER_NOT_AVAILABLE", message: "provider sync scheduler is not available" } };
    try {
      const body = (request.body ?? {}) as Partial<{ provider: string; surfaces: unknown; intervalMinutes: number; enabled: boolean }>;
      if (!body.provider?.trim()) return { matched: true, status: 400, error: { code: "SYNC_PROVIDER_REQUIRED", message: "provider is required" } };
      if (typeof body.intervalMinutes !== "number") return { matched: true, status: 400, error: { code: "SYNC_INTERVAL_REQUIRED", message: "intervalMinutes is required" } };
      return { matched: true, status: 201, data: scheduler.create({ orgId, provider: body.provider, surfaces: parseSurfaces(body.surfaces), intervalMinutes: body.intervalMinutes, enabled: body.enabled }) };
    } catch (error) {
      return { matched: true, status: 400, error: { code: "INVALID_SYNC_SCHEDULE", message: error instanceof Error ? error.message : "invalid sync schedule" } };
    }
  }

  if (path[4] === "schedules" && path[5]) {
    if (!scheduler) return { matched: true, status: 501, error: { code: "SYNC_SCHEDULER_NOT_AVAILABLE", message: "provider sync scheduler is not available" } };
    if (method === "PATCH" && path.length === 6) {
      try {
        const body = (request.body ?? {}) as Partial<{ surfaces: unknown; intervalMinutes: number; enabled: boolean }>;
        return { matched: true, status: 200, data: scheduler.update(orgId, path[5], { surfaces: parseSurfaces(body.surfaces), intervalMinutes: body.intervalMinutes, enabled: body.enabled }) };
      } catch (error) {
        return { matched: true, status: 404, error: { code: "SYNC_SCHEDULE_UPDATE_FAILED", message: error instanceof Error ? error.message : "sync schedule update failed" } };
      }
    }
    if (method === "DELETE" && path.length === 6) {
      return scheduler.remove(orgId, path[5]) ? { matched: true, status: 204, data: undefined } : { matched: true, status: 404, error: { code: "SYNC_SCHEDULE_NOT_FOUND", message: `Sync schedule not found: ${path[5]}` } };
    }
    if (method === "POST" && path.length === 7 && path[6] === "run-now") {
      try { return { matched: true, status: 200, data: await scheduler.runNow(orgId, path[5]) }; }
      catch (error) { return { matched: true, status: 404, error: { code: "SYNC_SCHEDULE_RUN_FAILED", message: error instanceof Error ? error.message : "sync schedule run failed" } }; }
    }
  }

  if (method === "GET" && path.length === 6 && path[4] === "providers" && path[5]) {
    const provider = path[5].toLowerCase();
    return { matched: true, status: 200, data: { provider, registeredSurfaces: sync.registeredSurfaces(provider), runs: sync.state.listRuns(orgId, provider), schedules: scheduler?.list(orgId).filter((schedule) => schedule.provider === provider) ?? [] } };
  }

  if (method === "POST" && path.length === 6 && path[4] === "providers" && path[5]) {
    const provider = path[5].toLowerCase();
    const body = (request.body ?? {}) as Partial<{ surfaces: unknown; startAt: string; endAt: string }>;
    try {
      const runs = await sync.run({ orgId, provider, surfaces: parseSurfaces(body.surfaces), window: { startAt: body.startAt, endAt: body.endAt } });
      const failed = runs.filter((run) => run.status === "failed");
      return { matched: true, status: failed.length ? 207 : 200, data: { provider, runs, failed: failed.length } };
    } catch (error) {
      return { matched: true, status: 400, error: { code: "PROVIDER_SYNC_FAILED", message: error instanceof Error ? error.message : "provider sync failed" } };
    }
  }

  return { matched: false };
}
