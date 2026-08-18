import type { ApiRequestEnvelope } from "./contracts.js";
import type { PlatformApiBackend, PlatformApiRouteResult } from "./platform-api.js";
import type { EmailActionType, EmailProviderMessage, InMemoryEmailStore } from "./email-adapter.js";

const ACTION_TYPES = new Set<EmailActionType>(["reply", "document", "scheduling", "review", "other"]);

function pathParts(path: string): string[] {
  return path.split("?")[0].split("/").filter(Boolean);
}

function invalid(message: string, code = "INVALID_EMAIL_REQUEST"): PlatformApiRouteResult {
  return { matched: true, status: 400, error: { code, message } };
}

function parseMessages(value: unknown): EmailProviderMessage[] | PlatformApiRouteResult {
  if (!Array.isArray(value)) return invalid("messages must be an array", "INVALID_EMAIL_MESSAGES");
  for (const message of value) {
    const item = message as Partial<EmailProviderMessage>;
    if (!item.externalId?.trim() || !item.subject?.trim()) {
      return invalid("each message requires externalId and subject", "INVALID_EMAIL_MESSAGE");
    }
    if (item.actionType && !ACTION_TYPES.has(item.actionType)) {
      return invalid("invalid email actionType", "INVALID_EMAIL_ACTION_TYPE");
    }
  }
  return value as EmailProviderMessage[];
}

function isRouteResult(value: unknown): value is PlatformApiRouteResult {
  return Boolean(value && typeof value === "object" && "matched" in value);
}

export async function routeEmailApi(
  request: ApiRequestEnvelope,
  store: InMemoryEmailStore,
  backend: PlatformApiBackend
): Promise<PlatformApiRouteResult> {
  const method = request.method.toUpperCase();
  const parts = pathParts(request.path);
  if (parts[0] !== "v1" || parts[1] !== "orgs" || !parts[2] || parts[3] !== "email") return { matched: false };
  const orgId = parts[2];

  if (method === "POST" && parts.length === 5 && parts[4] === "import") {
    const body = (request.body ?? {}) as Partial<{ provider: string; messages: unknown }>;
    if (!body.provider?.trim()) return invalid("provider is required", "EMAIL_PROVIDER_REQUIRED");
    const messages = parseMessages(body.messages);
    if (isRouteResult(messages)) return messages;
    return { matched: true, status: 200, data: await store.import({ orgId, provider: body.provider.trim(), messages }) };
  }

  if (method === "GET" && parts.length === 5 && parts[4] === "messages") {
    const query = new URLSearchParams(request.path.split("?")[1] ?? "");
    return { matched: true, status: 200, data: await store.list(orgId, query.get("date") ?? undefined) };
  }

  if (method === "PATCH" && parts.length === 6 && parts[4] === "messages") {
    const body = (request.body ?? {}) as Partial<{ unread: boolean; needsAction: boolean; actionType: EmailActionType; relationshipId: string; propertyId: string; summary: string }>;
    if (body.actionType && !ACTION_TYPES.has(body.actionType)) return invalid("invalid email actionType", "INVALID_EMAIL_ACTION_TYPE");
    try {
      return { matched: true, status: 200, data: await store.update(orgId, parts[5], body) };
    } catch (error) {
      return { matched: true, status: 404, error: { code: "EMAIL_MESSAGE_NOT_FOUND", message: error instanceof Error ? error.message : "Email message not found" } };
    }
  }

  if (method === "POST" && parts.length === 7 && parts[4] === "messages" && parts[6] === "schedule") {
    const message = await store.get(orgId, parts[5]);
    if (!message) return { matched: true, status: 404, error: { code: "EMAIL_MESSAGE_NOT_FOUND", message: `Email message not found: ${parts[5]}` } };
    if (!backend.createPlanItem) return { matched: true, status: 501, error: { code: "PLANNING_BACKEND_NOT_AVAILABLE", message: "calendar planning backend is not available" } };

    const body = (request.body ?? {}) as Partial<{ title: string; startAt: string; endAt: string; notes: string }>;
    if (!body.startAt?.trim()) return invalid("startAt is required", "EMAIL_SCHEDULE_START_REQUIRED");
    const date = body.startAt.slice(0, 10);
    const item = await backend.createPlanItem({
      orgId,
      date,
      title: body.title?.trim() || message.subject,
      startAt: body.startAt,
      endAt: body.endAt,
      notes: body.notes ?? `Scheduled from email ${message.id}`,
      metadata: {
        emailMessageId: message.id,
        emailProvider: message.provider,
        emailExternalId: message.externalId,
        relationshipId: message.relationshipId,
        propertyId: message.propertyId
      }
    });
    await store.update(orgId, message.id, { needsAction: false, actionType: "scheduling" });
    return { matched: true, status: 201, data: { item, messageId: message.id } };
  }

  return { matched: false };
}
