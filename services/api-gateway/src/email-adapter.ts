import type { WorkspaceEmailItem } from "./workspace-contracts.js";

export type EmailActionType = "reply" | "document" | "scheduling" | "review" | "other";

export interface NormalizedEmailMessage extends WorkspaceEmailItem {
  orgId: string;
  provider?: string;
  externalId?: string;
  threadId?: string;
  to?: string[];
  cc?: string[];
  bodyPreview?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailProviderMessage {
  externalId: string;
  threadId?: string;
  subject: string;
  from?: string;
  to?: string[];
  cc?: string[];
  receivedAt?: string;
  unread?: boolean;
  needsAction?: boolean;
  actionType?: EmailActionType;
  relationshipId?: string;
  propertyId?: string;
  summary?: string;
  bodyPreview?: string;
}

export interface EmailAdapter {
  readonly provider: string;
  listMessages(orgId: string, since?: string): Promise<EmailProviderMessage[]>;
}

export interface ImportEmailMessagesInput {
  provider: string;
  messages: EmailProviderMessage[];
}

function messageId(): string {
  return `mail_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export class InMemoryEmailStore {
  private readonly records = new Map<string, NormalizedEmailMessage>();

  async list(orgId: string, date?: string): Promise<NormalizedEmailMessage[]> {
    return [...this.records.values()]
      .filter((record) => record.orgId === orgId)
      .filter((record) => !date || !record.receivedAt || record.receivedAt.slice(0, 10) === date)
      .sort((a, b) => (b.receivedAt ?? b.createdAt).localeCompare(a.receivedAt ?? a.createdAt));
  }

  async get(orgId: string, id: string): Promise<NormalizedEmailMessage | undefined> {
    const record = this.records.get(id);
    return record?.orgId === orgId ? record : undefined;
  }

  async import(input: ImportEmailMessagesInput & { orgId: string }): Promise<{ imported: number; updated: number; items: NormalizedEmailMessage[] }> {
    let imported = 0;
    let updated = 0;
    const items: NormalizedEmailMessage[] = [];

    for (const incoming of input.messages) {
      const existing = [...this.records.values()].find(
        (record) => record.orgId === input.orgId && record.provider === input.provider && record.externalId === incoming.externalId
      );
      const now = new Date().toISOString();
      const next: NormalizedEmailMessage = {
        ...(existing ?? { id: messageId(), orgId: input.orgId, createdAt: now }),
        provider: input.provider,
        externalId: incoming.externalId,
        threadId: clean(incoming.threadId),
        subject: incoming.subject.trim(),
        from: clean(incoming.from),
        to: incoming.to,
        cc: incoming.cc,
        receivedAt: clean(incoming.receivedAt),
        unread: incoming.unread,
        needsAction: incoming.needsAction,
        actionType: incoming.actionType,
        relationshipId: clean(incoming.relationshipId),
        propertyId: clean(incoming.propertyId),
        summary: clean(incoming.summary),
        bodyPreview: clean(incoming.bodyPreview),
        updatedAt: now
      };
      this.records.set(next.id, next);
      existing ? updated++ : imported++;
      items.push(next);
    }
    return { imported, updated, items };
  }

  async update(orgId: string, id: string, patch: Partial<Pick<NormalizedEmailMessage, "unread" | "needsAction" | "actionType" | "relationshipId" | "propertyId" | "summary">>): Promise<NormalizedEmailMessage> {
    const current = await this.get(orgId, id);
    if (!current) throw new Error(`Email message not found: ${id}`);
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.records.set(id, next);
    return next;
  }

  async workspaceItems(orgId: string, date: string): Promise<WorkspaceEmailItem[]> {
    return (await this.list(orgId, date)).map(({ orgId: _orgId, provider: _provider, externalId: _externalId, threadId: _threadId, to: _to, cc: _cc, bodyPreview: _bodyPreview, createdAt: _createdAt, updatedAt: _updatedAt, ...item }) => item);
  }
}
