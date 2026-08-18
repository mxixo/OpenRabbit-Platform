import { describe, expect, it } from "vitest";
import { InMemoryContextGraphStore } from "../../src/context-graph.js";
import { InMemoryEmailDraftStore } from "../../src/email-drafts.js";
import { InMemorySocialStore } from "../../src/social-adapter.js";
import { EnvironmentAgentService } from "../../src/environment-agent.js";
import type { PlatformApiBackend } from "../../src/platform-api.js";

function agent(graph = new InMemoryContextGraphStore()) {
  const drafts = new InMemoryEmailDraftStore();
  const social = new InMemorySocialStore();
  const createdPlanItems: any[] = [];
  const backend = {
    createPlanItem: async (input: any) => {
      const item = { id: `cal_${createdPlanItems.length + 1}`, status: "planned", ...input };
      createdPlanItems.push(item);
      return item;
    }
  } as unknown as PlatformApiBackend;
  return { service: new EnvironmentAgentService(graph, drafts, social, () => backend), graph, drafts, social, createdPlanItems };
}

describe("environment agent", () => {
  it("uses graph neighbors as context and safely executes a draft-only email action", async () => {
    const { service, graph, drafts } = agent();
    await graph.addLink("org-1", {
      from: { type: "relationship", id: "rel-1", label: "Client" },
      to: { type: "property", id: "prop-1", label: "123 Main" },
      relation: "related_to",
      source: "user"
    });

    const action = await service.plan({
      orgId: "org-1",
      intent: "draft_follow_up_email",
      subject: { type: "relationship", id: "rel-1" },
      actorType: "worker",
      actorId: "worker-follow-up",
      parameters: { to: "client@example.com", subject: "123 Main", body: "Would you like to tour it?" }
    });

    expect(action.status).toBe("proposed");
    expect(action.entities).toEqual(expect.arrayContaining([expect.objectContaining({ type: "property", id: "prop-1" })]));

    const executed = await service.execute("org-1", action.id);
    expect(executed.status).toBe("executed");
    const queue = await drafts.list("org-1");
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ to: ["client@example.com"], createdBy: "worker", status: "draft" });
  });

  it("requires explicit approval before a worker-created calendar action executes", async () => {
    const { service, createdPlanItems } = agent();
    const action = await service.plan({
      orgId: "org-1",
      intent: "schedule_follow_up",
      subject: { type: "relationship", id: "rel-2" },
      actorType: "worker",
      actorId: "worker-calendar",
      parameters: { title: "Buyer follow-up", startAt: "2026-08-18T15:00:00-07:00" }
    });

    expect(action.status).toBe("pending_approval");
    await expect(service.execute("org-1", action.id)).rejects.toThrow("requires approval");
    const approved = await service.approve("org-1", action.id, "user-1");
    expect(approved.status).toBe("approved");
    const executed = await service.execute("org-1", action.id);
    expect(executed.status).toBe("executed");
    expect(createdPlanItems).toHaveLength(1);
    expect(createdPlanItems[0].metadata.environmentActionId).toBe(action.id);
  });

  it("does not require worker social approval after trusted autopilot is explicitly configured", async () => {
    const { service, social } = agent();
    await social.setPolicy("org-1", { autonomyMode: "trusted_autopilot", allowedNetworks: ["instagram"] });
    const action = await service.plan({
      orgId: "org-1",
      intent: "queue_social_post",
      subject: { type: "property", id: "prop-2" },
      actorType: "worker",
      actorId: "worker-social",
      parameters: { network: "instagram", body: "New Phoenix listing", scheduledAt: "2026-08-18T12:00:00-07:00" }
    });
    expect(action.status).toBe("proposed");
    await service.execute("org-1", action.id);
    expect((await social.list("org-1"))[0].status).toBe("scheduled");
  });
});
