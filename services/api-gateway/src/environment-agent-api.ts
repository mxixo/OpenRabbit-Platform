import type { ApiRequestEnvelope } from "./contracts.js";
import type { PlatformApiRouteResult } from "./platform-api.js";
import type { ContextEntityRef } from "./context-graph.js";
import { EnvironmentAgentService, type EnvironmentIntent } from "./environment-agent.js";

function parts(path: string): string[] { return path.split("?")[0].split("/").filter(Boolean); }
function invalid(message: string, code = "INVALID_ENVIRONMENT_AGENT_REQUEST"): PlatformApiRouteResult {
  return { matched: true, status: 400, error: { code, message } };
}

const INTENTS = new Set<EnvironmentIntent>(["draft_follow_up_email", "schedule_follow_up", "queue_social_post"]);

export async function routeEnvironmentAgentApi(request: ApiRequestEnvelope, agent: EnvironmentAgentService): Promise<PlatformApiRouteResult> {
  const method = request.method.toUpperCase();
  const path = parts(request.path);
  if (path[0] !== "v1" || path[1] !== "orgs" || !path[2] || path[3] !== "agent") return { matched: false };
  const orgId = path[2];

  if (method === "POST" && path[4] === "plan" && path.length === 5) {
    const body = (request.body ?? {}) as Partial<{
      intent: EnvironmentIntent;
      subject: ContextEntityRef;
      actorType: "user" | "worker" | "system";
      actorId: string;
      parameters: Record<string, unknown>;
    }>;
    if (!body.intent || !INTENTS.has(body.intent)) return invalid("supported intent is required", "INVALID_ENVIRONMENT_INTENT");
    if (!body.subject?.type || !body.subject?.id) return invalid("subject type and id are required", "ENVIRONMENT_SUBJECT_REQUIRED");
    if (!body.actorType || !["user", "worker", "system"].includes(body.actorType)) return invalid("valid actorType is required", "ENVIRONMENT_ACTOR_REQUIRED");
    try {
      return { matched: true, status: 201, data: await agent.plan({ orgId, intent: body.intent, subject: body.subject, actorType: body.actorType, actorId: body.actorId, parameters: body.parameters }) };
    } catch (error) {
      return invalid(error instanceof Error ? error.message : "environment action could not be planned");
    }
  }

  if (method === "POST" && path[4] === "actions" && path[5] && path[6] === "approve" && path.length === 7) {
    const body = (request.body ?? {}) as Partial<{ approvedBy: string }>;
    if (!body.approvedBy?.trim()) return invalid("approvedBy is required", "ENVIRONMENT_APPROVER_REQUIRED");
    try { return { matched: true, status: 200, data: await agent.approve(orgId, path[5], body.approvedBy.trim()) }; }
    catch (error) { return { matched: true, status: 409, error: { code: "ENVIRONMENT_APPROVAL_FAILED", message: error instanceof Error ? error.message : "approval failed" } }; }
  }

  if (method === "POST" && path[4] === "actions" && path[5] && path[6] === "execute" && path.length === 7) {
    try { return { matched: true, status: 200, data: await agent.execute(orgId, path[5]) }; }
    catch (error) { return { matched: true, status: 409, error: { code: "ENVIRONMENT_EXECUTION_FAILED", message: error instanceof Error ? error.message : "execution failed" } }; }
  }

  return { matched: false };
}
