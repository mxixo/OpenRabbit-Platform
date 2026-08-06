import {
  CapabilityCatalog,
  CapabilityInstallRequest,
  CapabilityInstallation,
  CapabilityInstallStatus,
  CapabilityManager
} from "../interfaces/capability-module.js";

function installationKey(orgId: string, capabilityId: string): string {
  return `${orgId}::${capabilityId}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneInstallation(
  installation: CapabilityInstallation
): CapabilityInstallation {
  return {
    ...installation,
    error: installation.error ? { ...installation.error } : undefined,
    metadata: installation.metadata ? { ...installation.metadata } : undefined
  };
}

export class InMemoryCapabilityManager implements CapabilityManager {
  private readonly installations = new Map<string, CapabilityInstallation>();

  constructor(private readonly catalog: CapabilityCatalog) {}

  install(request: CapabilityInstallRequest): CapabilityInstallation {
    if (!request.orgId?.trim()) {
      throw new Error("orgId is required");
    }
    if (!request.capabilityId?.trim()) {
      throw new Error("capabilityId is required");
    }

    const manifest = this.catalog.get(request.capabilityId);
    if (!manifest) {
      throw new Error(`Capability not found in catalog: ${request.capabilityId}`);
    }

    const version = request.version ?? manifest.version;
    if (version !== manifest.version) {
      throw new Error(
        `Capability version mismatch for ${manifest.id}: requested ${version}, catalog has ${manifest.version}`
      );
    }

    const missingDeps = (manifest.dependsOnCapabilities ?? []).filter(
      (depId) => !this.isInstalled(request.orgId, depId)
    );
    if (missingDeps.length > 0) {
      throw new Error(
        `Missing capability dependencies for ${manifest.id}: ${missingDeps.join(", ")}`
      );
    }

    const key = installationKey(request.orgId, request.capabilityId);
    const existing = this.installations.get(key);
    if (existing && existing.status !== "failed") {
      throw new Error(
        `Capability already installed for org ${request.orgId}: ${request.capabilityId}`
      );
    }

    const timestamp = nowIso();
    const enable = request.enable !== false;
    const installation: CapabilityInstallation = {
      orgId: request.orgId,
      capabilityId: request.capabilityId,
      version,
      status: enable ? "enabled" : "installed",
      installedAt: existing?.installedAt ?? timestamp,
      updatedAt: timestamp,
      metadata: request.metadata ? { ...request.metadata } : undefined
    };

    this.installations.set(key, installation);
    return cloneInstallation(installation);
  }

  enable(orgId: string, capabilityId: string): CapabilityInstallation {
    const installation = this.requireInstallation(orgId, capabilityId);
    if (installation.status === "enabled") {
      return cloneInstallation(installation);
    }
    const next: CapabilityInstallation = {
      ...installation,
      status: "enabled",
      updatedAt: nowIso(),
      error: undefined
    };
    this.installations.set(installationKey(orgId, capabilityId), next);
    return cloneInstallation(next);
  }

  disable(orgId: string, capabilityId: string): CapabilityInstallation {
    const installation = this.requireInstallation(orgId, capabilityId);
    const next: CapabilityInstallation = {
      ...installation,
      status: "disabled",
      updatedAt: nowIso()
    };
    this.installations.set(installationKey(orgId, capabilityId), next);
    return cloneInstallation(next);
  }

  uninstall(orgId: string, capabilityId: string): void {
    const key = installationKey(orgId, capabilityId);
    if (!this.installations.delete(key)) {
      throw new Error(
        `Capability installation not found for org ${orgId}: ${capabilityId}`
      );
    }
  }

  getInstallation(
    orgId: string,
    capabilityId: string
  ): CapabilityInstallation | undefined {
    const installation = this.installations.get(
      installationKey(orgId, capabilityId)
    );
    return installation ? cloneInstallation(installation) : undefined;
  }

  listInstallations(
    orgId: string,
    filter?: { status?: CapabilityInstallStatus }
  ): CapabilityInstallation[] {
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

  listEnabledCapabilityIds(orgId: string): string[] {
    return this.listInstallations(orgId, { status: "enabled" }).map(
      (installation) => installation.capabilityId
    );
  }

  isEnabled(orgId: string, capabilityId: string): boolean {
    const installation = this.installations.get(
      installationKey(orgId, capabilityId)
    );
    return installation?.status === "enabled";
  }

  private isInstalled(orgId: string, capabilityId: string): boolean {
    const installation = this.installations.get(
      installationKey(orgId, capabilityId)
    );
    return (
      installation !== undefined &&
      installation.status !== "failed"
    );
  }

  private requireInstallation(
    orgId: string,
    capabilityId: string
  ): CapabilityInstallation {
    const installation = this.installations.get(
      installationKey(orgId, capabilityId)
    );
    if (!installation) {
      throw new Error(
        `Capability installation not found for org ${orgId}: ${capabilityId}`
      );
    }
    return installation;
  }
}
