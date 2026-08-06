import {
  RuntimeProvider,
  RuntimeProviderRegistry
} from "../interfaces/runtime-provider.js";

export class InMemoryRuntimeProviderRegistry implements RuntimeProviderRegistry {
  private readonly providers = new Map<string, RuntimeProvider>();

  register(provider: RuntimeProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Runtime provider already registered: ${provider.id}`);
    }
    this.providers.set(provider.id, provider);
  }

  unregister(providerId: string): void {
    if (!this.providers.delete(providerId)) {
      throw new Error(`Runtime provider not found: ${providerId}`);
    }
  }

  get(providerId: string): RuntimeProvider | undefined {
    return this.providers.get(providerId);
  }

  list(): RuntimeProvider[] {
    return [...this.providers.values()];
  }

  resolvePreference(preferredProviderIds: readonly string[]): RuntimeProvider {
    if (preferredProviderIds.length === 0) {
      throw new Error("Runtime preference list is empty");
    }

    for (const id of preferredProviderIds) {
      const provider = this.providers.get(id);
      if (provider) {
        return provider;
      }
    }

    throw new Error(
      `No registered runtime provider matched preference: ${preferredProviderIds.join(", ")}`
    );
  }
}
