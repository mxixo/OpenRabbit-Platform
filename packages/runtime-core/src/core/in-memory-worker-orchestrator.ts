import {
  RuntimeSession,
  ToolRef
} from "../interfaces/runtime-provider.js";
import {
  WorkerDefinition,
  WorkerExecutionContext,
  WorkerOrchestrator,
  WorkerOrchestratorDeps,
  WorkerTaskRequest,
  WorkerTaskResult
} from "../interfaces/worker.js";

interface ActiveSession {
  session: RuntimeSession;
  runtimeProviderId: string;
  policyFingerprint: string;
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

  async ensureSession(
    context: WorkerExecutionContext,
    workerId: string
  ): Promise<RuntimeSession> {
    this.assertExecutionContext(context);
    const worker = this.getWorkerForOrg(context.orgId, workerId);
    if ((worker.status ?? "active") !== "active") {
      throw new Error(`Worker is not active: ${workerId}`);
    }

    const key = sessionKey(context.orgId, workerId);
    const fingerprint = workerPolicyFingerprint(worker);
    const existing = this.sessionsByWorker.get(key);
    if (existing && existing.session.status !== "stopped" && existing.session.status !== "failed") {
      if (
        existing.session.orgId === context.orgId &&
        existing.session.workerId === worker.id &&
        existing.policyFingerprint === fingerprint
      ) {
        return cloneSession(existing.session);
      }
      const existingProvider = this.deps.runtimes.resolvePreference([
        existing.runtimeProviderId
      ]);
      await existingProvider.stopSession(existing.session.sessionId);
      this.sessionsByWorker.delete(key);
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
        initiatedBy: context.subjectId,
        approvalPolicyId: worker.approvalPolicy.policyId,
        requiresApproval: worker.approvalPolicy.requiresApproval ?? false
      }
    });

    if (
      session.orgId !== context.orgId ||
      session.workerId !== worker.id ||
      session.runtimeProviderId !== provider.id
    ) {
      await provider.stopSession(session.sessionId).catch(() => undefined);
      throw new Error(`Runtime returned a session outside the authorized worker boundary`);
    }

    const currentWorker = this.getWorkerForOrg(context.orgId, workerId);
    if (workerPolicyFingerprint(currentWorker) !== fingerprint) {
      await provider.stopSession(session.sessionId).catch(() => undefined);
      return this.ensureSession(context, workerId);
    }

    this.sessionsByWorker.set(key, {
      session: cloneSession(session),
      runtimeProviderId: provider.id,
      policyFingerprint: fingerprint
    });

    return cloneSession(session);
  }

  async runTask(
    context: WorkerExecutionContext,
    request: WorkerTaskRequest
  ): Promise<WorkerTaskResult> {
    const completedAt = () => new Date().toISOString();

    if (!context?.orgId?.trim() || !context?.subjectId?.trim()) {
      return {
        workerId: request.workerId,
        taskId: request.taskId,
        status: "rejected",
        error: {
          code: "invalid_execution_context",
          message: "Authenticated organization and subject are required"
        },
        completedAt: completedAt()
      };
    }

    const worker = this.deps.workers.get(request.workerId);
    if (!worker || worker.orgId !== context.orgId) {
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
        const key = sessionKey(context.orgId, worker.id);
        const active = this.sessionsByWorker.get(key);
        const currentFingerprint = workerPolicyFingerprint(worker);
        const sessionIsCurrent =
          active &&
          active.session.sessionId === request.sessionId &&
          active.session.orgId === context.orgId &&
          active.session.workerId === worker.id &&
          active.policyFingerprint === currentFingerprint;
        if (!sessionIsCurrent) {
          if (active && active.policyFingerprint !== currentFingerprint) {
            const staleProvider = this.deps.runtimes.resolvePreference([
              active.runtimeProviderId
            ]);
            await staleProvider.stopSession(active.session.sessionId);
            this.sessionsByWorker.delete(key);
          }
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
        session = await this.ensureSession(context, worker.id);
        runtimeProviderId = this.sessionsByWorker.get(
          sessionKey(context.orgId, worker.id)
        )!.runtimeProviderId;
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
          initiatedBy: context.subjectId,
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

  async stopSession(context: WorkerExecutionContext, workerId: string): Promise<void> {
    this.assertExecutionContext(context);
    this.getWorkerForOrg(context.orgId, workerId);
    const key = sessionKey(context.orgId, workerId);
    const active = this.sessionsByWorker.get(key);
    if (!active) {
      return;
    }
    const provider = this.deps.runtimes.resolvePreference([active.runtimeProviderId]);
    await provider.stopSession(active.session.sessionId);
    this.sessionsByWorker.delete(key);
  }

  private getWorkerForOrg(orgId: string, workerId: string): WorkerDefinition {
    const worker = this.deps.workers.get(workerId);
    if (!worker || worker.orgId !== orgId) {
      throw new Error(`Worker not found: ${workerId}`);
    }
    return worker;
  }

  private assertExecutionContext(context: WorkerExecutionContext): void {
    if (!context?.orgId?.trim() || !context?.subjectId?.trim()) {
      throw new Error("Authenticated organization and subject are required");
    }
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

function sessionKey(orgId: string, workerId: string): string {
  return JSON.stringify([orgId, workerId]);
}

function workerPolicyFingerprint(worker: WorkerDefinition): string {
  return JSON.stringify({
    runtimePreference: worker.runtimePreference,
    allowedCapabilities: worker.allowedCapabilities,
    allowedTools: worker.allowedTools,
    memoryScope: worker.memoryScope,
    approvalPolicy: worker.approvalPolicy
  });
}

function cloneSession(session: RuntimeSession): RuntimeSession {
  return {
    ...session,
    metadata: session.metadata ? { ...session.metadata } : undefined
  };
}
