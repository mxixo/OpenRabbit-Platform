import type { ApiRequestEnvelope } from "./contracts.js";
import type { PlatformApiRouteResult } from "./platform-api.js";
import type { InMemoryProviderConnectionStore, ProviderCapability, ProviderConnectionStatus } from "./provider-connections.js";
import type { InMemoryEmailDraftStore, EmailDraftStatus } from "./email-drafts.js";
import type { ProviderAuthorizationService } from "./provider-authorization-service.js";

const STATUSES = new Set<ProviderConnectionStatus>(["disconnected", "authorizing", "connected", "error"]);
const CAPABILITIES = new Set<ProviderCapability>(["email.read", "email.draft", "email.send", "calendar.read", "calendar.write"]);
const DRAFT_STATUSES = new Set<EmailDraftStatus>(["draft", "pending_approval", "approved", "sent", "discarded"]);

function parts(path: string): string[] {
  return path.split("?")[0].split("/").filter(Boolean);
}

function invalid(message: string, code = "INVALID_PROVIDER_REQUEST"): PlatformApiRouteResult {
  return { matched: true, status: 400, error: { code, message } };
}

function authUnavailable(provider: string): PlatformApiRouteResult {
  return { matched: true, status: 501, error: { code: "PROVIDER_AUTH_NOT_CONFIGURED", message: `provider authorization adapter not configured: ${provider}` } };
}

export async function routeProviderApi(
  request: ApiRequestEnvelope,
  connections: InMemoryProviderConnectionStore,
  drafts: InMemoryEmailDraftStore,
  authorization?: ProviderAuthorizationService
): Promise<PlatformApiRouteResult> {
  const method = request.method.toUpperCase();
  const path = parts(request.path);
  if (path[0] !== "v1" || path[1] !== "orgs" || !path[2]) return { matched: false };
  const orgId = path[2];

  if (path[3] === "connections") {
    if (method === "GET" && path.length === 4) {
      return { matched: true, status: 200, data: await connections.list(orgId) };
    }

    if (path.length >= 5) {
      const provider = path[4].toLowerCase();

      if (method === "POST" && path.length === 6 && path[5] === "authorize") {
        const body = (request.body ?? {}) as Partial<{ redirectUri: string; capabilities: ProviderCapability[] }>;
        if (!body.redirectUri?.trim()) return invalid("redirectUri is required", "PROVIDER_REDIRECT_URI_REQUIRED");
        if (!Array.isArray(body.capabilities) || !body.capabilities.length || body.capabilities.some((capability) => !CAPABILITIES.has(capability))) {
          return invalid("one or more provider capabilities are invalid", "INVALID_PROVIDER_CAPABILITY");
        }
        if (!authorization?.has(provider)) return authUnavailable(provider);
        try {
          return { matched: true, status: 200, data: await authorization.begin({ orgId, provider, redirectUri: body.redirectUri, capabilities: body.capabilities }) };
        } catch (error) {
          return invalid(error instanceof Error ? error.message : "provider authorization could not begin", "PROVIDER_AUTH_BEGIN_FAILED");
        }
      }

      if (method === "POST" && path.length === 6 && path[5] === "callback") {
        const body = (request.body ?? {}) as Partial<{ code: string; state: string; redirectUri: string }>;
        if (!body.code?.trim() || !body.state?.trim() || !body.redirectUri?.trim()) {
          return invalid("code, state, and redirectUri are required", "INVALID_PROVIDER_CALLBACK");
        }
        if (!authorization?.has(provider)) return authUnavailable(provider);
        try {
          await authorization.complete({ orgId, provider, code: body.code, state: body.state, redirectUri: body.redirectUri });
          return { matched: true, status: 200, data: await connections.get(orgId, provider) };
        } catch (error) {
          return { matched: true, status: 400, error: { code: "PROVIDER_AUTH_CALLBACK_FAILED", message: error instanceof Error ? error.message : "provider authorization callback failed" } };
        }
      }

      if (method === "DELETE" && path.length === 5) {
        if (authorization?.has(provider)) await authorization.revoke(orgId, provider);
        else await connections.upsert(orgId, { provider, status: "disconnected", capabilities: [], scopes: [] });
        return { matched: true, status: 200, data: await connections.get(orgId, provider) };
      }

      if (method === "PUT" && path.length === 5) {
        const body = (request.body ?? {}) as Partial<{
          status: ProviderConnectionStatus;
          accountLabel: string;
          capabilities: ProviderCapability[];
          scopes: string[];
          connectedAt: string;
          lastSyncAt: string;
          error: string;
        }>;
        if (!body.status || !STATUSES.has(body.status)) return invalid("valid connection status is required", "INVALID_CONNECTION_STATUS");
        if (body.capabilities && (!Array.isArray(body.capabilities) || body.capabilities.some((capability) => !CAPABILITIES.has(capability)))) {
          return invalid("one or more provider capabilities are invalid", "INVALID_PROVIDER_CAPABILITY");
        }
        if (body.scopes && !Array.isArray(body.scopes)) return invalid("scopes must be an array", "INVALID_PROVIDER_SCOPES");
        try {
          return {
            matched: true,
            status: 200,
            data: await connections.upsert(orgId, {
              provider,
              status: body.status,
              accountLabel: body.accountLabel,
              capabilities: body.capabilities,
              scopes: body.scopes,
              connectedAt: body.connectedAt,
              lastSyncAt: body.lastSyncAt,
              error: body.error
            })
          };
        } catch (error) {
          return invalid(error instanceof Error ? error.message : "provider connection could not be updated");
        }
      }
    }
  }

  if (path[3] === "email" && path[4] === "drafts") {
    if (method === "GET" && path.length === 5) {
      return { matched: true, status: 200, data: await drafts.list(orgId) };
    }

    if (method === "POST" && path.length === 5) {
      const body = (request.body ?? {}) as Partial<{
        provider: string;
        inReplyToMessageId: string;
        relationshipId: string;
        propertyId: string;
        to: string[];
        cc: string[];
        subject: string;
        body: string;
        createdBy: "user" | "worker";
        status: "draft" | "pending_approval";
      }>;
      if (!Array.isArray(body.to) || !body.to.length) return invalid("at least one recipient is required", "EMAIL_DRAFT_RECIPIENT_REQUIRED");
      if (!body.subject?.trim()) return invalid("subject is required", "EMAIL_DRAFT_SUBJECT_REQUIRED");
      if (!body.body?.trim()) return invalid("body is required", "EMAIL_DRAFT_BODY_REQUIRED");
      try {
        return { matched: true, status: 201, data: await drafts.create(orgId, body as Parameters<InMemoryEmailDraftStore["create"]>[1]) };
      } catch (error) {
        return invalid(error instanceof Error ? error.message : "email draft could not be created");
      }
    }

    if (method === "PATCH" && path.length === 6) {
      const body = (request.body ?? {}) as Partial<{ status: EmailDraftStatus }>;
      if (!body.status || !DRAFT_STATUSES.has(body.status)) return invalid("valid draft status is required", "INVALID_EMAIL_DRAFT_STATUS");
      try {
        return { matched: true, status: 200, data: await drafts.updateStatus(orgId, path[5], body.status) };
      } catch (error) {
        return { matched: true, status: 404, error: { code: "EMAIL_DRAFT_NOT_FOUND", message: error instanceof Error ? error.message : "Email draft not found" } };
      }
    }
  }

  return { matched: false };
}
