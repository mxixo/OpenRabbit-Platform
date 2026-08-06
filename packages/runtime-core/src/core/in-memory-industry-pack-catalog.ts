import {
  IndustryPackCatalog,
  IndustryPackManifest
} from "../interfaces/industry-pack.js";

export class InMemoryIndustryPackCatalog implements IndustryPackCatalog {
  private readonly packs = new Map<string, IndustryPackManifest>();

  register(manifest: IndustryPackManifest): void {
    assertPackManifest(manifest);
    if (this.packs.has(manifest.id)) {
      throw new Error(`Industry pack already registered: ${manifest.id}`);
    }
    this.packs.set(manifest.id, clonePack(manifest));
  }

  unregister(packId: string): void {
    if (!this.packs.delete(packId)) {
      throw new Error(`Industry pack not found: ${packId}`);
    }
  }

  get(packId: string): IndustryPackManifest | undefined {
    const manifest = this.packs.get(packId);
    return manifest ? clonePack(manifest) : undefined;
  }

  list(filter?: { tag?: string }): IndustryPackManifest[] {
    return [...this.packs.values()]
      .filter((manifest) => {
        if (!filter?.tag) {
          return true;
        }
        return (manifest.tags ?? []).includes(filter.tag);
      })
      .map(clonePack);
  }
}

export function assertPackManifest(manifest: IndustryPackManifest): void {
  if (!manifest.id?.trim()) {
    throw new Error("Pack id is required");
  }
  if (!manifest.version?.trim()) {
    throw new Error(`Pack ${manifest.id} version is required`);
  }
  if (!manifest.name?.trim()) {
    throw new Error(`Pack ${manifest.id} name is required`);
  }
  if (!Array.isArray(manifest.capabilities)) {
    throw new Error(`Pack ${manifest.id} capabilities must be an array`);
  }
  if (!Array.isArray(manifest.integrations)) {
    throw new Error(`Pack ${manifest.id} integrations must be an array`);
  }
}

export function clonePack(manifest: IndustryPackManifest): IndustryPackManifest {
  return {
    ...manifest,
    capabilities: [...manifest.capabilities],
    integrations: [...manifest.integrations],
    workerPresets: manifest.workerPresets?.map((preset) => ({
      ...preset,
      runtimePreference: [...preset.runtimePreference],
      allowedCapabilities: [...preset.allowedCapabilities],
      allowedTools: [...preset.allowedTools],
      approvalPolicy: { ...preset.approvalPolicy },
      tags: preset.tags ? [...preset.tags] : undefined,
      metadata: preset.metadata ? { ...preset.metadata } : undefined
    })),
    workflowPresets: manifest.workflowPresets
      ? [...manifest.workflowPresets]
      : undefined,
    defaults: manifest.defaults ? { ...manifest.defaults } : undefined,
    tags: manifest.tags ? [...manifest.tags] : undefined,
    metadata: manifest.metadata ? { ...manifest.metadata } : undefined
  };
}
