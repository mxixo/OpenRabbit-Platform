import {
  IndustryPackCatalog,
  IndustryPackInstaller,
  PackInstallation,
  PackInstallRequest,
  PackInstallResult,
  PackInstallStatus
} from "../interfaces/industry-pack.js";
import type { CapabilityManager } from "../interfaces/capability-module.js";
import type { IntegrationAdapterRegistry } from "../interfaces/integration-adapter.js";
import {
  materializeWorkerPreset,
  WorkerDefinition,
  WorkerRegistry
} from "../interfaces/worker.js";

function installationKey(orgId: string, packId: string): string {
  return `${orgId}::${packId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneInstallation(installation: PackInstallation): PackInstallation {
  return {
    ...installation,
    installedCapabilityIds: [...installation.installedCapabilityIds],
    createdWorkerIds: installation.createdWorkerIds
      ? [...installation.createdWorkerIds]
      : undefined,
    error: installation.error ? { ...installation.error } : undefined,
    metadata: installation.metadata ? { ...installation.metadata } : undefined
  };
}

export interface InMemoryIndustryPackInstallerDeps {
  packs: IndustryPackCatalog;
  capabilities: CapabilityManager;
  /** Optional — when provided, pack integrations are validated as registered. */
  integrations?: IntegrationAdapterRegistry;
  /** Required when materializeWorkers is requested. */
  workers?: WorkerRegistry;
}

/**
 * Installs packs by composing capability installs and optional worker presets.
 * Does not embed industry business logic — only orchestration of manifests.
 */
export class InMemoryIndustryPackInstaller implements IndustryPackInstaller {
  private readonly installations = new Map<string, PackInstallation>();
  private readonly deps: InMemoryIndustryPackInstallerDeps;

  constructor(deps: InMemoryIndustryPackInstallerDeps) {
    this.deps = deps;
  }

  install(request: PackInstallRequest): PackInstallResult {
    if (!request.orgId?.trim()) {
      throw new Error("orgId is required");
    }
    if (!request.packId?.trim()) {
      throw new Error("packId is required");
    }

    const manifest = this.deps.packs.get(request.packId);
    if (!manifest) {
      throw new Error(`Industry pack not found in catalog: ${request.packId}`);
    }

    const version = request.version ?? manifest.version;
    if (version !== manifest.version) {
      throw new Error(
        `Pack version mismatch for ${manifest.id}: requested ${version}, catalog has ${manifest.version}`
      );
    }

    const key = installationKey(request.orgId, request.packId);
    const existing = this.installations.get(key);
    if (existing && existing.status !== "failed") {
      throw new Error(
        `Industry pack already installed for org ${request.orgId}: ${request.packId}`
      );
    }

    if (this.deps.integrations) {
      const missingIntegrations = manifest.integrations.filter(
        (integrationId) => !this.deps.integrations!.get(integrationId)
      );
      if (missingIntegrations.length > 0) {
        throw new Error(
          `Missing integration adapters for pack ${manifest.id}: ${missingIntegrations.join(", ")}`
        );
      }
    }

    if (request.materializeWorkers) {
      if (!this.deps.workers) {
        throw new Error(
          "Worker registry is required when materializeWorkers is true"
        );
      }
      if (!manifest.workerPresets?.length) {
        // Allowed — no workers to create.
      }
    }

    const enable = request.enable !== false;
    const installedCapabilityIds: string[] = [];
    const createdWorkers: WorkerDefinition[] = [];
    const createdWorkerIds: string[] = [];
    const timestamp = nowIso();

    try {
      for (const capabilityId of manifest.capabilities) {
        const already = this.deps.capabilities.getInstallation(
          request.orgId,
          capabilityId
        );
        if (!already) {
          this.deps.capabilities.install({
            orgId: request.orgId,
            capabilityId,
            enable
          });
        } else if (enable && already.status !== "enabled") {
          this.deps.capabilities.enable(request.orgId, capabilityId);
        } else if (!enable && already.status === "enabled") {
          // Leave existing enabled state if pack install requests disabled-only;
          // pack-level disable handles bulk disable later.
        }
        installedCapabilityIds.push(capabilityId);
      }

      if (request.materializeWorkers && manifest.workerPresets?.length) {
        const prefix = request.workerIdPrefix ?? manifest.id;
        for (const preset of manifest.workerPresets) {
          const workerId = `${prefix}.${preset.id}.${request.orgId}`;
          const worker = materializeWorkerPreset(preset, {
            id: workerId,
            orgId: request.orgId
          });
          // Ensure pack capabilities are reflected on the worker allow-list.
          const mergedCapabilities = uniqueStrings([
            ...worker.allowedCapabilities,
            ...manifest.capabilities
          ]);
          const finalWorker: WorkerDefinition = {
            ...worker,
            allowedCapabilities: mergedCapabilities
          };
          this.deps.workers!.register(finalWorker);
          createdWorkers.push(finalWorker);
          createdWorkerIds.push(finalWorker.id);
        }
      }

      const installation: PackInstallation = {
        orgId: request.orgId,
        packId: request.packId,
        version,
        status: enable ? "enabled" : "installed",
        installedAt: existing?.installedAt ?? timestamp,
        updatedAt: timestamp,
        installedCapabilityIds,
        createdWorkerIds: createdWorkerIds.length ? createdWorkerIds : undefined,
        metadata: request.metadata ? { ...request.metadata } : undefined
      };
      this.installations.set(key, installation);

      return {
        installation: cloneInstallation(installation),
        workers: createdWorkers.length ? createdWorkers : undefined
      };
    } catch (error) {
      const failed: PackInstallation = {
        orgId: request.orgId,
        packId: request.packId,
        version,
        status: installedCapabilityIds.length > 0 ? "partial" : "failed",
        installedAt: existing?.installedAt ?? timestamp,
        updatedAt: nowIso(),
        installedCapabilityIds,
        createdWorkerIds: createdWorkerIds.length ? createdWorkerIds : undefined,
        error: {
          code: "pack_install_failed",
          message: error instanceof Error ? error.message : "Pack install failed"
        },
        metadata: request.metadata ? { ...request.metadata } : undefined
      };
      this.installations.set(key, failed);
      throw error;
    }
  }

  enable(orgId: string, packId: string): PackInstallation {
    const installation = this.requireInstallation(orgId, packId);
    for (const capabilityId of installation.installedCapabilityIds) {
      const current = this.deps.capabilities.getInstallation(orgId, capabilityId);
      if (current && current.status !== "enabled") {
        this.deps.capabilities.enable(orgId, capabilityId);
      }
    }
    const next: PackInstallation = {
      ...installation,
      status: "enabled",
      updatedAt: nowIso(),
      error: undefined
    };
    this.installations.set(installationKey(orgId, packId), next);
    return cloneInstallation(next);
  }

  disable(orgId: string, packId: string): PackInstallation {
    const installation = this.requireInstallation(orgId, packId);
    for (const capabilityId of installation.installedCapabilityIds) {
      const current = this.deps.capabilities.getInstallation(orgId, capabilityId);
      if (current && current.status === "enabled") {
        this.deps.capabilities.disable(orgId, capabilityId);
      }
    }
    const next: PackInstallation = {
      ...installation,
      status: "disabled",
      updatedAt: nowIso()
    };
    this.installations.set(installationKey(orgId, packId), next);
    return cloneInstallation(next);
  }

  uninstall(orgId: string, packId: string): void {
    const installation = this.requireInstallation(orgId, packId);
    // Uninstall pack-created workers when present.
    if (installation.createdWorkerIds?.length && this.deps.workers) {
      for (const workerId of installation.createdWorkerIds) {
        try {
          this.deps.workers.unregister(workerId);
        } catch {
          // Worker may already be removed; continue pack uninstall.
        }
      }
    }
    // Capabilities may be shared across packs — leave them installed.
    // Callers that need full teardown can uninstall capabilities explicitly.
    if (!this.installations.delete(installationKey(orgId, packId))) {
      throw new Error(`Pack installation not found for org ${orgId}: ${packId}`);
    }
  }

  getInstallation(orgId: string, packId: string): PackInstallation | undefined {
    const installation = this.installations.get(installationKey(orgId, packId));
    return installation ? cloneInstallation(installation) : undefined;
  }

  listInstallations(
    orgId: string,
    filter?: { status?: PackInstallStatus }
  ): PackInstallation[] {
    return [...this.installations.values()]
      .filter((installation) => {
        if (installation.orgId !== orgId) {
          return false;
        }
        if (filter?.status && installation.status !== filter.status) {
          return false;
        }
        return true;
      })
      .map(cloneInstallation);
  }

  isEnabled(orgId: string, packId: string): boolean {
    return this.getInstallation(orgId, packId)?.status === "enabled";
  }

  private requireInstallation(orgId: string, packId: string): PackInstallation {
    const installation = this.installations.get(installationKey(orgId, packId));
    if (!installation) {
      throw new Error(`Pack installation not found for org ${orgId}: ${packId}`);
    }
    return installation;
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
