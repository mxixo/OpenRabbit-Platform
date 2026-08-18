import type { WorkspaceSocialItem } from "./workspace-contracts.js";

export type SocialAutonomyMode = "draft_only" | "approval_required" | "trusted_autopilot";
export type SocialPostStatus = WorkspaceSocialItem["status"];

export interface SocialPostRecord extends WorkspaceSocialItem {
  orgId: string;
  provider?: string;
  externalId?: string;
  body?: string;
  relationshipId?: string;
  propertyId?: string;
  createdBy: "user" | "worker";
  createdAt: string;
  updatedAt: string;
}

export interface SocialPublishPolicy {
  orgId: string;
  autonomyMode: SocialAutonomyMode;
  allowedNetworks: string[];
  maxPostsPerDay: number;
  approvalRequiredForNetworks: string[];
  quietHours?: { start: string; end: string };
  updatedAt: string;
}

export interface SocialPublishAdapter {
  readonly provider: string;
  createDraft(orgId: string, post: SocialPostRecord): Promise<{ externalId?: string }>;
  schedule(orgId: string, post: SocialPostRecord): Promise<{ externalId?: string; scheduledAt?: string }>;
  publish(orgId: string, post: SocialPostRecord): Promise<{ externalId?: string; publishedAt: string }>;
}

function id(): string {
  return `social_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function unique(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

export class InMemorySocialStore {
  private readonly posts = new Map<string, SocialPostRecord>();
  private readonly policies = new Map<string, SocialPublishPolicy>();

  async list(orgId: string, date?: string): Promise<SocialPostRecord[]> {
    return [...this.posts.values()]
      .filter((post) => post.orgId === orgId)
      .filter((post) => !date || !post.scheduledAt || post.scheduledAt.slice(0, 10) === date || post.createdAt.slice(0, 10) === date)
      .sort((a, b) => (b.scheduledAt ?? b.createdAt).localeCompare(a.scheduledAt ?? a.createdAt));
  }

  async get(orgId: string, postId: string): Promise<SocialPostRecord | undefined> {
    const post = this.posts.get(postId);
    return post?.orgId === orgId ? post : undefined;
  }

  async create(orgId: string, input: {
    title?: string;
    network?: string;
    body?: string;
    campaign?: string;
    summary?: string;
    scheduledAt?: string;
    relationshipId?: string;
    propertyId?: string;
    createdBy?: "user" | "worker";
    status?: "draft" | "pending_approval" | "scheduled";
  }): Promise<SocialPostRecord> {
    const now = new Date().toISOString();
    const policy = await this.getPolicy(orgId);
    const requested = input.status ?? "draft";
    const status: SocialPostStatus = input.createdBy === "worker" && requested !== "draft"
      ? (policy.autonomyMode === "trusted_autopilot" ? requested : "pending_approval")
      : requested;
    const post: SocialPostRecord = {
      id: id(),
      orgId,
      title: input.title?.trim(),
      network: input.network?.trim().toLowerCase(),
      body: input.body?.trim(),
      campaign: input.campaign?.trim(),
      summary: input.summary?.trim(),
      scheduledAt: input.scheduledAt,
      relationshipId: input.relationshipId?.trim(),
      propertyId: input.propertyId?.trim(),
      createdBy: input.createdBy ?? "user",
      status,
      createdAt: now,
      updatedAt: now
    };
    this.posts.set(post.id, post);
    return post;
  }

  async update(orgId: string, postId: string, patch: Partial<Pick<SocialPostRecord, "title" | "body" | "campaign" | "scheduledAt" | "status" | "summary">>): Promise<SocialPostRecord> {
    const current = await this.get(orgId, postId);
    if (!current) throw new Error(`Social post not found: ${postId}`);
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.posts.set(postId, next);
    return next;
  }

  async getPolicy(orgId: string): Promise<SocialPublishPolicy> {
    return this.policies.get(orgId) ?? {
      orgId,
      autonomyMode: "draft_only",
      allowedNetworks: [],
      maxPostsPerDay: 1,
      approvalRequiredForNetworks: [],
      updatedAt: new Date().toISOString()
    };
  }

  async setPolicy(orgId: string, input: Partial<Omit<SocialPublishPolicy, "orgId" | "updatedAt">>): Promise<SocialPublishPolicy> {
    const current = await this.getPolicy(orgId);
    const policy: SocialPublishPolicy = {
      ...current,
      ...input,
      orgId,
      allowedNetworks: unique(input.allowedNetworks ?? current.allowedNetworks),
      approvalRequiredForNetworks: unique(input.approvalRequiredForNetworks ?? current.approvalRequiredForNetworks),
      maxPostsPerDay: Math.max(1, Math.min(50, input.maxPostsPerDay ?? current.maxPostsPerDay)),
      updatedAt: new Date().toISOString()
    };
    this.policies.set(orgId, policy);
    return policy;
  }

  async workspaceItems(orgId: string, date: string): Promise<WorkspaceSocialItem[]> {
    return (await this.list(orgId, date)).map(({ orgId: _orgId, provider: _provider, externalId: _externalId, body: _body, relationshipId: _relationshipId, propertyId: _propertyId, createdBy: _createdBy, createdAt: _createdAt, updatedAt: _updatedAt, ...item }) => item);
  }
}
