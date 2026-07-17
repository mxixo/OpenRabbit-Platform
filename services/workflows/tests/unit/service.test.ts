import { describe, expect, it } from "vitest";
import { createWorkflowsService } from "../../src/service.js";

describe("workflows service scaffold", () => {
  it("manages lifecycle and descriptor", async () => {
    const service = createWorkflowsService();
    expect(service.getDescriptor().serviceName).toBe("workflows");
    expect(service.getHealth().status).toBe("degraded");
    await service.start();
    expect(service.getHealth().status).toBe("ok");
  });

  it("registers and lists workflow templates", async () => {
    const service = createWorkflowsService();
    await service.start();
    await expect(
      service.registerWorkflow(
        {
          id: "wf.lead-intake",
          version: "1.0.0",
          name: "Lead Intake",
          description: "Initial lead intake workflow",
          stepIds: ["capture", "qualify", "handoff"]
        },
        async () => ({ accepted: true })
      )
    ).resolves.toEqual({ registered: true });

    await expect(service.listWorkflows()).resolves.toMatchObject([
      {
        id: "wf.lead-intake",
        version: "1.0.0",
        name: "Lead Intake"
      }
    ]);
  });

  it("runs workflows and returns deterministic not-found errors", async () => {
    const service = createWorkflowsService();
    await service.start();
    await service.registerWorkflow(
      {
        id: "wf.echo",
        version: "1.0.0",
        name: "Echo Workflow",
        stepIds: ["echo"]
      },
      async (request) => ({ workflowId: request.workflowId, variables: request.variables ?? {} })
    );

    await expect(
      service.runWorkflow({
        workflowId: "wf.echo",
        variables: { customerId: "c-1" }
      })
    ).resolves.toEqual({
      ok: true,
      output: { workflowId: "wf.echo", variables: { customerId: "c-1" } }
    });
    await expect(service.runWorkflow({ workflowId: "wf.missing" })).resolves.toEqual({
      ok: false,
      error: {
        code: "WORKFLOW_NOT_FOUND",
        message: "workflow not found: wf.missing"
      }
    });
  });
});
