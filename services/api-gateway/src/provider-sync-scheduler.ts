import type { ProviderSyncCoordinator, SyncSurface } from "./provider-sync.js";

export interface ProviderSyncSchedule {
  id: string;
  orgId: string;
  provider: string;
  surfaces: SyncSurface[];
  intervalMinutes: number;
  enabled: boolean;
  nextRunAt: string;
  lastRunAt?: string;
  lastStatus?: "succeeded" | "failed";
  createdAt: string;
  updatedAt: string;
}

function id(): string { return `syncsched_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
function nextAt(intervalMinutes: number, from = Date.now()): string { return new Date(from + intervalMinutes * 60_000).toISOString(); }

export class ProviderSyncScheduler {
  private readonly schedules = new Map<string, ProviderSyncSchedule>();
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;

  constructor(private readonly coordinator: ProviderSyncCoordinator, private readonly tickEveryMs = 30_000) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.tick(); }, this.tickEveryMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  list(orgId: string): ProviderSyncSchedule[] {
    return [...this.schedules.values()].filter((schedule) => schedule.orgId === orgId).sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt));
  }

  get(orgId: string, scheduleId: string): ProviderSyncSchedule | undefined {
    const schedule = this.schedules.get(scheduleId);
    return schedule?.orgId === orgId ? schedule : undefined;
  }

  create(input: { orgId: string; provider: string; surfaces?: SyncSurface[]; intervalMinutes: number; enabled?: boolean }): ProviderSyncSchedule {
    const provider = input.provider.trim().toLowerCase();
    if (!provider) throw new Error("provider is required");
    if (!Number.isFinite(input.intervalMinutes) || input.intervalMinutes < 1 || input.intervalMinutes > 10_080) throw new Error("intervalMinutes must be between 1 and 10080");
    const surfaces = input.surfaces?.length ? input.surfaces : this.coordinator.registeredSurfaces(provider);
    if (!surfaces.length) throw new Error(`No sync adapters registered for provider: ${provider}`);
    const now = new Date().toISOString();
    const schedule: ProviderSyncSchedule = { id: id(), orgId: input.orgId, provider, surfaces, intervalMinutes: input.intervalMinutes, enabled: input.enabled ?? true, nextRunAt: nextAt(input.intervalMinutes), createdAt: now, updatedAt: now };
    this.schedules.set(schedule.id, schedule);
    return schedule;
  }

  update(orgId: string, scheduleId: string, patch: Partial<Pick<ProviderSyncSchedule, "surfaces" | "intervalMinutes" | "enabled">>): ProviderSyncSchedule {
    const current = this.get(orgId, scheduleId);
    if (!current) throw new Error(`Sync schedule not found: ${scheduleId}`);
    const intervalMinutes = patch.intervalMinutes ?? current.intervalMinutes;
    if (!Number.isFinite(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 10_080) throw new Error("intervalMinutes must be between 1 and 10080");
    const surfaces = patch.surfaces?.length ? patch.surfaces : current.surfaces;
    const updated: ProviderSyncSchedule = { ...current, ...patch, surfaces, intervalMinutes, nextRunAt: nextAt(intervalMinutes), updatedAt: new Date().toISOString() };
    this.schedules.set(scheduleId, updated);
    return updated;
  }

  remove(orgId: string, scheduleId: string): boolean {
    if (!this.get(orgId, scheduleId)) return false;
    return this.schedules.delete(scheduleId);
  }

  async runNow(orgId: string, scheduleId: string): Promise<ProviderSyncSchedule> {
    const schedule = this.get(orgId, scheduleId);
    if (!schedule) throw new Error(`Sync schedule not found: ${scheduleId}`);
    const runs = await this.coordinator.run({ orgId, provider: schedule.provider, surfaces: schedule.surfaces });
    const failed = runs.some((run) => run.status === "failed");
    const now = Date.now();
    const updated: ProviderSyncSchedule = { ...schedule, lastRunAt: new Date(now).toISOString(), lastStatus: failed ? "failed" : "succeeded", nextRunAt: nextAt(schedule.intervalMinutes, now), updatedAt: new Date(now).toISOString() };
    this.schedules.set(scheduleId, updated);
    return updated;
  }

  async tick(now = Date.now()): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const due = [...this.schedules.values()].filter((schedule) => schedule.enabled && Date.parse(schedule.nextRunAt) <= now);
      for (const schedule of due) await this.runNow(schedule.orgId, schedule.id);
    } finally {
      this.ticking = false;
    }
  }
}
