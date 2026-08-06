import {
  WorkerDefinition,
  WorkerRegistry,
  WorkerStatus
} from "../interfaces/worker.js";

export class InMemoryWorkerRegistry implements WorkerRegistry {
  private readonly workers = new Map<string, WorkerDefinition>();

  register(worker: WorkerDefinition): void {
    if (this.workers.has(worker.id)) {
      throw new Error(`Worker already registered: ${worker.id}`);
    }
    this.assertWorker(worker);
    this.workers.set(worker.id, cloneWorker(worker));
  }

  get(workerId: string): WorkerDefinition | undefined {
    const worker = this.workers.get(workerId);
    return worker ? cloneWorker(worker) : undefined;
  }

  list(filter?: {
    orgId?: string;
    role?: string;
    status?: WorkerStatus;
  }): WorkerDefinition[] {
    return [...this.workers.values()]
      .filter((worker) => {
        if (filter?.orgId && worker.orgId !== filter.orgId) {
          return false;
        }
        if (filter?.role && worker.role !== filter.role) {
          return false;
        }
        if (filter?.status && (worker.status ?? "active") !== filter.status) {
          return false;
        }
        return true;
      })
      .map(cloneWorker);
  }

  update(
    workerId: string,
    patch: Partial<Omit<WorkerDefinition, "id">>
  ): WorkerDefinition {
    const current = this.workers.get(workerId);
    if (!current) {
      throw new Error(`Worker not found: ${workerId}`);
    }
    const next: WorkerDefinition = {
      ...current,
      ...patch,
      id: current.id,
      approvalPolicy: patch.approvalPolicy
        ? { ...patch.approvalPolicy }
        : { ...current.approvalPolicy },
      runtimePreference: patch.runtimePreference
        ? [...patch.runtimePreference]
        : [...current.runtimePreference],
      allowedCapabilities: patch.allowedCapabilities
        ? [...patch.allowedCapabilities]
        : [...current.allowedCapabilities],
      allowedTools: patch.allowedTools
        ? [...patch.allowedTools]
        : [...current.allowedTools]
    };
    this.assertWorker(next);
    this.workers.set(workerId, cloneWorker(next));
    return cloneWorker(next);
  }

  unregister(workerId: string): void {
    if (!this.workers.delete(workerId)) {
      throw new Error(`Worker not found: ${workerId}`);
    }
  }

  private assertWorker(worker: WorkerDefinition): void {
    if (!worker.id.trim()) {
      throw new Error("Worker id is required");
    }
    if (!worker.orgId.trim()) {
      throw new Error("Worker orgId is required");
    }
    if (!worker.displayName.trim()) {
      throw new Error("Worker displayName is required");
    }
    if (worker.runtimePreference.length === 0) {
      throw new Error(`Worker ${worker.id} must declare at least one runtimePreference`);
    }
    if (!worker.approvalPolicy?.policyId?.trim()) {
      throw new Error(`Worker ${worker.id} approvalPolicy.policyId is required`);
    }
  }
}

function cloneWorker(worker: WorkerDefinition): WorkerDefinition {
  return {
    ...worker,
    runtimePreference: [...worker.runtimePreference],
    allowedCapabilities: [...worker.allowedCapabilities],
    allowedTools: [...worker.allowedTools],
    approvalPolicy: { ...worker.approvalPolicy },
    tags: worker.tags ? [...worker.tags] : undefined,
    metadata: worker.metadata ? { ...worker.metadata } : undefined
  };
}
