import type {
  ApprovalRequest,
  AuditRecord,
  CalendarPlanItem,
  DailyPlan,
  WorkerTaskActionKind,
  WorkerTaskApproval,
  WorkerTaskResult
} from "@openrabbit/runtime-core";
import type { ApiRequestEnvelope } from "./contracts.js";

export interface PlatformWorkerSummary {
  id: string;
  role: string;
  displayName: string;
  status?: string;
}

export interface PlatformApprovalDecisionResult {
  approval: ApprovalRequest;
  taskResult?: WorkerTaskResult;
}

export interface PlatformPlanItemExecutionResult {
  item: CalendarPlanItem;
  taskResult: WorkerTaskResult;
}

export interface PlatformApiBackend {
  installRealEstatePack(orgId: string): Promise<{ packId: string; workerIds: string[] }>;
  listWorkers(orgId: string): Promise<PlatformWorkerSummary[]>;
  submitWorkerTask(input: {
    orgId: string;
    workerId: string;
    taskId: string;
    taskType: string;
    input: unknown;
    actionKind?: WorkerTaskActionKind;
    approval?: WorkerTaskApproval;
  }): Promise<WorkerTaskResult>;
  getTaskResult(orgId: string, taskId: string): Promise<WorkerTaskResult | undefined>;
  listApprovals(orgId: string): Promise<ApprovalRequest[]>;
  listAudit(orgId: string): Promise<AuditRecord[]>;
  decideApproval(input: {
    orgId: string;
    approvalId: string;
    decision: "approve" | "deny";
    decidedBy: string;
  }): Promise<PlatformApprovalDecisionResult>;
  getDailyPlan?(orgId: string, date: string): Promise<DailyPlan | undefined>;
  listPlanItems?(orgId: string, date: string): Promise<CalendarPlanItem[]>;
  saveDailyPlan?(input: {
    orgId: string;
    date: string;
    timezone: string;
    objective?: string;
    itemIds: string[];
    generatedBy?: string;
  }): Promise<DailyPlan>;
  executePlanItem?(input: {
    orgId: string;
    itemId: string;
    taskType: string;
    taskInput: unknown;
    actionKind?: WorkerTaskActionKind;
  }): Promise<PlatformPlanItemExecutionResult>;
}

export type PlatformApiRouteResult =
  | { matched: false }
  | { matched: true; status: number; data?: unknown; error?: { code: string; message: string } };

function segments(path: string): string[] {
  return path.split("?")[0].split("/").filter(Boolean);
}

function planningUnavailable(): PlatformApiRouteResult {
  return {
    matched: true,
    status: 501,
    error: {
      code: "PLANNING_BACKEND_NOT_AVAILABLE",
      message: "calendar planning backend is not available"
    }
  };
}

