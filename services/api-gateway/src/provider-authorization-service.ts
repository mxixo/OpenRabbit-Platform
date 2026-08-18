import type { DelegatedAuthorizationAdapter, InMemoryProviderConnectionStore, ProviderCapability } from "./provider-connections.js";

export class ProviderAuthorizationService {
  private readonly adapters = new Map<string, DelegatedAuthorizationAdapter>();

  constructor(private readonly connections: InMemoryProviderConnectionStore) {}

  register(adapter: DelegatedAuthorizationAdapter): void {
    this.adapters.set(adapter.provider.toLowerCase(), adapter);
  }

  has(provider: string): boolean {
    return this.adapters.has(provider.toLowerCase());
  }

  async begin(input: { orgId: string; provider: string; redirectUri: string; capabilities: ProviderCapability[] }): Promise<{ authorizationUrl: string; state: string }> {
    const provider = input.provider.toLowerCase();
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new Error(`provider authorization adapter not configured: ${provider}`);
    const result = await adapter.beginAuthorization({ orgId: input.orgId, redirectUri: input.redirectUri, requestedCapabilities: input.capabilities });
    await this.connections.upsert(input.orgId, { provider, status: "authorizing", capabilities: input.capabilities });
    return result;
  }

  async complete(input: { orgId: string; provider: string; code: string; state: string; redirectUri: string }): Promise<void> {
    const provider = input.provider.toLowerCase();
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new Error(`provider authorization adapter not configured: ${provider}`);
    try {
      const result = await adapter.completeAuthorization({ orgId: input.orgId, code: input.code, state: input.state, redirectUri: input.redirectUri });
      await this.connections.upsert(input.orgId, {
        provider,
        status: "connected",
        accountLabel: result.accountLabel,
        capabilities: result.capabilities,
        scopes: result.scopes,
        lastSyncAt: undefined
      });
    } catch (error) {
      await this.connections.upsert(input.orgId, {
        provider,
        status: "error",
        error: error instanceof Error ? error.message : "provider authorization failed"
      });
      throw error;
    }
  }

  async revoke(orgId: string, providerValue: string): Promise<void> {
    const provider = providerValue.toLowerCase();
    const adapter = this.adapters.get(provider);
    if (adapter) await adapter.revoke(orgId);
    await this.connections.upsert(orgId, { provider, status: "disconnected", capabilities: [], scopes: [] });
  }
}
