export interface ProviderCredentialSecret {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: string;
  scopes?: string[];
}

export interface CredentialReference {
  orgId: string;
  provider: string;
  accountId?: string;
  version: number;
  updatedAt: string;
}

/**
 * Secret-bearing provider credentials live behind this boundary. Callers receive
 * metadata/reference objects, never raw tokens through workspace/provider APIs.
 * Production implementations should use KMS/HSM-backed envelope encryption or
 * an equivalent managed secret store.
 */
export interface ProviderCredentialStore {
  put(input: {
    orgId: string;
    provider: string;
    accountId?: string;
    secret: ProviderCredentialSecret;
  }): Promise<CredentialReference>;
  get(orgId: string, provider: string): Promise<ProviderCredentialSecret | undefined>;
  remove(orgId: string, provider: string): Promise<void>;
  reference(orgId: string, provider: string): Promise<CredentialReference | undefined>;
}

function key(orgId: string, provider: string): string {
  return `${orgId}:${provider.toLowerCase()}`;
}

/**
 * Development-only implementation. It deliberately keeps secrets out of all
 * public connection records, but it is NOT durable or encrypted at rest.
 */
export class InMemoryProviderCredentialStore implements ProviderCredentialStore {
  private readonly secrets = new Map<string, ProviderCredentialSecret>();
  private readonly refs = new Map<string, CredentialReference>();

  async put(input: {
    orgId: string;
    provider: string;
    accountId?: string;
    secret: ProviderCredentialSecret;
  }): Promise<CredentialReference> {
    const provider = input.provider.trim().toLowerCase();
    if (!provider) throw new Error("provider is required");
    if (!input.secret.accessToken?.trim()) throw new Error("accessToken is required");
    const current = this.refs.get(key(input.orgId, provider));
    const reference: CredentialReference = {
      orgId: input.orgId,
      provider,
      accountId: input.accountId?.trim() || current?.accountId,
      version: (current?.version ?? 0) + 1,
      updatedAt: new Date().toISOString()
    };
    this.secrets.set(key(input.orgId, provider), {
      ...input.secret,
      accessToken: input.secret.accessToken.trim(),
      refreshToken: input.secret.refreshToken?.trim() || undefined,
      scopes: input.secret.scopes ? [...new Set(input.secret.scopes.map((scope) => scope.trim()).filter(Boolean))] : undefined
    });
    this.refs.set(key(input.orgId, provider), reference);
    return reference;
  }

  async get(orgId: string, provider: string): Promise<ProviderCredentialSecret | undefined> {
    const secret = this.secrets.get(key(orgId, provider));
    return secret ? { ...secret, scopes: secret.scopes ? [...secret.scopes] : undefined } : undefined;
  }

  async remove(orgId: string, provider: string): Promise<void> {
    this.secrets.delete(key(orgId, provider));
    this.refs.delete(key(orgId, provider));
  }

  async reference(orgId: string, provider: string): Promise<CredentialReference | undefined> {
    const ref = this.refs.get(key(orgId, provider));
    return ref ? { ...ref } : undefined;
  }
}
