import type { PlatformApiBackend } from "./platform-api.js";
import type { EmailAdapter, InMemoryEmailStore } from "./email-adapter.js";
import type { CrmRelationshipAdapter } from "./crm-adapter.js";
import type { InMemoryNativeCrmStore } from "./native-crm.js";
import type { PropertyAdapter, InMemoryPropertyStore } from "./map-adapter.js";
import type { CalendarAdapter } from "./calendar-adapter.js";
import type { InMemorySocialStore, SocialSourceAdapter } from "./social-adapter.js";
import type { InMemoryProviderConnectionStore } from "./provider-connections.js";
import type { InMemoryContextGraphStore } from "./context-graph.js";
import { autoLinkRecordContext } from "./context-auto-link.js";
import type { EntityResolutionService } from "./entity-resolution.js";

export type SyncSurface = "email" | "crm" | "calendar" | "property" | "social";
export type SyncRunStatus = "running" | "succeeded" | "failed";

export interface ProviderSyncRun {
  id: string;
  orgId: string;
  provider: string;
  surface: SyncSurface;
  status: SyncRunStatus;
  startedAt: string;
  completedAt?: string;
  cursorBefore?: string;
  cursorAfter?: string;
  received: number;
  created: number;
  updated: number;
  skipped: number;
  error?: string;
}

export interface SyncRequest {
  orgId: string;
  provider: string;
  surfaces?: SyncSurface[];
  window?: { startAt?: string; endAt?: string };
}

