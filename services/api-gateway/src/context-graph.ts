export type ContextEntityType = "relationship" | "email" | "calendar" | "property" | "social" | "deal" | "document" | "task" | "other";
export type ContextLinkType = "related_to" | "about" | "scheduled_from" | "owned_by" | "generated_from" | "mentions" | "follow_up_for" | "other";

export interface ContextEntityRef {
  type: ContextEntityType;
  id: string;
  label?: string;
}

export interface ContextLink {
  id: string;
  orgId: string;
  from: ContextEntityRef;
  to: ContextEntityRef;
  relation: ContextLinkType;
  confidence?: number;
  source?: "user" | "worker" | "system" | "provider";
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface EnvironmentActionRecord {
  id: string;
  orgId: string;
  actionType: string;
  status: "proposed" | "pending_approval" | "executed" | "failed" | "cancelled";
  actorType: "user" | "worker" | "system";
  actorId?: string;
  summary: string;
  entities: ContextEntityRef[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class InMemoryContextGraphStore {
  private readonly links = new Map<string, ContextLink>();
  private readonly actions = new Map<string, EnvironmentActionRecord>();

  async addLink(orgId: string, input: Omit<ContextLink, "id" | "orgId" | "createdAt">): Promise<ContextLink> {
    if (!input.from?.id || !input.to?.id) throw new Error("context link requires from and to entities");
    const link: ContextLink = { id: makeId("ctx"), orgId, ...input, createdAt: new Date().toISOString() };
    this.links.set(link.id, link);
    return link;
  }

  async listLinks(orgId: string, entity?: ContextEntityRef): Promise<ContextLink[]> {
    return [...this.links.values()].filter((link) => link.orgId === orgId).filter((link) => {
      if (!entity) return true;
      return (link.from.type === entity.type && link.from.id === entity.id) || (link.to.type === entity.type && link.to.id === entity.id);
    });
  }

  async neighborhood(orgId: string, entity: ContextEntityRef): Promise<{ entity: ContextEntityRef; links: ContextLink[]; neighbors: ContextEntityRef[] }> {
    const links = await this.listLinks(orgId, entity);
    const neighbors = new Map<string, ContextEntityRef>();
    for (const link of links) {
      const candidate = link.from.type === entity.type && link.from.id === entity.id ? link.to : link.from;
      neighbors.set(`${candidate.type}:${candidate.id}`, candidate);
    }
    return { entity, links, neighbors: [...neighbors.values()] };
  }

  async recordAction(orgId: string, input: Omit<EnvironmentActionRecord, "id" | "orgId" | "createdAt">): Promise<EnvironmentActionRecord> {
    const record: EnvironmentActionRecord = { id: makeId("act"), orgId, ...input, createdAt: new Date().toISOString() };
    this.actions.set(record.id, record);
    return record;
  }

  async listActions(orgId: string, date?: string): Promise<EnvironmentActionRecord[]> {
    return [...this.actions.values()]
      .filter((action) => action.orgId === orgId)
      .filter((action) => !date || action.createdAt.slice(0, 10) === date || action.completedAt?.slice(0, 10) === date)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateAction(orgId: string, actionId: string, patch: Partial<Pick<EnvironmentActionRecord, "status" | "summary" | "completedAt" | "metadata">>): Promise<EnvironmentActionRecord> {
    const current = this.actions.get(actionId);
    if (!current || current.orgId !== orgId) throw new Error(`Environment action not found: ${actionId}`);
    const next = { ...current, ...patch };
    this.actions.set(actionId, next);
    return next;
  }
}
