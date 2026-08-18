import type { AuditRecord, CalendarPlanItem } from "@openrabbit/runtime-core";
import type { ApiRequestEnvelope } from "./contracts.js";
import type { PlatformApiBackend, PlatformApiRouteResult } from "./platform-api.js";
import type {
  WorkspaceEmailItem,
  WorkspaceMapItem,
  WorkspaceRelationshipItem,
  WorkspaceSocialItem,
  WorkspaceSurfaceEnvelope,
  WorkspaceViewModel
} from "./workspace-contracts.js";

export interface WorkspaceDataBackend {
  listWorkspaceEmailItems?(orgId: string, date: string): Promise<WorkspaceEmailItem[]>;
  listWorkspaceRelationships?(orgId: string): Promise<WorkspaceRelationshipItem[]>;
  listWorkspaceMapItems?(orgId: string): Promise<WorkspaceMapItem[]>;
  listWorkspaceSocialItems?(orgId: string, date: string): Promise<WorkspaceSocialItem[]>;
  getWorkspaceSocialAutonomyMode?(orgId: string): Promise<"draft_only" | "approval_required" | "trusted_autopilot">;
}

type Backend = PlatformApiBackend & WorkspaceDataBackend;

function parsePath(path: string): { parts: string[]; date?: string } {
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  return { parts: pathname.split("/").filter(Boolean), date: params.get("date") ?? undefined };
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length < 10) return undefined;
  return value.slice(0, 10);
}

function auditDate(record: AuditRecord): string | undefined {
  const value = record as unknown as Record<string, unknown>;
  return (
    isoDate(value.timestamp) ??
    isoDate(value.completedAt) ??
    isoDate(value.updatedAt) ??
    isoDate(value.createdAt) ??
    isoDate(value.requestedAt)
  );
}

function notConnected<T>(id: WorkspaceSurfaceEnvelope<T>["id"], data: T, message: string): WorkspaceSurfaceEnvelope<T> {
  return { id, status: "not_connected", message, data };
}

function calendarEnvelope(items: CalendarPlanItem[]): WorkspaceViewModel["surfaces"]["calendar"] {
  return {
    id: "calendar",
    status: "ready",
    provider: "openrabbit-planning",
    updatedAt: new Date().toISOString(),
    data: {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        startAt: item.startAt,
        endAt: item.endAt,
        actorType: item.workerId ? "worker" : "human",
        actorId: item.workerId,
        actorLabel: item.workerId ? "OpenRabbit worker" : "You",
        status: item.status,
        source: item.source
      }))
    }
  };
}

function recommendFocus(model: Omit<WorkspaceViewModel, "focusRecommendation">): WorkspaceViewModel["focusRecommendation"] {
  const emailActions = model.surfaces.email.data.items.filter((item) => item.needsAction).length;
  const socialApprovals = model.surfaces.social.data.items.filter((item) => item.status === "pending_approval").length;
  const highPriorityRelationships = model.surfaces.crm.data.items.filter((item) => item.priority === "high").length;
  const opportunities = model.surfaces.map.data.items.filter((item) => item.kind === "opportunity").length;

  if (emailActions > 0) return "email";
  if (model.summary.pendingApprovals > 0 && socialApprovals > 0) return "social";
  if (highPriorityRelationships > 0) return "crm";
  if (opportunities > 0) return "map";
  return "calendar";
}

export async function routeWorkspaceApi(
  request: ApiRequestEnvelope,
  backend: Backend
): Promise<PlatformApiRouteResult> {
  const { parts, date: requestedDate } = parsePath(request.path);
  if (
    request.method.toUpperCase() !== "GET" ||
    parts.length !== 4 ||
    parts[0] !== "v1" ||
    parts[1] !== "orgs" ||
    !parts[2] ||
    parts[3] !== "workspace"
  ) {
    return { matched: false };
  }

  const orgId = parts[2];
  const date = requestedDate ?? new Date().toISOString().slice(0, 10);
  const [workers, approvals, audit, planItems, emailItems, relationships, mapItems, socialItems, socialMode] = await Promise.all([
    backend.listWorkers(orgId),
    backend.listApprovals(orgId),
    backend.listAudit(orgId),
    backend.listPlanItems ? backend.listPlanItems(orgId, date) : Promise.resolve([]),
    backend.listWorkspaceEmailItems ? backend.listWorkspaceEmailItems(orgId, date) : Promise.resolve(undefined),
    backend.listWorkspaceRelationships ? backend.listWorkspaceRelationships(orgId) : Promise.resolve(undefined),
    backend.listWorkspaceMapItems ? backend.listWorkspaceMapItems(orgId) : Promise.resolve(undefined),
    backend.listWorkspaceSocialItems ? backend.listWorkspaceSocialItems(orgId, date) : Promise.resolve(undefined),
    backend.getWorkspaceSocialAutonomyMode ? backend.getWorkspaceSocialAutonomyMode(orgId) : Promise.resolve(undefined)
  ]);

  const pendingApprovals = approvals.filter((approval) => approval.status === "pending").length;
  const agentActionsToday = audit.filter((record) => auditDate(record) === date).length;
  const activeWorkers = workers.filter((worker) => worker.status === undefined || worker.status === "active").length;

  const base: Omit<WorkspaceViewModel, "focusRecommendation"> = {
    orgId,
    date,
    generatedAt: new Date().toISOString(),
    summary: {
      pendingApprovals,
      agentActionsToday,
      scheduledItems: planItems.length,
      activeWorkers
    },
    surfaces: {
      calendar: backend.listPlanItems
        ? calendarEnvelope(planItems)
        : notConnected("calendar", { items: [] }, "Connect a calendar or enable OpenRabbit planning to populate this surface."),
      email: emailItems
        ? { id: "email", status: "ready", data: { items: emailItems } }
        : notConnected("email", { items: [] }, "Connect Gmail, Microsoft, or another supported mail provider."),
      crm: relationships
        ? { id: "crm", status: "ready", data: { items: relationships } }
        : notConnected("crm", { items: [] }, "Connect an existing CRM or enable OpenRabbit native CRM."),
      map: mapItems
        ? { id: "map", status: "ready", data: { items: mapItems } }
        : notConnected("map", { items: [] }, "Connect a property/geospatial provider to activate property intelligence."),
      social: socialItems
        ? { id: "social", status: "ready", data: { items: socialItems, autonomyMode: socialMode ?? "draft_only" } }
        : notConnected("social", { items: [], autonomyMode: socialMode ?? "draft_only" }, "Connect one or more social channels to activate publishing workflows.")
    }
  };

  const data: WorkspaceViewModel = { ...base, focusRecommendation: recommendFocus(base) };
  return { matched: true, status: 200, data };
}
