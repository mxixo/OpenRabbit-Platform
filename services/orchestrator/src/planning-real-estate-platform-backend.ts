import {
  InMemoryCalendarPlanStore,
  type CalendarPlanItem,
  type CalendarPlanItemStatus,
  type DailyPlan,
  type WorkerTaskActionKind,
  type WorkerTaskResult
} from "@openrabbit/runtime-core";
import { RealEstatePlatformBackend } from "./real-estate-platform-backend.js";

export interface PlanItemExecutionResult {
  item: CalendarPlanItem;
  taskResult: WorkerTaskResult;
}

function executionNote(result: WorkerTaskResult): string {
  if (result.status === "completed") {
    return `OpenRabbit task ${result.taskId} completed.`;
  }
  if (result.status === "blocked" && result.error?.code === "approval_required") {
    const approvalId = (result.output as { approvalId?: string } | undefined)?.approvalId;
    return approvalId
      ? `OpenRabbit task ${result.taskId} is blocked pending human approval (${approvalId}).`
      : `OpenRabbit task ${result.taskId} is blocked pending human approval.`;
  }
  if (result.status === "cancelled") {
    return `OpenRabbit task ${result.taskId} was cancelled${result.error?.message ? `: ${result.error.message}` : "."}`;
  }
  return `OpenRabbit task ${result.taskId} failed${result.error?.message ? `: ${result.error.message}` : "."}`;
}

function appendNote(existing: string | undefined, next: string): string {
  return existing?.trim() ? `${existing.trim()}\n${next}` : next;
}

export class PlanningRealEstatePlatformBackend extends RealEstatePlatformBackend {
  private readonly planning = new InMemoryCalendarPlanStore();
  private planItemSequence = 0;
  private executionSequence = 0;

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

  async executePlanItem(input: {
    orgId: string;
    itemId: string;
    taskType: string;
    taskInput: unknown;
    actionKind?: WorkerTaskActionKind;
  }): Promise<PlanItemExecutionResult> {
    const item = this.planning.getItem(input.orgId, input.itemId);
    if (!item) {
      throw new Error(`Calendar item not found: ${input.itemId}`);
    }
    if (!item.workerId?.trim()) {
      throw new Error(`Calendar item ${input.itemId} has no assigned worker`);
    }
    if (!input.taskType?.trim()) {
      throw new Error("taskType is required");
    }
    if (["completed", "skipped"].includes(item.status)) {
      throw new Error(`Calendar item ${input.itemId} is already ${item.status}`);
    }

    this.executionSequence += 1;
    const taskId = item.taskId?.trim() || `plan-task-${input.itemId}-${this.executionSequence}`;
    this.planning.updateItem(input.orgId, input.itemId, {
      status: "in_progress",
      taskId,
      metadata: {
        ...(item.metadata ?? {}),
        executionTaskType: input.taskType,
        executionActionKind: input.actionKind ?? "read"
      }
    });

    const taskResult = await this.submitWorkerTask({
      orgId: input.orgId,
      workerId: item.workerId,
      taskId,
      taskType: input.taskType,
      input: input.taskInput,
      actionKind: input.actionKind
    });

    const status: CalendarPlanItemStatus =
      taskResult.status === "completed"
        ? "completed"
        : taskResult.status === "blocked"
          ? "blocked"
          : "blocked";

    const updated = this.planning.updateItem(input.orgId, input.itemId, {
      status,
      taskId,
      notes: appendNote(item.notes, executionNote(taskResult)),
      metadata: {
        ...(item.metadata ?? {}),
        executionTaskType: input.taskType,
        executionActionKind: input.actionKind ?? "read",
        executionStatus: taskResult.status,
        ...(taskResult.error?.code ? { executionErrorCode: taskResult.error.code } : {}),
        ...((taskResult.output as { approvalId?: string } | undefined)?.approvalId
          ? {
              approvalId: (taskResult.output as { approvalId: string }).approvalId
            }
          : {})
      }
    });

    return { item: updated, taskResult };
  }
}
