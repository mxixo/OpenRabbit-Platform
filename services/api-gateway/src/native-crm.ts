import type { WorkspaceRelationshipItem } from "./workspace-contracts.js";
import type { CrmImportRecord, CrmImportResult } from "./crm-adapter.js";

export type CrmPriority = "low" | "medium" | "high";

export interface NativeCrmRelationship extends WorkspaceRelationshipItem {
  orgId: string;
  email?: string;
  phone?: string;
  tags?: string[];
  sourceProvider?: string;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNativeCrmRelationshipInput {
  id?: string;
  displayName: string;
  kind?: string;
  stage?: string;
  nextFollowUpAt?: string;
  priority?: CrmPriority;
  leadSource?: string;
  propertyIds?: string[];
  summary?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  sourceProvider?: string;
  externalId?: string;
}

export type UpdateNativeCrmRelationshipInput = Partial<Omit<CreateNativeCrmRelationshipInput, "id">>;

function cleanText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function uniqueStrings(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined;
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function relationshipId(): string {
  return `rel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function comparableEmail(value: string | undefined): string | undefined {
  return cleanText(value)?.toLowerCase();
}

export class InMemoryNativeCrmStore {
  private readonly records = new Map<string, NativeCrmRelationship>();

  async list(orgId: string): Promise<NativeCrmRelationship[]> {
    return [...this.records.values()]
      .filter((record) => record.orgId === orgId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(orgId: string, id: string): Promise<NativeCrmRelationship | undefined> {
    const record = this.records.get(id);
    return record?.orgId === orgId ? record : undefined;
  }

  async create(orgId: string, input: CreateNativeCrmRelationshipInput): Promise<NativeCrmRelationship> {
    const displayName = input.displayName.trim();
    if (!displayName) throw new Error("displayName is required");

    const id = cleanText(input.id) ?? relationshipId();
    if (this.records.has(id)) throw new Error(`CRM relationship already exists: ${id}`);

    const now = new Date().toISOString();
    const record: NativeCrmRelationship = {
      id,
      orgId,
      displayName,
      kind: cleanText(input.kind),
      stage: cleanText(input.stage),
      nextFollowUpAt: cleanText(input.nextFollowUpAt),
      priority: input.priority,
      leadSource: cleanText(input.leadSource),
      propertyIds: uniqueStrings(input.propertyIds),
      summary: cleanText(input.summary),
      email: cleanText(input.email),
      phone: cleanText(input.phone),
      tags: uniqueStrings(input.tags),
      sourceProvider: cleanText(input.sourceProvider),
      externalId: cleanText(input.externalId),
      createdAt: now,
      updatedAt: now
    };
    this.records.set(id, record);
    return record;
  }

  async update(orgId: string, id: string, input: UpdateNativeCrmRelationshipInput): Promise<NativeCrmRelationship> {
    const current = await this.get(orgId, id);
    if (!current) throw new Error(`CRM relationship not found: ${id}`);

    const displayName = input.displayName === undefined ? current.displayName : input.displayName.trim();
    if (!displayName) throw new Error("displayName cannot be empty");

    const next: NativeCrmRelationship = {
      ...current,
      displayName,
      kind: input.kind === undefined ? current.kind : cleanText(input.kind),
      stage: input.stage === undefined ? current.stage : cleanText(input.stage),
      nextFollowUpAt: input.nextFollowUpAt === undefined ? current.nextFollowUpAt : cleanText(input.nextFollowUpAt),
      priority: input.priority === undefined ? current.priority : input.priority,
      leadSource: input.leadSource === undefined ? current.leadSource : cleanText(input.leadSource),
      propertyIds: input.propertyIds === undefined ? current.propertyIds : uniqueStrings(input.propertyIds),
      summary: input.summary === undefined ? current.summary : cleanText(input.summary),
      email: input.email === undefined ? current.email : cleanText(input.email),
      phone: input.phone === undefined ? current.phone : cleanText(input.phone),
      tags: input.tags === undefined ? current.tags : uniqueStrings(input.tags),
      sourceProvider: input.sourceProvider === undefined ? current.sourceProvider : cleanText(input.sourceProvider),
      externalId: input.externalId === undefined ? current.externalId : cleanText(input.externalId),
      updatedAt: new Date().toISOString()
    };
    this.records.set(id, next);
    return next;
  }

  async remove(orgId: string, id: string): Promise<boolean> {
    const current = await this.get(orgId, id);
    if (!current) return false;
    return this.records.delete(id);
  }

  async importRecords(
    orgId: string,
    provider: string,
    records: CrmImportRecord[],
    mode: "merge" | "create_only" = "merge"
  ): Promise<CrmImportResult> {
    const sourceProvider = provider.trim();
    if (!sourceProvider) throw new Error("provider is required");

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const relationshipIds: string[] = [];

    for (const record of records) {
      const externalId = cleanText(record.externalId);
      const email = comparableEmail(record.email);
      const existing = (await this.list(orgId)).find((candidate) =>
        (externalId && candidate.sourceProvider === sourceProvider && candidate.externalId === externalId) ||
        (email && comparableEmail(candidate.email) === email)
      );

      if (existing) {
        relationshipIds.push(existing.id);
        if (mode === "create_only") {
          skipped += 1;
          continue;
        }
        await this.update(orgId, existing.id, { ...record, sourceProvider, externalId });
        updated += 1;
        continue;
      }

      const createdRecord = await this.create(orgId, { ...record, sourceProvider, externalId });
      relationshipIds.push(createdRecord.id);
      created += 1;
    }

    return { provider: sourceProvider, created, updated, skipped, relationshipIds };
  }

  async workspaceItems(orgId: string): Promise<WorkspaceRelationshipItem[]> {
    const records = await this.list(orgId);
    return records.map(({ orgId: _orgId, email: _email, phone: _phone, tags: _tags, sourceProvider: _sourceProvider, externalId: _externalId, createdAt: _createdAt, updatedAt: _updatedAt, ...item }) => item);
  }
}
