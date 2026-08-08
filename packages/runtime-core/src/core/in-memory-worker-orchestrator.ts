import {
  RuntimeSession,
  ToolRef
} from "../interfaces/runtime-provider.js";
import {
  WorkerOrchestrator,
  WorkerOrchestratorDeps,
  WorkerTaskRequest,
  WorkerTaskResult
} from "../interfaces/worker.js";

interface ActiveSession {
  session: RuntimeSession;
  runtimeProviderId: string;
}

/**
 * Reference WorkerOrchestrator:
 * resolve worker → enforce approval policy → pick RuntimeProvider → project allow-listed tools → run task.
 */
export class InMemoryWorkerOrchestrator implements WorkerOrchestrator {
  private readonly sessionsByWorker = new Map<string, ActiveSession>();
  private readonly deps: WorkerOrchestratorDeps;

  constructor(deps: WorkerOrchestratorDeps) {
    this.deps = deps;
  }

  async ensureSession(workerId: string): Promise<RuntimeSession> {
    const existing = this.sessionsByWorker.get(workerId);
    if (existing && existing.session.status !== "stopped" && existing.session.status !== "failed") {
      return existing.session;
    }

    const worker = this.deps.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker not found: ${workerId}`);
    }
    if ((worker.status ?? "active") !== "active") {
      throw new Error(`Worker is not active: ${workerId}`);
    }

    const provider = this.deps.runtimes.resolvePreference(worker.runtimePreference);
    const projectedTools = this.projectTools(worker.allowedTools);

    const session = await provider.startSession({
      requestId: `session-req-${workerId}-${Date.now()}`,
      orgId: worker.orgId,
      workerId: worker.id,
      projectedTools,
      allowedCapabilities: [...worker.allowedCapabilities],
      memoryScope: worker.memoryScope,
      metadata: {
        role: worker.role,
        approvalPolicyId: worker.approvalPolicy.policyId,
        requiresApproval: worker.approvalPolicy.requiresApproval ?? false
      }
    });

    this.sessionsByWorker.set(workerId, {
      session,
      runtimeProviderId: provider.id
    });

    return session;
  }

  async runTask(request: WorkerTaskRequest): Promise<WorkerTaskResult> {
    const completedAt = () => new Date().toISOString();

    const worker = this.deps.workers.get(request.workerId);
    if (!worker) {
      return {
        workerId: request.workerId,
        taskId: request.taskId,
        status: "rejected",
        error: {
          code: "worker_not_found",
          message: `Worker not found: ${request.workerId}`
        },
        completedAt: completedAt()
      };
    }

    if ((worker.status ?? "active") !== "active") {
      return {
        workerId: worker.id,
        taskId: request.taskId,
        status: "rejected",
        error: {
          code: "worker_inactive",
          message: `Worker is not active: ${worker.id}`
        },
        completedAt: completedAt()
      };
    }

    const actionKind = request.actionKind ?? "read";
    const requiresApproval = worker.approvalPolicy.requiresApproval ?? false;
    if (requiresApproval && actionKind === "write" && request.approval?.granted !== true) {
      return {
        workerId: worker.id,
        taskId: request.taskId,
        status: "blocked",
        error: {
          code: "approval_required",
          message: `Human approval is required by policy ${worker.approvalPolicy.policyId}`,
          retryable: false
        },
        completedAt: completedAt()
      };
    }

    try {
      let session: RuntimeSession;
      let runtimeProviderId: string;

      if (request.sessionId) {
        const active = this.sessionsByWorker.get(worker.id);
        if (!active || active.session.sessionId !== request.sessionId) {
          return {
            workerId: worker.id,
            taskId: request.taskId,
            status: "rejected",
            error: {
              code: "session_not_found",
              message: `Session not found for worker: ${request.sessionId}`
            },
            completedAt: completedAt()
          };
        }
        session = active.session;
        runtimeProviderId = active.runtimeProviderId;
      } else {
        session = await this.ensureSession(worker.id);
        runtimeProviderId = this.sessionsByWorker.get(worker.id)!.runtimeProviderId;
      }

      const provider = this.deps.runtimes.resolvePreference([runtimeProviderId]);
      const runtimeResult = await provider.runTask({
        sessionId: session.sessionId,
        taskId: request.taskId,
        taskType: request.taskType,
        input: request.input,
        timeoutMs: request.timeoutMs,
        metadata: {
          ...request.metadata,
          workerId: worker.id,
          orgId: worker.orgId,
          allowedTools: worker.allowedTools,
          allowedCapabilities: worker.allowedCapabilities,
          actionKind,
          approvalPolicyId: worker.approvalPolicy.policyId,
          approvalId: request.approval?.approvalId,
          approvedBy: request.approval?.approvedBy,
          approvedAt: request.approval?.approvedAt
        }
      });

      const status =
        runtimeResult.status === "completed"
          ? "completed"
          : runtimeResult.status === "blocked"
            ? "blocked"
            : runtimeResult.status === "cancelled"
              ? "cancelled"
              : "failed";

      return {
        workerId: worker.id,
        taskId: request.taskId,
        status,
        runtimeProviderId,
        sessionId: session.sessionId,
        output: runtimeResult.output,
        error: runtimeResult.error
          ? {
              code: runtimeResult.error.code,
              message: runtimeResult.error.message,
              retryable: runtimeResult.error.retryable
            }
          : undefined,
        runtimeResult,
        completedAt: runtimeResult.completedAt
      };
    } catch (error) {
      return {
        workerId: worker.id,
        taskId: request.taskId,
        status: "failed",
        error: {
          code: "orchestrator_error",
          message: error instanceof Error ? error.message : "Unknown orchestrator error",
          retryable: true
        },
        completedAt: completedAt()
      };
    }
  }

  async stopSession(workerId: string): Promise<void> {
    const active = this.sessionsByWorker.get(workerId);
    if (!active) {
      return;
    }
    const provider = this.deps.runtimes.resolvePreference([active.runtimeProviderId]);
    await provider.stopSession(active.session.sessionId);
    this.sessionsByWorker.delete(workerId);
  }

  private projectTools(allowedTools: readonly string[]): ToolRef[] {
    if (this.deps.resolveTools) {
      const resolved = this.deps.resolveTools(allowedTools);
      const allowed = new Set(allowedTools);
      // Enforce allow-list even if resolver returns extras.
      return resolved.filter((tool) => allowed.has(tool.name));
    }
    return allowedTools.map((name) => ({ name }));
  }
}
