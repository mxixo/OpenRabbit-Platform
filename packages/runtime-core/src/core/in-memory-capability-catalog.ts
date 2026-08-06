import {
  CapabilityCatalog,
  CapabilityModuleManifest
} from "../interfaces/capability-module.js";

export class InMemoryCapabilityCatalog implements CapabilityCatalog {
  private readonly modules = new Map<string, CapabilityModuleManifest>();

  register(manifest: CapabilityModuleManifest): void {
    assertCapabilityManifest(manifest);
    if (this.modules.has(manifest.id)) {
      throw new Error(`Capability already registered: ${manifest.id}`);
    }
    this.modules.set(manifest.id, cloneCapability(manifest));
  }

  unregister(capabilityId: string): void {
    if (!this.modules.delete(capabilityId)) {
      throw new Error(`Capability not found: ${capabilityId}`);
    }
  }

  get(capabilityId: string): CapabilityModuleManifest | undefined {
    const manifest = this.modules.get(capabilityId);
    return manifest ? cloneCapability(manifest) : undefined;
  }

  list(filter?: { tag?: string }): CapabilityModuleManifest[] {
    return [...this.modules.values()]
      .filter((manifest) => {
        if (!filter?.tag) {
          return true;
        }
        return (manifest.tags ?? []).includes(filter.tag);
      })
      .map(cloneCapability);
  }
}

export function assertCapabilityManifest(
  manifest: CapabilityModuleManifest
): void {
  if (!manifest.id?.trim()) {
    throw new Error("Capability id is required");
  }
  if (!manifest.version?.trim()) {
    throw new Error(`Capability ${manifest.id} version is required`);
  }
  if (!manifest.name?.trim()) {
    throw new Error(`Capability ${manifest.id} name is required`);
  }
}

export function cloneCapability(
  manifest: CapabilityModuleManifest
): CapabilityModuleManifest {
  return {
    ...manifest,
    tools: manifest.tools?.map((tool) => ({ ...tool })),
    workflows: manifest.workflows?.map((workflow) => ({ ...workflow })),
    knowledgeSchemas: manifest.knowledgeSchemas
      ? [...manifest.knowledgeSchemas]
      : undefined,
    permissions: manifest.permissions?.map((permission) => ({ ...permission })),
    integrations: manifest.integrations ? [...manifest.integrations] : undefined,
    uiContributions: manifest.uiContributions?.map((ui) => ({ ...ui })),
    dependsOnCapabilities: manifest.dependsOnCapabilities
      ? [...manifest.dependsOnCapabilities]
      : undefined,
    tags: manifest.tags ? [...manifest.tags] : undefined,
    metadata: manifest.metadata ? { ...manifest.metadata } : undefined
  };
}
