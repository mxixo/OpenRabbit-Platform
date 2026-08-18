import { dirname } from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from "node:fs";
import type {
  CalendarPlanItem,
  CalendarPlanItemFilter,
  CalendarPlanStore,
  DailyPlan
} from "../interfaces/calendar.js";
import {
  InMemoryCalendarPlanStore,
  type CalendarPlanStoreSnapshot
} from "./in-memory-calendar-plan-store.js";

export interface JsonFileCalendarPlanStoreOptions {
  filePath: string;
  pretty?: boolean;
}

/**
 * Durable, single-process calendar plan store for local development and
 * small deployments. Each mutation is persisted through a temp-file rename
 * so an interrupted write cannot leave a partially-written snapshot.
 */
export class JsonFileCalendarPlanStore implements CalendarPlanStore {
  private readonly memory = new InMemoryCalendarPlanStore();
  private readonly filePath: string;
  private readonly pretty: boolean;

  constructor(options: JsonFileCalendarPlanStoreOptions) {
    if (!options.filePath?.trim()) throw new Error("calendar plan filePath is required");
    this.filePath = options.filePath;
    this.pretty = options.pretty ?? true;
    this.load();
  }

  createItem(
    input: Omit<CalendarPlanItem, "createdAt" | "updatedAt"> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ): CalendarPlanItem {
    const item = this.memory.createItem(input);
    this.persist();
    return item;
  }

  updateItem(
    orgId: string,
    itemId: string,
    patch: Partial<
      Omit<CalendarPlanItem, "id" | "orgId" | "createdAt" | "updatedAt">
    >
  ): CalendarPlanItem {
    const item = this.memory.updateItem(orgId, itemId, patch);
    this.persist();
    return item;
  }

  getItem(orgId: string, itemId: string): CalendarPlanItem | undefined {
    return this.memory.getItem(orgId, itemId);
  }

  listItems(orgId: string, filter?: CalendarPlanItemFilter): CalendarPlanItem[] {
    return this.memory.listItems(orgId, filter);
  }

  saveDailyPlan(
    input: Omit<DailyPlan, "createdAt" | "updatedAt"> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ): DailyPlan {
    const plan = this.memory.saveDailyPlan(input);
    this.persist();
    return plan;
  }

  getDailyPlan(orgId: string, date: string): DailyPlan | undefined {
    return this.memory.getDailyPlan(orgId, date);
  }

  exportSnapshot(exportedAt = new Date().toISOString()): CalendarPlanStoreSnapshot {
    return this.memory.exportSnapshot(exportedAt);
  }

  importSnapshot(snapshot: CalendarPlanStoreSnapshot): void {
    const previous = this.memory.exportSnapshot();
    try {
      this.memory.importSnapshot(snapshot);
      this.persist();
    } catch (error) {
      this.memory.importSnapshot(previous);
      throw error;
    }
  }

  private load(): void {
    if (!existsSync(this.filePath)) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.filePath, "utf8"));
    } catch (error) {
      throw new Error(
        `Unable to read calendar plan snapshot at ${this.filePath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    this.memory.importSnapshot(parsed as CalendarPlanStoreSnapshot);
  }

  private persist(): void {
    const directory = dirname(this.filePath);
    mkdirSync(directory, { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    const spacing = this.pretty ? 2 : undefined;
    writeFileSync(
      temporaryPath,
      `${JSON.stringify(this.memory.exportSnapshot(), null, spacing)}\n`,
      { encoding: "utf8", mode: 0o600 }
    );
    renameSync(temporaryPath, this.filePath);
  }
}
