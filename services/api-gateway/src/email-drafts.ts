export type EmailDraftStatus = "draft" | "pending_approval" | "approved" | "sent" | "discarded";

export interface EmailDraft {
  id: string;
  orgId: string;
  provider?: string;
  inReplyToMessageId?: string;
  relationshipId?: string;
  propertyId?: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  status: EmailDraftStatus;
  createdBy: "user" | "worker";
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}

export interface CreateEmailDraftInput {
  provider?: string;
  inReplyToMessageId?: string;
  relationshipId?: string;
  propertyId?: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  createdBy?: "user" | "worker";
  status?: Extract<EmailDraftStatus, "draft" | "pending_approval">;
}

function draftId(): string {
  return `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

export class InMemoryEmailDraftStore {
  private readonly records = new Map<string, EmailDraft>();

  async list(orgId: string): Promise<EmailDraft[]> {
    return [...this.records.values()].filter((record) => record.orgId === orgId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(orgId: string, id: string): Promise<EmailDraft | undefined> {
    const record = this.records.get(id);
    return record?.orgId === orgId ? record : undefined;
  }

  async create(orgId: string, input: CreateEmailDraftInput): Promise<EmailDraft> {
    const to = cleanList(input.to);
    if (!to.length) throw new Error("at least one recipient is required");
    if (!input.subject.trim()) throw new Error("subject is required");
    if (!input.body.trim()) throw new Error("body is required");
    const now = new Date().toISOString();
    const draft: EmailDraft = {
      id: draftId(),
      orgId,
      provider: input.provider?.trim() || undefined,
      inReplyToMessageId: input.inReplyToMessageId?.trim() || undefined,
      relationshipId: input.relationshipId?.trim() || undefined,
      propertyId: input.propertyId?.trim() || undefined,
      to,
      cc: cleanList(input.cc),
      subject: input.subject.trim(),
      body: input.body.trim(),
      status: input.status ?? "draft",
      createdBy: input.createdBy ?? "user",
      createdAt: now,
      updatedAt: now
    };
    this.records.set(draft.id, draft);
    return draft;
  }

  async updateStatus(orgId: string, id: string, status: EmailDraftStatus): Promise<EmailDraft> {
    const current = await this.get(orgId, id);
    if (!current) throw new Error(`Email draft not found: ${id}`);
    const now = new Date().toISOString();
    const next = { ...current, status, updatedAt: now, sentAt: status === "sent" ? now : current.sentAt };
    this.records.set(id, next);
    return next;
  }
}

export interface EmailSendAdapter {
  readonly provider: string;
  createProviderDraft(orgId: string, draft: EmailDraft): Promise<{ externalDraftId: string }>;
  sendDraft(orgId: string, draft: EmailDraft): Promise<{ externalMessageId: string; sentAt: string }>;
}
