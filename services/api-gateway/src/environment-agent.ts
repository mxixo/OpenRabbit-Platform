import type { PlatformApiBackend } from "./platform-api.js";
import type { ContextEntityRef, EnvironmentActionRecord, InMemoryContextGraphStore } from "./context-graph.js";
import type { InMemoryEmailDraftStore } from "./email-drafts.js";
import type { InMemorySocialStore } from "./social-adapter.js";

export type EnvironmentIntent = "draft_follow_up_email" | "schedule_follow_up" | "queue_social_post";

export interface EnvironmentActionStep {
  id: string;
  kind: "create_email_draft" | "create_calendar_item" | "create_social_post";
  summary: string;
  requiresApproval: boolean;
  input: Record<string, unknown>;
}

export interface EnvironmentActionPlan {
  intent: EnvironmentIntent;
  subject: ContextEntityRef;
  context: ContextEntityRef[];
  steps: EnvironmentActionStep[];
}

export interface PlanEnvironmentActionInput {
  orgId: string;
  intent: EnvironmentIntent;
  subject: ContextEntityRef;
  actorType: "user" | "worker" | "system";
  actorId?: string;
  parameters?: Record<string, unknown>;
}

function stepId(index: number): string { return `step_${index + 1}`; }
function stringParam(params: Record<string, unknown>, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export class EnvironmentAgentService {
  constructor(
    private readonly graph: InMemoryContextGraphStore,
    private readonly drafts: InMemoryEmailDraftStore,
    private readonly social: InMemorySocialStore,
    private readonly platform: () => PlatformApiBackend | undefined
  ) {}

  async plan(input: PlanEnvironmentActionInput): Promise<EnvironmentActionRecord> {
    const neighborhood = await this.graph.neighborhood(input.orgId, input.subject);
    const params = input.parameters ?? {};
    const steps: EnvironmentActionStep[] = [];

    if (input.intent === "draft_follow_up_email") {
      const to = stringParam(params, "to");
      const subject = stringParam(params, "subject") ?? "Follow-up";
      const body = stringParam(params, "body") ?? "Following up on our recent conversation.";
      if (!to) throw new Error("draft_follow_up_email requires a recipient in parameters.to");
      steps.push({
        id: stepId(0), kind: "create_email_draft", summary: `Draft follow-up email to ${to}`,
        requiresApproval: false,
        input: { to, subject, body, provider: stringParam(params, "provider") }
      });
    }

    if (input.intent === "schedule_follow_up") {
      const title = stringParam(params, "title") ?? "Follow-up";
      const startAt = stringParam(params, "startAt");
      if (!startAt) throw new Error("schedule_follow_up requires parameters.startAt");
      steps.push({
        id: stepId(0), kind: "create_calendar_item", summary: `Schedule ${title}`,
        requiresApproval: input.actorType !== "user",
        input: { title, startAt, endAt: stringParam(params, "endAt"), notes: stringParam(params, "notes") }
      });
    }

    if (input.intent === "queue_social_post") {
      const network = stringParam(params, "network");
      const body = stringParam(params, "body");
      if (!network || !body) throw new Error("queue_social_post requires parameters.network and parameters.body");
      const policy = await this.social.getPolicy(input.orgId);
      const requiresApproval = input.actorType !== "user" && policy.autonomyMode !== "trusted_autopilot";
      steps.push({
        id: stepId(0), kind: "create_social_post", summary: `Queue ${network} social post`,
        requiresApproval,
        input: { network, body, title: stringParam(params, "title"), scheduledAt: stringParam(params, "scheduledAt") }
      });
    }

    if (!steps.length) throw new Error(`Unsupported environment intent: ${input.intent}`);
    const plan: EnvironmentActionPlan = {
      intent: input.intent,
      subject: input.subject,
      context: neighborhood.neighbors,
      steps
    };
    const requiresApproval = steps.some((step) => step.requiresApproval);
    return this.graph.recordAction(input.orgId, {
      actionType: `environment.${input.intent}`,
      status: requiresApproval ? "pending_approval" : "proposed",
      actorType: input.actorType,
      actorId: input.actorId,
      summary: steps.map((step) => step.summary).join("; "),
      entities: [input.subject, ...neighborhood.neighbors],
      metadata: { plan }
    });
  }

  async approve(orgId: string, actionId: string, approvedBy: string): Promise<EnvironmentActionRecord> {
    const action = (await this.graph.listActions(orgId)).find((item) => item.id === actionId);
    if (!action) throw new Error(`Environment action not found: ${actionId}`);
    if (action.status !== "pending_approval") throw new Error(`Environment action is not pending approval: ${actionId}`);
    return this.graph.updateAction(orgId, actionId, {
      status: "approved",
      metadata: { ...(action.metadata ?? {}), approvedBy, approvedAt: new Date().toISOString() }
    });
  }

  async execute(orgId: string, actionId: string): Promise<EnvironmentActionRecord> {
    const action = (await this.graph.listActions(orgId)).find((item) => item.id === actionId);
    if (!action) throw new Error(`Environment action not found: ${actionId}`);
    if (action.status === "pending_approval") throw new Error("Environment action requires approval before execution");
    if (!["proposed", "approved"].includes(action.status)) throw new Error(`Environment action cannot execute from status ${action.status}`);
    const plan = action.metadata?.plan as EnvironmentActionPlan | undefined;
    if (!plan?.steps?.length) throw new Error("Environment action has no executable plan");

    await this.graph.updateAction(orgId, actionId, { status: "executing" });
    const results: Array<Record<string, unknown>> = [];
    try {
      for (const step of plan.steps) {
        if (step.requiresApproval && action.status !== "approved") throw new Error(`Step requires approval: ${step.id}`);
        if (step.kind === "create_email_draft") {
          const draft = await this.drafts.create(orgId, {
            to: [String(step.input.to)], subject: String(step.input.subject), body: String(step.input.body),
            provider: typeof step.input.provider === "string" ? step.input.provider : undefined,
            createdBy: action.actorType === "user" ? "user" : "worker", status: "draft"
          });
          results.push({ stepId: step.id, kind: step.kind, resourceId: draft.id });
        }
        if (step.kind === "create_calendar_item") {
          const backend = this.platform();
          if (!backend?.createPlanItem) throw new Error("calendar planning backend is not available");
          const startAt = String(step.input.startAt);
          const item = await backend.createPlanItem({
            orgId, date: startAt.slice(0, 10), title: String(step.input.title), startAt,
            endAt: typeof step.input.endAt === "string" ? step.input.endAt : undefined,
            notes: typeof step.input.notes === "string" ? step.input.notes : undefined,
            metadata: { environmentActionId: actionId }
          });
          results.push({ stepId: step.id, kind: step.kind, resourceId: item.id });
        }
        if (step.kind === "create_social_post") {
          const post = await this.social.create(orgId, {
            network: String(step.input.network), body: String(step.input.body),
            title: typeof step.input.title === "string" ? step.input.title : undefined,
            scheduledAt: typeof step.input.scheduledAt === "string" ? step.input.scheduledAt : undefined,
            createdBy: action.actorType === "user" ? "user" : "worker",
            status: step.input.scheduledAt ? "scheduled" : "draft"
          });
          results.push({ stepId: step.id, kind: step.kind, resourceId: post.id });
        }
      }
      return this.graph.updateAction(orgId, actionId, {
        status: "executed", completedAt: new Date().toISOString(),
        metadata: { ...(action.metadata ?? {}), executionResults: results }
      });
    } catch (error) {
      await this.graph.updateAction(orgId, actionId, {
        status: "failed", completedAt: new Date().toISOString(),
        metadata: { ...(action.metadata ?? {}), executionResults: results, error: error instanceof Error ? error.message : "execution failed" }
      });
      throw error;
    }
  }
}
