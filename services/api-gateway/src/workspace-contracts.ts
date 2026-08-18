export type WorkspaceSurfaceId = "calendar" | "email" | "crm" | "map" | "social";
export type WorkspaceSurfaceStatus = "ready" | "not_connected" | "degraded";

export interface WorkspaceSurfaceEnvelope<T> {
  id: WorkspaceSurfaceId;
  status: WorkspaceSurfaceStatus;
  provider?: string;
  updatedAt?: string;
  message?: string;
  data: T;
}

export interface WorkspaceCalendarItem {
  id: string;
  title: string;
  startAt?: string;
  endAt?: string;
  actorType: "human" | "worker";
  actorId?: string;
  actorLabel?: string;
  status?: string;
  source?: string;
}

export interface WorkspaceEmailItem {
  id: string;
  subject: string;
  from?: string;
  receivedAt?: string;
  unread?: boolean;
  needsAction?: boolean;
  actionType?: "reply" | "document" | "scheduling" | "review" | "other";
  relationshipId?: string;
  propertyId?: string;
  summary?: string;
}

export interface WorkspaceRelationshipItem {
  id: string;
  displayName: string;
  kind?: string;
  stage?: string;
  nextFollowUpAt?: string;
  priority?: "low" | "medium" | "high";
  leadSource?: string;
  propertyIds?: string[];
  summary?: string;
}

export interface WorkspaceMapItem {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  kind: "listing" | "opportunity" | "client" | "comp" | "appointment" | "other";
  address?: string;
  price?: number;
  relationshipIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface WorkspaceSocialItem {
  id: string;
  title?: string;
  network?: string;
  status: "draft" | "pending_approval" | "scheduled" | "published" | "failed";
  scheduledAt?: string;
  publishedAt?: string;
  campaign?: string;
  summary?: string;
}

export interface WorkspaceViewModel {
  orgId: string;
  date: string;
  generatedAt: string;
  summary: {
    pendingApprovals: number;
    agentActionsToday: number;
    scheduledItems: number;
    activeWorkers: number;
  };
  focusRecommendation?: WorkspaceSurfaceId;
  surfaces: {
    calendar: WorkspaceSurfaceEnvelope<{ items: WorkspaceCalendarItem[] }>;
    email: WorkspaceSurfaceEnvelope<{ items: WorkspaceEmailItem[] }>;
    crm: WorkspaceSurfaceEnvelope<{ items: WorkspaceRelationshipItem[] }>;
    map: WorkspaceSurfaceEnvelope<{ items: WorkspaceMapItem[] }>;
    social: WorkspaceSurfaceEnvelope<{ items: WorkspaceSocialItem[]; autonomyMode?: "draft_only" | "approval_required" | "trusted_autopilot" }>;
  };
}
