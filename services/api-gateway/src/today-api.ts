import type { ApiRequestEnvelope } from "./contracts.js";
import type { PlatformApiBackend, PlatformApiRouteResult } from "./platform-api.js";
import type { EnvironmentActionRecord, InMemoryContextGraphStore } from "./context-graph.js";

export interface TodaySurfaceSummary {
  date: string;
  workers: Awaited<ReturnType<PlatformApiBackend["listWorkers"]>>;
  approvals: Awaited<ReturnType<PlatformApiBackend["listApprovals"]>>;
  pendingApprovals: Awaited<ReturnType<PlatformApiBackend["listApprovals"]>>;
  audit: Awaited<ReturnType<PlatformApiBackend["listAudit"]>>;
  environmentActions: EnvironmentActionRecord[];
  planItems: Awaited<ReturnType<NonNullable<PlatformApiBackend["listPlanItems"]>>>;
  summary: {
    pendingApprovals: number;
    agentActionsToday: number;
    scheduledItems: number;
    activeWorkers: number;
  };
}

function parsePath(path: string): { parts: string[]; date?: string } {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  return {
    parts: pathname.split("/").filter(Boolean),
    date: params.get("date") ?? undefined
  };
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length < 10) return undefined;
  return value.slice(0, 10);
}

function recordDate(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return (
    isoDate(record.timestamp) ??
    isoDate(record.createdAt) ??
    isoDate(record.updatedAt) ??
    isoDate(record.completedAt) ??
    isoDate(record.requestedAt)
  );
}

export async function routeTodayApi(
  request: ApiRequestEnvelope,
  backend: PlatformApiBackend,
  contextGraph?: InMemoryContextGraphStore
): Promise<PlatformApiRouteResult> {
  const { parts, date: requestedDate } = parsePath(request.path);
  if (
    request.method.toUpperCase() !== "GET" ||
    parts.length !== 4 ||
    parts[0] !== "v1" ||
    parts[1] !== "orgs" ||
    !parts[2] ||
    parts[3] !== "today"
  ) {
    return { matched: false };
  }

  const orgId = parts[2];
  const date = requestedDate ?? new Date().toISOString().slice(0, 10);
  const [workers, approvals, allAudit, planItems, environmentActions] = await Promise.all([
    backend.listWorkers(orgId),
    backend.listApprovals(orgId),
    backend.listAudit(orgId),
    backend.listPlanItems ? backend.listPlanItems(orgId, date) : Promise.resolve([]),
    contextGraph ? contextGraph.listActions(orgId, date) : Promise.resolve([])
  ]);

  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");
  const pendingEnvironmentActions = environmentActions.filter((action) => action.status === "pending_approval");
  const audit = allAudit.filter((record) => recordDate(record) === date);
  const activeWorkers = workers.filter(
    (worker) => worker.status === undefined || worker.status === "active"
  ).length;

  const data: TodaySurfaceSummary = {
    date,
    workers,
    approvals,
    pendingApprovals,
    audit,
    environmentActions,
    planItems,
    summary: {
      pendingApprovals: pendingApprovals.length + pendingEnvironmentActions.length,
      agentActionsToday: audit.length + environmentActions.filter((action) => action.actorType !== "user").length,
      scheduledItems: planItems.length,
      activeWorkers
    }
  };

  return { matched: true, status: 200, data };
}
