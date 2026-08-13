import {
  InMemoryCalendarPlanStore,
  type CalendarPlanItem,
  type CalendarPlanItemStatus,
  type DailyPlan
} from "@openrabbit/runtime-core";
import { RealEstatePlatformBackend } from "./real-estate-platform-backend.js";

export class PlanningRealEstatePlatformBackend extends RealEstatePlatformBackend {
  private readonly planning = new InMemoryCalendarPlanStore();
  private planItemSequence = 0;

  async getDailyPlan(orgId: string, date: string): Promise<DailyPlan | undefined> {
    return this.planning.getDailyPlan(orgId, date);
  }

  async listPlanItems(orgId: string, date: string): Promise<CalendarPlanItem[]> {
    return this.planning.listItems(orgId, { date });
  }

  async saveDailyPlan(input: {
    orgId: string;
    date: string;
    timezone: string;
    objective?: string;
    itemIds: string[];
    generatedBy?: string;
  }): Promise<DailyPlan> {
    return this.planning.saveDailyPlan({
      id: `plan-${input.orgId}-${input.date}`,
      ...input
    });
  }

  async createPlanItem(input: {
    orgId: string;
    date: string;
    title: string;
    startAt?: string;
    endAt?: string;
    priority?: number;
    workerId?: string;
    taskId?: string;
    notes?: string;
    source?: CalendarPlanItem["source"];
    metadata?: Record<string, unknown>;
  }): Promise<CalendarPlanItem> {
    this.planItemSequence += 1;
    return this.planning.createItem({
      id: `plan-item-${this.planItemSequence}`,
      orgId: input.orgId,
      date: input.date,
      title: input.title,
      startAt: input.startAt,
      endAt: input.endAt,
      status: "planned",
      priority: input.priority,
      workerId: input.workerId,
      taskId: input.taskId,
      notes: input.notes,
      source: input.source,
      metadata: input.metadata
    });
  }

  async updatePlanItem(input: {
    orgId: string;
    itemId: string;
    status?: CalendarPlanItemStatus;
    notes?: string;
    workerId?: string;
    taskId?: string;
  }): Promise<CalendarPlanItem> {
    return this.planning.updateItem(input.orgId, input.itemId, {
      status: input.status,
      notes: input.notes,
      workerId: input.workerId,
      taskId: input.taskId
    });
  }
}