export async function routePlatformApi(
  request: ApiRequestEnvelope,
  backend: PlatformApiBackend
): Promise<PlatformApiRouteResult> {
  const method = request.method.toUpperCase();
  const parts = segments(request.path);

  if (parts[0] !== "v1" || parts[1] !== "orgs" || !parts[2]) {
    return { matched: false };
  }

  const orgId = parts[2];

  if (
    method === "POST" &&
    parts.length === 6 &&
    parts[3] === "packs" &&
    parts[4] === "real-estate" &&
    parts[5] === "install"
  ) {
    return { matched: true, status: 200, data: await backend.installRealEstatePack(orgId) };
  }

  if (method === "GET" && parts.length === 4 && parts[3] === "workers") {
    return { matched: true, status: 200, data: await backend.listWorkers(orgId) };
  }

  if (method === "GET" && parts.length === 4 && parts[3] === "approvals") {
    return { matched: true, status: 200, data: await backend.listApprovals(orgId) };
  }

  if (method === "GET" && parts.length === 4 && parts[3] === "audit") {
    return { matched: true, status: 200, data: await backend.listAudit(orgId) };
  }

  if (method === "GET" && parts.length === 5 && parts[3] === "plans") {
    if (!backend.getDailyPlan) return planningUnavailable();
    const plan = await backend.getDailyPlan(orgId, parts[4]);
    if (!plan) {
      return {
        matched: true,
        status: 404,
        error: { code: "DAILY_PLAN_NOT_FOUND", message: `Daily plan not found: ${parts[4]}` }
      };
    }
    return { matched: true, status: 200, data: plan };
  }

  if (
    method === "GET" &&
    parts.length === 6 &&
    parts[3] === "plans" &&
    parts[5] === "items"
  ) {
    if (!backend.listPlanItems) return planningUnavailable();
    return {
      matched: true,
      status: 200,
      data: await backend.listPlanItems(orgId, parts[4])
    };
  }

  if (method === "PUT" && parts.length === 5 && parts[3] === "plans") {
    if (!backend.saveDailyPlan) return planningUnavailable();
    const body = (request.body ?? {}) as Partial<{
      timezone: string;
      objective: string;
      itemIds: string[];
      generatedBy: string;
    }>;
    if (!body.timezone?.trim() || !Array.isArray(body.itemIds)) {
      return {
        matched: true,
        status: 400,
        error: {
          code: "INVALID_DAILY_PLAN",
          message: "timezone and itemIds are required"
        }
      };
    }
    return {
      matched: true,
      status: 200,
      data: await backend.saveDailyPlan({
        orgId,
        date: parts[4],
        timezone: body.timezone,
        objective: body.objective,
        itemIds: body.itemIds,
        generatedBy: body.generatedBy
      })
    };
  }

  if (
    method === "POST" &&
    parts.length === 8 &&
    parts[3] === "plans" &&
    parts[5] === "items" &&
    parts[7] === "execute"
  ) {
    if (!backend.executePlanItem) return planningUnavailable();
    const body = (request.body ?? {}) as Partial<{
      taskType: string;
      taskInput: unknown;
      actionKind: WorkerTaskActionKind;
    }>;
    if (!body.taskType?.trim()) {
      return {
        matched: true,
        status: 400,
        error: {
          code: "INVALID_PLAN_EXECUTION",
          message: "taskType is required"
        }
      };
    }
    if (body.actionKind && !["read", "write"].includes(body.actionKind)) {
      return {
        matched: true,
        status: 400,
        error: { code: "INVALID_ACTION_KIND", message: "actionKind must be read or write" }
      };
    }
    const result = await backend.executePlanItem({
      orgId,
      itemId: parts[6],
      taskType: body.taskType,
      taskInput: body.taskInput,
      actionKind: body.actionKind
    });
    return {
      matched: true,
      status: result.taskResult.status === "blocked" ? 202 : 200,
      data: result
    };
  }

  if (
    method === "POST" &&
    parts.length === 6 &&
    parts[3] === "approvals" &&
    ["approve", "deny"].includes(parts[5])
  ) {
    const body = (request.body ?? {}) as Partial<{ decidedBy: string }>;
    if (!body.decidedBy?.trim()) {
      return {
        matched: true,
        status: 400,
        error: { code: "DECIDED_BY_REQUIRED", message: "decidedBy is required" }
      };
    }
    const result = await backend.decideApproval({
      orgId,
      approvalId: parts[4],
      decision: parts[5] === "approve" ? "approve" : "deny",
      decidedBy: body.decidedBy
    });
    return { matched: true, status: 200, data: result };
  }

  if (
    method === "POST" &&
    parts.length === 6 &&
    parts[3] === "workers" &&
    parts[5] === "tasks"
  ) {
    const body = (request.body ?? {}) as Partial<{
      taskId: string;
      taskType: string;
      input: unknown;
      actionKind: WorkerTaskActionKind;
      approval: WorkerTaskApproval;
    }>;
    if (!body.taskId || !body.taskType) {
      return {
        matched: true,
        status: 400,
        error: { code: "INVALID_TASK_REQUEST", message: "taskId and taskType are required" }
      };
    }
    if (body.actionKind && !["read", "write"].includes(body.actionKind)) {
      return {
        matched: true,
        status: 400,
        error: { code: "INVALID_ACTION_KIND", message: "actionKind must be read or write" }
      };
    }
    const result = await backend.submitWorkerTask({
      orgId,
      workerId: parts[4],
      taskId: body.taskId,
      taskType: body.taskType,
      input: body.input,
      actionKind: body.actionKind,
      approval: body.approval
    });
    const status =
      result.status === "rejected"
        ? 409
        : result.status === "blocked"
          ? 202
          : 200;
    return { matched: true, status, data: result };
  }

  if (
    method === "GET" &&
    parts.length === 5 &&
    parts[3] === "tasks"
  ) {
    const result = await backend.getTaskResult(orgId, parts[4]);
    if (!result) {
      return {
        matched: true,
        status: 404,
        error: { code: "TASK_NOT_FOUND", message: `Task not found: ${parts[4]}` }
      };
    }
    return { matched: true, status: 200, data: result };
  }

  return { matched: false };
}
