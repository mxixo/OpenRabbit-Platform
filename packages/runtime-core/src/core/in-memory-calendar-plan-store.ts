import type {
  CalendarPlanItem,
  CalendarPlanItemFilter,
  CalendarPlanStore,
  DailyPlan
} from "../interfaces/calendar.js";

function cloneItem(item: CalendarPlanItem): CalendarPlanItem {
  return {
    ...item,
    source: item.source ? { ...item.source } : undefined,
    metadata: item.metadata ? { ...item.metadata } : undefined
  };
}

function clonePlan(plan: DailyPlan): DailyPlan {
  return {
    ...plan,
    itemIds: [...plan.itemIds],
    metadata: plan.metadata ? { ...plan.metadata } : undefined
  };
}

export class InMemoryCalendarPlanStore implements CalendarPlanStore {
  private readonly items = new Map<string, CalendarPlanItem>();
  private readonly plans = new Map<string, DailyPlan>();

  createItem(
    input: Omit<CalendarPlanItem, "createdAt" | "updatedAt"> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ): CalendarPlanItem {
    if (!input.id?.trim()) throw new Error("calendar item id is required");
    if (!input.orgId?.trim()) throw new Error("calendar item orgId is required");
    if (!input.date?.trim()) throw new Error("calendar item date is required");
    if (!input.title?.trim()) throw new Error("calendar item title is required");

    const key = this.itemKey(input.orgId, input.id);
    if (this.items.has(key)) {
      throw new Error(`Calendar item already exists: ${input.id}`);
    }

    const now = new Date().toISOString();
    const item: CalendarPlanItem = {
      ...input,
      source: input.source ? { ...input.source } : undefined,
      metadata: input.metadata ? { ...input.metadata } : undefined,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? input.createdAt ?? now
    };
    this.items.set(key, item);
    return cloneItem(item);
  }

  updateItem(
    orgId: string,
    itemId: string,
    patch: Partial<
      Omit<CalendarPlanItem, "id" | "orgId" | "createdAt" | "updatedAt">
    >
  ): CalendarPlanItem {
    const key = this.itemKey(orgId, itemId);
    const current = this.items.get(key);
    if (!current) throw new Error(`Calendar item not found: ${itemId}`);

    const next: CalendarPlanItem = {
      ...current,
      ...patch,
      source: patch.source
        ? { ...patch.source }
        : patch.source === undefined
          ? current.source
          : undefined,
      metadata: patch.metadata
        ? { ...patch.metadata }
        : patch.metadata === undefined
          ? current.metadata
          : undefined,
      updatedAt: new Date().toISOString()
    };
    this.items.set(key, next);
    return cloneItem(next);
  }

  getItem(orgId: string, itemId: string): CalendarPlanItem | undefined {
    const item = this.items.get(this.itemKey(orgId, itemId));
    return item ? cloneItem(item) : undefined;
  }

  listItems(orgId: string, filter?: CalendarPlanItemFilter): CalendarPlanItem[] {
    return [...this.items.values()]
      .filter((item) => {
        if (item.orgId !== orgId) return false;
        if (filter?.date && item.date !== filter.date) return false;
        if (filter?.status && item.status !== filter.status) return false;
        if (filter?.workerId && item.workerId !== filter.workerId) return false;
        if (filter?.taskId && item.taskId !== filter.taskId) return false;
        return true;
      })
      .map(cloneItem);
  }

  saveDailyPlan(
    input: Omit<DailyPlan, "createdAt" | "updatedAt"> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ): DailyPlan {
    if (!input.id?.trim()) throw new Error("daily plan id is required");
    if (!input.orgId?.trim()) throw new Error("daily plan orgId is required");
    if (!input.date?.trim()) throw new Error("daily plan date is required");
    if (!input.timezone?.trim()) throw new Error("daily plan timezone is required");

    const key = this.planKey(input.orgId, input.date);
    const existing = this.plans.get(key);
    const now = new Date().toISOString();
    const plan: DailyPlan = {
      ...input,
      itemIds: [...input.itemIds],
      metadata: input.metadata ? { ...input.metadata } : undefined,
      createdAt: existing?.createdAt ?? input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    };
    this.plans.set(key, plan);
    return clonePlan(plan);
  }

  getDailyPlan(orgId: string, date: string): DailyPlan | undefined {
    const plan = this.plans.get(this.planKey(orgId, date));
    return plan ? clonePlan(plan) : undefined;
  }

  private itemKey(orgId: string, itemId: string): string {
    return `${orgId}:${itemId}`;
  }

  private planKey(orgId: string, date: string): string {
    return `${orgId}:${date}`;
  }
}
