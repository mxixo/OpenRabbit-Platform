import { describe, expect, it } from "vitest";
import { InMemoryProviderCredentialStore } from "../../src/credential-store.js";
import { createGoogleAuthorizationAdapter, createMicrosoftAuthorizationAdapter, type OAuthHttpClient } from "../../src/oauth-providers.js";
import { InMemoryOAuthAuthorizationStateStore } from "../../src/oauth-state.js";
import { InMemoryProviderConnectionStore } from "../../src/provider-connections.js";
import { InMemoryEmailDraftStore } from "../../src/email-drafts.js";
import { ProviderAuthorizationService } from "../../src/provider-authorization-service.js";
import { routeProviderApi } from "../../src/provider-api.js";

const tokenClient: OAuthHttpClient = {
  async postForm() {
    return {
      access_token: "access-secret",
      refresh_token: "refresh-secret",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "openid profile email https://www.googleapis.com/auth/gmail.readonly"
    };
  }
};

describe("delegated OAuth bootstrap", () => {
  it("creates Google authorization URLs with PKCE and stores tokens outside connection metadata", async () => {
    const credentials = new InMemoryProviderCredentialStore();
    const states = new InMemoryOAuthAuthorizationStateStore();
    const connections = new InMemoryProviderConnectionStore();
    const auth = new ProviderAuthorizationService(connections);
    auth.register(createGoogleAuthorizationAdapter({
      clientId: "google-client",
      clientSecret: "google-secret",
      credentialStore: credentials,
      httpClient: tokenClient
    }, states));

    const begin = await auth.begin({
      orgId: "org-1",
      provider: "google",
      redirectUri: "https://app.example.com/oauth/google",
      capabilities: ["email.read", "calendar.read"]
    });
    expect(begin.authorizationUrl).toContain("accounts.google.com");
    expect(begin.authorizationUrl).toContain("code_challenge=");
    expect((await connections.get("org-1", "google"))?.status).toBe("authorizing");

    await auth.complete({
      orgId: "org-1",
      provider: "google",
      code: "provider-code",
      state: begin.state,
      redirectUri: "https://app.example.com/oauth/google"
    });

    const connection = await connections.get("org-1", "google");
    expect(connection?.status).toBe("connected");
    expect(connection).not.toHaveProperty("accessToken");
    expect(connection).not.toHaveProperty("refreshToken");
    expect((await credentials.get("org-1", "google"))?.accessToken).toBe("access-secret");
  });

  it("rejects OAuth callback state reuse", async () => {
    const credentials = new InMemoryProviderCredentialStore();
    const states = new InMemoryOAuthAuthorizationStateStore();
    const auth = new ProviderAuthorizationService(new InMemoryProviderConnectionStore());
    auth.register(createMicrosoftAuthorizationAdapter({
      clientId: "ms-client",
      clientSecret: "ms-secret",
      credentialStore: credentials,
      httpClient: tokenClient
    }, states));
    const begin = await auth.begin({ orgId: "org-1", provider: "microsoft", redirectUri: "https://app.example.com/oauth/microsoft", capabilities: ["email.read"] });
    await auth.complete({ orgId: "org-1", provider: "microsoft", code: "one", state: begin.state, redirectUri: "https://app.example.com/oauth/microsoft" });
    await expect(auth.complete({ orgId: "org-1", provider: "microsoft", code: "two", state: begin.state, redirectUri: "https://app.example.com/oauth/microsoft" })).rejects.toThrow(/invalid or expired authorization state/);
  });

  it("returns a clear not-configured response when a provider adapter is absent", async () => {
    const result = await routeProviderApi({
      requestId: "oauth-1",
      method: "POST",
      path: "/v1/orgs/org-1/connections/google/authorize",
      body: { redirectUri: "https://app.example.com/oauth/google", capabilities: ["email.read"] }
    }, new InMemoryProviderConnectionStore(), new InMemoryEmailDraftStore(), new ProviderAuthorizationService(new InMemoryProviderConnectionStore()));
    expect(result).toMatchObject({ matched: true, status: 501, error: { code: "PROVIDER_AUTH_NOT_CONFIGURED" } });
  });
});
