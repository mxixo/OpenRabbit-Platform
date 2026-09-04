export type CalendarPlanItemStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "skipped"
  | "blocked";

export interface CalendarSourceRef {
  provider: string;
  calendarId?: string;
  eventId?: string;
}

export interface CalendarPlanItem {
  id: string;
  orgId: string;
  date: string;
  title: string;
  startAt?: string;
  endAt?: string;
  status: CalendarPlanItemStatus;
  priority?: number;
  source?: CalendarSourceRef;
  workerId?: string;
  taskId?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DailyPlan {
  id: string;
  orgId: string;
  date: string;
  timezone: string;
  objective?: string;
  itemIds: string[];
  generatedBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarPlanItemFilter {
  date?: string;
  status?: CalendarPlanItemStatus;
  workerId?: string;
  taskId?: string;
}

export interface CalendarPlanStore {
  createItem(
    input: Omit<CalendarPlanItem, "createdAt" | "updatedAt"> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ): CalendarPlanItem;
  updateItem(
    orgId: string,
    itemId: string,
    patch: Partial<
      Omit<CalendarPlanItem, "id" | "orgId" | "createdAt" | "updatedAt">
    >
  ): CalendarPlanItem;
  getItem(orgId: string, itemId: string): CalendarPlanItem | undefined;
  listItems(orgId: string, filter?: CalendarPlanItemFilter): CalendarPlanItem[];
  saveDailyPlan(
    input: Omit<DailyPlan, "createdAt" | "updatedAt"> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ): DailyPlan;
  getDailyPlan(orgId: string, date: string): DailyPlan | undefined;
}
