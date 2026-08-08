import type {
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
}

export type PlatformApiRouteResult =
  | { matched: false }
  | { matched: true; status: number; data?: unknown; error?: { code: string; message: string } };

function segments(path: string): string[] {
  return path.split("?")[0].split("/").filter(Boolean);
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