function runId(): string {
  return `sync_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function adapterKey(provider: string, surface: SyncSurface): string { return `${provider.trim().toLowerCase()}:${surface}`; }
function stateKey(orgId: string, provider: string, surface: SyncSurface): string { return `${orgId}:${adapterKey(provider, surface)}`; }

export class InMemoryProviderSyncStateStore {
  private readonly cursors = new Map<string, string>();
  private readonly runs: ProviderSyncRun[] = [];
  private readonly receipts = new Set<string>();

  getCursor(orgId: string, provider: string, surface: SyncSurface): string | undefined {
    return this.cursors.get(stateKey(orgId, provider, surface));
  }
  setCursor(orgId: string, provider: string, surface: SyncSurface, cursor: string): void {
    this.cursors.set(stateKey(orgId, provider, surface), cursor);
  }
  hasReceipt(orgId: string, provider: string, surface: SyncSurface, externalId: string): boolean {
    return this.receipts.has(`${stateKey(orgId, provider, surface)}:${externalId}`);
  }
  addReceipt(orgId: string, provider: string, surface: SyncSurface, externalId: string): void {
    this.receipts.add(`${stateKey(orgId, provider, surface)}:${externalId}`);
  }
  addRun(run: ProviderSyncRun): void { this.runs.unshift(run); }
  listRuns(orgId: string, provider?: string): ProviderSyncRun[] {
    return this.runs.filter((run) => run.orgId === orgId && (!provider || run.provider === provider.toLowerCase())).slice(0, 100);
  }
}

export class ProviderSyncCoordinator {
  private readonly emailAdapters = new Map<string, EmailAdapter>();
  private readonly crmAdapters = new Map<string, CrmRelationshipAdapter>();
  private readonly propertyAdapters = new Map<string, PropertyAdapter>();
  private readonly calendarAdapters = new Map<string, CalendarAdapter>();
  private readonly socialAdapters = new Map<string, SocialSourceAdapter>();

  constructor(
    private readonly emailStore: InMemoryEmailStore,
    private readonly crmStore: InMemoryNativeCrmStore,
    private readonly propertyStore: InMemoryPropertyStore,
    private readonly socialStore: InMemorySocialStore,
    private readonly connectionStore: InMemoryProviderConnectionStore,
    private readonly graph: InMemoryContextGraphStore,
    private readonly resolver: EntityResolutionService,
    private readonly backend: () => PlatformApiBackend | undefined,
    readonly state = new InMemoryProviderSyncStateStore()
  ) {}

  registerEmailAdapter(adapter: EmailAdapter): void { this.emailAdapters.set(adapter.provider.toLowerCase(), adapter); }
  registerCrmAdapter(adapter: CrmRelationshipAdapter): void { this.crmAdapters.set(adapter.provider.toLowerCase(), adapter); }
  registerPropertyAdapter(adapter: PropertyAdapter): void { this.propertyAdapters.set(adapter.provider.toLowerCase(), adapter); }
  registerCalendarAdapter(adapter: CalendarAdapter): void { this.calendarAdapters.set(adapter.provider.toLowerCase(), adapter); }
  registerSocialAdapter(adapter: SocialSourceAdapter): void { this.socialAdapters.set(adapter.provider.toLowerCase(), adapter); }

  registeredSurfaces(provider: string): SyncSurface[] {
    const p = provider.toLowerCase();
    const out: SyncSurface[] = [];
    if (this.emailAdapters.has(p)) out.push("email");
    if (this.crmAdapters.has(p)) out.push("crm");
    if (this.calendarAdapters.has(p)) out.push("calendar");
    if (this.propertyAdapters.has(p)) out.push("property");
    if (this.socialAdapters.has(p)) out.push("social");
    return out;
  }

  async run(input: SyncRequest): Promise<ProviderSyncRun[]> {
    const provider = input.provider.trim().toLowerCase();
    if (!provider) throw new Error("provider is required");
    const surfaces = input.surfaces?.length ? input.surfaces : this.registeredSurfaces(provider);
    if (!surfaces.length) throw new Error(`No sync adapters registered for provider: ${provider}`);
    const results: ProviderSyncRun[] = [];
    for (const surface of surfaces) results.push(await this.runSurface({ ...input, provider }, surface));
    return results;
  }

  private async runSurface(input: SyncRequest & { provider: string }, surface: SyncSurface): Promise<ProviderSyncRun> {
    const cursorBefore = this.state.getCursor(input.orgId, input.provider, surface);
    const run: ProviderSyncRun = { id: runId(), orgId: input.orgId, provider: input.provider, surface, status: "running", startedAt: new Date().toISOString(), cursorBefore, received: 0, created: 0, updated: 0, skipped: 0 };
    this.state.addRun(run);
    try {
      if (surface === "email") await this.syncEmail(run);
      else if (surface === "crm") await this.syncCrm(run);
      else if (surface === "property") await this.syncProperty(run);
      else if (surface === "calendar") await this.syncCalendar(run, input.window);
      else if (surface === "social") await this.syncSocial(run);
      run.status = "succeeded";
      run.completedAt = new Date().toISOString();
      run.cursorAfter = new Date().toISOString();
      this.state.setCursor(run.orgId, run.provider, run.surface, run.cursorAfter);
      await this.markConnection(run.orgId, run.provider, run.completedAt);
      return run;
    } catch (error) {
      run.status = "failed";
      run.completedAt = new Date().toISOString();
      run.error = error instanceof Error ? error.message : "provider sync failed";
      await this.markConnection(run.orgId, run.provider, undefined, run.error);
      return run;
    }
  }

  private async syncEmail(run: ProviderSyncRun): Promise<void> {
    const adapter = this.emailAdapters.get(run.provider);
    if (!adapter) throw new Error(`Email sync adapter not registered: ${run.provider}`);
    const messages = await adapter.listMessages(run.orgId, run.cursorBefore);
    run.received = messages.length;
    const result = await this.emailStore.import({ orgId: run.orgId, provider: run.provider, messages });
    run.created += result.imported; run.updated += result.updated;
    for (const item of result.items) await this.resolver.resolveEmail(run.orgId, item.id);
  }

  private async syncCrm(run: ProviderSyncRun): Promise<void> {
    const adapter = this.crmAdapters.get(run.provider);
    if (!adapter) throw new Error(`CRM sync adapter not registered: ${run.provider}`);
    let cursor = run.cursorBefore;
    for (let pageCount = 0; pageCount < 20; pageCount++) {
      const page = await adapter.listRelationships(run.orgId, cursor);
      run.received += page.relationships.length;
      const imported = await this.crmStore.importRecords(run.orgId, run.provider, page.relationships, "merge");
      run.created += imported.created; run.updated += imported.updated; run.skipped += imported.skipped;
      for (const id of imported.relationshipIds) {
        const record = await this.crmStore.get(run.orgId, id);
        if (record) await autoLinkRecordContext(this.graph, run.orgId, { type: "relationship", id: record.id, label: record.displayName }, record);
      }
      if (!page.nextCursor || page.nextCursor === cursor) break;
      cursor = page.nextCursor;
    }
  }

  private async syncProperty(run: ProviderSyncRun): Promise<void> {
    const adapter = this.propertyAdapters.get(run.provider);
    if (!adapter) throw new Error(`Property sync adapter not registered: ${run.provider}`);
    const records = await adapter.listProperties(run.orgId, { updatedSince: run.cursorBefore });
    run.received = records.length;
    const imported = await this.propertyStore.import({ orgId: run.orgId, provider: run.provider, records });
    run.created += imported.imported; run.updated += imported.updated;
    for (const record of imported.items) await autoLinkRecordContext(this.graph, run.orgId, { type: "property", id: record.id, label: record.address ?? record.label }, record);
  }

  private async syncCalendar(run: ProviderSyncRun, window?: SyncRequest["window"]): Promise<void> {
    const adapter = this.calendarAdapters.get(run.provider);
    if (!adapter) throw new Error(`Calendar sync adapter not registered: ${run.provider}`);
    const platform = this.backend();
    if (!platform?.createPlanItem) throw new Error("calendar planning backend is not available");
    const startAt = window?.startAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const endAt = window?.endAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const events = await adapter.listEvents(run.orgId, { startAt, endAt });
    run.received = events.length;
    for (const event of events) {
      if (this.state.hasReceipt(run.orgId, run.provider, "calendar", event.externalId)) { run.skipped++; continue; }
      const item = await platform.createPlanItem({
        orgId: run.orgId,
        date: event.startAt.slice(0, 10),
        title: event.title,
        startAt: event.startAt,
        endAt: event.endAt,
        notes: event.description,
        metadata: { provider: run.provider, externalId: event.externalId, calendarId: event.calendarId, location: event.location, attendees: event.attendees, relationshipId: event.relationshipId, propertyId: event.propertyId, sourceEmailMessageId: event.sourceEmailMessageId }
      });
      this.state.addReceipt(run.orgId, run.provider, "calendar", event.externalId);
      run.created++;
      await autoLinkRecordContext(this.graph, run.orgId, { type: "calendar", id: item.id, label: item.title }, event);
    }
  }

  private async syncSocial(run: ProviderSyncRun): Promise<void> {
    const adapter = this.socialAdapters.get(run.provider);
    if (!adapter) throw new Error(`Social sync adapter not registered: ${run.provider}`);
    const posts = await adapter.listPosts(run.orgId, run.cursorBefore);
    run.received = posts.length;
    const imported = await this.socialStore.importExternal(run.orgId, run.provider, posts);
    run.created += imported.imported; run.updated += imported.updated;
    for (const record of imported.items) await autoLinkRecordContext(this.graph, run.orgId, { type: "social", id: record.id, label: record.title ?? record.network ?? "Social post" }, record);
  }

  private async markConnection(orgId: string, provider: string, syncedAt?: string, error?: string): Promise<void> {
    const current = await this.connectionStore.get(orgId, provider);
    if (!current) return;
    await this.connectionStore.upsert(orgId, { provider, status: error ? "error" : current.status, lastSyncAt: syncedAt ?? current.lastSyncAt, error, capabilities: current.capabilities, scopes: current.scopes, accountLabel: current.accountLabel, connectedAt: current.connectedAt });
  }
}
