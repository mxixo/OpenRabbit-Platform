import { createHash, randomBytes } from "node:crypto";
import type { ProviderCapability } from "./provider-connections.js";
import type { OAuthAuthorizationStateStore } from "./oauth-providers.js";

interface PendingAuthorization {
  orgId: string;
  provider: string;
  redirectUri: string;
  capabilities: ProviderCapability[];
  codeVerifier: string;
  expiresAt: number;
}

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function challenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export class InMemoryOAuthAuthorizationStateStore implements OAuthAuthorizationStateStore {
  private readonly pending = new Map<string, PendingAuthorization>();

  constructor(private readonly ttlMs = 10 * 60 * 1000) {}

  async create(input: { orgId: string; provider: string; redirectUri: string; capabilities: ProviderCapability[] }): Promise<{ state: string; codeVerifier: string; codeChallenge: string }> {
    const state = base64Url(randomBytes(32));
    const codeVerifier = base64Url(randomBytes(48));
    this.pending.set(state, {
      orgId: input.orgId,
      provider: input.provider.toLowerCase(),
      redirectUri: input.redirectUri,
      capabilities: [...new Set(input.capabilities)],
      codeVerifier,
      expiresAt: Date.now() + this.ttlMs
    });
    return { state, codeVerifier, codeChallenge: challenge(codeVerifier) };
  }

  async consume(state: string): Promise<{ orgId: string; provider: string; redirectUri: string; capabilities: ProviderCapability[]; codeVerifier: string } | undefined> {
    const pending = this.pending.get(state);
    this.pending.delete(state);
    if (!pending || pending.expiresAt < Date.now()) return undefined;
    return {
      orgId: pending.orgId,
      provider: pending.provider,
      redirectUri: pending.redirectUri,
      capabilities: [...pending.capabilities],
      codeVerifier: pending.codeVerifier
    };
  }
}
