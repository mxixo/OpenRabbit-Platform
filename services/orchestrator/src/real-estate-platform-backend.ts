import type {
  WorkerTaskActionKind,
  WorkerTaskApproval,
  WorkerTaskResult
} from "@openrabbit/runtime-core";
import { bootstrapRealEstateOrg, RealEstateBootstrap } from "./bootstrap-real-estate.js";

export interface RealEstatePlatformWorkerSummary {
  id: string;
  role: string;
  displayName: string;
  status?: string;
}

export interface RealEstatePlatformBackendContract {
  installRealEstatePack(orgId: string): Promise<{ packId: string; workerIds: string[] }>;
  listWorkers(orgId: string): Promise<RealEstatePlatformWorkerSummary[]>;
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

/**
 * Concrete backend for the first Platform API routes.
 *
 * It deliberately lives with orchestration/composition instead of the API
 * gateway. The API gateway depends only on a structural backend contract.
 */
export class RealEstatePlatformBackend implements RealEstatePlatformBackendContract {
  private readonly orgs = new Map<string, RealEstateBootstrap>();
  private readonly taskResults = new Map<string, WorkerTaskResult>();

  async installRealEstatePack(
    orgId: string
  ): Promise<{ packId: string; workerIds: string[] }> {
    const normalizedOrgId = orgId.trim();
    if (!normalizedOrgId) {
      throw new Error("orgId is required");
    }

    let bootstrap = this.orgs.get(normalizedOrgId);
    if (!bootstrap) {
      bootstrap = await bootstrapRealEstateOrg(normalizedOrgId);
      this.orgs.set(normalizedOrgId, bootstrap);
    }

    return {
      packId: "pack.real-estate",
      workerIds: [
        bootstrap.acquisitionsWorker.id,
        ...(bootstrap.researchWorker ? [bootstrap.researchWorker.id] : [])
      ]
    };
  }

  async listWorkers(orgId: string): Promise<RealEstatePlatformWorkerSummary[]> {
    const bootstrap = this.orgs.get(orgId);
    if (!bootstrap) {
      return [];
    }

    return [bootstrap.acquisitionsWorker, bootstrap.researchWorker]
      .filter((worker): worker is NonNullable<typeof worker> => Boolean(worker))
      .map((worker) => ({
        id: worker.id,
        role: worker.role,
        displayName: worker.displayName,
        status: worker.status ?? "active"
      }));
  }

  async submitWorkerTask(input: {
    orgId: string;
    workerId: string;
    taskId: string;
    taskType: string;
    input: unknown;
    actionKind?: WorkerTaskActionKind;
    approval?: WorkerTaskApproval;
  }): Promise<WorkerTaskResult> {
    const bootstrap = this.orgs.get(input.orgId);
    if (!bootstrap) {
      return {
        workerId: input.workerId,
        taskId: input.taskId,
        status: "rejected",
        error: {
          code: "pack_not_installed",
          message: `Real Estate Pack is not installed for org ${input.orgId}`
        },
        completedAt: new Date().toISOString()
      };
    }

    const result = await bootstrap.service.runWorkerTask({
      workerId: input.workerId,
      taskId: input.taskId,
      taskType: input.taskType,
      input: input.input,
      actionKind: input.actionKind,
      approval: input.approval
    });

    this.taskResults.set(this.taskKey(input.orgId, input.taskId), result);
    return result;
  }

  async getTaskResult(
    orgId: string,
    taskId: string
  ): Promise<WorkerTaskResult | undefined> {
    return this.taskResults.get(this.taskKey(orgId, taskId));
  }

  async stopOrg(orgId: string): Promise<void> {
    const bootstrap = this.orgs.get(orgId);
    if (!bootstrap) {
      return;
    }
    await bootstrap.service.stop();
    this.orgs.delete(orgId);
  }

  private taskKey(orgId: string, taskId: string): string {
    return `${orgId}:${taskId}`;
  }
}
