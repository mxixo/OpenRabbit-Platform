export type ProviderConnectionStatus = "disconnected" | "authorizing" | "connected" | "error";
export type ProviderCapability =
  | "email.read"
  | "email.draft"
  | "email.send"
  | "calendar.read"
  | "calendar.write";

export interface ProviderConnection {
  orgId: string;
  provider: string;
  accountLabel?: string;
  status: ProviderConnectionStatus;
  capabilities: ProviderCapability[];
  scopes: string[];
  connectedAt?: string;
  lastSyncAt?: string;
  error?: string;
  updatedAt: string;
}

export interface UpsertProviderConnectionInput {
  provider: string;
  accountLabel?: string;
  status: ProviderConnectionStatus;
  capabilities?: ProviderCapability[];
  scopes?: string[];
  connectedAt?: string;
  lastSyncAt?: string;
  error?: string;
}

function key(orgId: string, provider: string): string {
  return `${orgId}:${provider.toLowerCase()}`;
}

function unique(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

export class InMemoryProviderConnectionStore {
  private readonly records = new Map<string, ProviderConnection>();

  async list(orgId: string): Promise<ProviderConnection[]> {
    return [...this.records.values()].filter((record) => record.orgId === orgId);
  }

  async get(orgId: string, provider: string): Promise<ProviderConnection | undefined> {
    return this.records.get(key(orgId, provider));
  }

  async upsert(orgId: string, input: UpsertProviderConnectionInput): Promise<ProviderConnection> {
    const provider = input.provider.trim().toLowerCase();
    if (!provider) throw new Error("provider is required");
    const current = await this.get(orgId, provider);
    const now = new Date().toISOString();
    const record: ProviderConnection = {
      orgId,
      provider,
      accountLabel: input.accountLabel?.trim() || current?.accountLabel,
      status: input.status,
      capabilities: unique(input.capabilities ?? current?.capabilities) as ProviderCapability[],
      scopes: unique(input.scopes ?? current?.scopes),
      connectedAt: input.status === "connected" ? (input.connectedAt ?? current?.connectedAt ?? now) : current?.connectedAt,
      lastSyncAt: input.lastSyncAt ?? current?.lastSyncAt,
      error: input.status === "error" ? input.error?.trim() || "provider connection error" : undefined,
      updatedAt: now
    };
    this.records.set(key(orgId, provider), record);
    return record;
  }
}

/**
 * Deliberately contains no access/refresh tokens. Secrets belong in a dedicated
 * encrypted credential service. This registry stores only user-visible state,
 * granted capability metadata, and sync health.
 */
export interface DelegatedAuthorizationAdapter {
  readonly provider: string;
  beginAuthorization(input: { orgId: string; redirectUri: string; requestedCapabilities: ProviderCapability[] }): Promise<{ authorizationUrl: string; state: string }>;
  completeAuthorization(input: { orgId: string; code: string; state: string; redirectUri: string }): Promise<{ accountLabel?: string; capabilities: ProviderCapability[]; scopes: string[] }>;
  revoke(orgId: string): Promise<void>;
}
