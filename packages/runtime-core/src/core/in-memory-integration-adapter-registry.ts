import {
  IntegrationAdapter,
  IntegrationAdapterRegistry,
  IntegrationKind
} from "../interfaces/integration-adapter.js";

export class InMemoryIntegrationAdapterRegistry
  implements IntegrationAdapterRegistry
{
  private readonly adapters = new Map<string, IntegrationAdapter>();

  register(adapter: IntegrationAdapter): void {
    if (!adapter.id?.trim()) {
      throw new Error("Integration adapter id is required");
    }
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Integration adapter already registered: ${adapter.id}`);
    }
    this.adapters.set(adapter.id, adapter);
  }

  unregister(adapterId: string): void {
    if (!this.adapters.delete(adapterId)) {
      throw new Error(`Integration adapter not found: ${adapterId}`);
    }
  }

  get(adapterId: string): IntegrationAdapter | undefined {
    return this.adapters.get(adapterId);
  }

  list(filter?: { kind?: IntegrationKind }): IntegrationAdapter[] {
    return [...this.adapters.values()].filter((adapter) => {
      if (filter?.kind && adapter.kind !== filter.kind) {
        return false;
      }
      return true;
    });
  }
}
