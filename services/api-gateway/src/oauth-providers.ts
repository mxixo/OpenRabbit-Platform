import type { ProviderCredentialSecret, ProviderCredentialStore } from "./credential-store.js";
import type { DelegatedAuthorizationAdapter, ProviderCapability } from "./provider-connections.js";

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
}

export interface OAuthHttpClient {
  postForm(url: string, fields: Record<string, string>): Promise<OAuthTokenResponse>;
}

export interface OAuthProviderConfig {
  provider: "google" | "microsoft";
  clientId: string;
  clientSecret: string;
  tenant?: string;
  credentialStore: ProviderCredentialStore;
  httpClient: OAuthHttpClient;
}

export interface OAuthAuthorizationStateStore {
  create(input: { orgId: string; provider: string; redirectUri: string; capabilities: ProviderCapability[] }): Promise<{ state: string; codeVerifier: string; codeChallenge: string }>;
  consume(state: string): Promise<{ orgId: string; provider: string; redirectUri: string; capabilities: ProviderCapability[]; codeVerifier: string } | undefined>;
}

const GOOGLE_SCOPES: Record<ProviderCapability, string> = {
  "email.read": "https://www.googleapis.com/auth/gmail.readonly",
  "email.draft": "https://www.googleapis.com/auth/gmail.compose",
  "email.send": "https://www.googleapis.com/auth/gmail.send",
  "calendar.read": "https://www.googleapis.com/auth/calendar.readonly",
  "calendar.write": "https://www.googleapis.com/auth/calendar.events"
};

const MICROSOFT_SCOPES: Record<ProviderCapability, string> = {
  "email.read": "Mail.Read",
  "email.draft": "Mail.ReadWrite",
  "email.send": "Mail.Send",
  "calendar.read": "Calendars.Read",
  "calendar.write": "Calendars.ReadWrite"
};

function scopesFor(provider: "google" | "microsoft", capabilities: ProviderCapability[]): string[] {
  const map = provider === "google" ? GOOGLE_SCOPES : MICROSOFT_SCOPES;
  const scopes = capabilities.map((capability) => map[capability]);
  if (provider === "microsoft") scopes.unshift("offline_access", "openid", "profile", "email");
  else scopes.unshift("openid", "profile", "email");
  return [...new Set(scopes)];
}

function expiresAt(expiresIn?: number): string | undefined {
  if (!expiresIn || expiresIn <= 0) return undefined;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function buildAdapter(config: OAuthProviderConfig, states: OAuthAuthorizationStateStore): DelegatedAuthorizationAdapter {
  const provider = config.provider;
  const tenant = config.tenant?.trim() || "common";
  const authorizeEndpoint = provider === "google"
    ? "https://accounts.google.com/o/oauth2/v2/auth"
    : `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`;
  const tokenEndpoint = provider === "google"
    ? "https://oauth2.googleapis.com/token"
    : `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;

  return {
    provider,
    async beginAuthorization(input) {
      if (!config.clientId.trim()) throw new Error(`${provider} clientId is not configured`);
      const pending = await states.create({ orgId: input.orgId, provider, redirectUri: input.redirectUri, capabilities: input.requestedCapabilities });
      const scopes = scopesFor(provider, input.requestedCapabilities);
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: input.redirectUri,
        response_type: "code",
        scope: scopes.join(" "),
        state: pending.state,
        code_challenge: pending.codeChallenge,
        code_challenge_method: "S256"
      });
      if (provider === "google") {
        params.set("access_type", "offline");
        params.set("prompt", "consent");
      }
      return { authorizationUrl: `${authorizeEndpoint}?${params.toString()}`, state: pending.state };
    },
    async completeAuthorization(input) {
      const pending = await states.consume(input.state);
      if (!pending || pending.orgId !== input.orgId || pending.provider !== provider) throw new Error("invalid or expired authorization state");
      if (pending.redirectUri !== input.redirectUri) throw new Error("authorization redirectUri does not match");
      const token = await config.httpClient.postForm(tokenEndpoint, {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: input.code,
        grant_type: "authorization_code",
        redirect_uri: input.redirectUri,
        code_verifier: pending.codeVerifier
      });
      if (!token.access_token?.trim()) throw new Error("provider token response did not include access_token");
      const scopes = token.scope?.split(/\s+/).filter(Boolean) ?? scopesFor(provider, pending.capabilities);
      const secret: ProviderCredentialSecret = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        tokenType: token.token_type,
        expiresAt: expiresAt(token.expires_in),
        scopes
      };
      await config.credentialStore.put({ orgId: input.orgId, provider, secret });
      return { capabilities: pending.capabilities, scopes };
    },
    async revoke(orgId) {
      await config.credentialStore.remove(orgId, provider);
    }
  };
}

export function createGoogleAuthorizationAdapter(config: Omit<OAuthProviderConfig, "provider">, states: OAuthAuthorizationStateStore): DelegatedAuthorizationAdapter {
  return buildAdapter({ ...config, provider: "google" }, states);
}

export function createMicrosoftAuthorizationAdapter(config: Omit<OAuthProviderConfig, "provider">, states: OAuthAuthorizationStateStore): DelegatedAuthorizationAdapter {
  return buildAdapter({ ...config, provider: "microsoft" }, states);
}
