import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonFileCalendarPlanStore } from "@openrabbit/runtime-core";
import { describe, expect, it } from "vitest";
import { PlanningRealEstatePlatformBackend } from "../../src/planning-real-estate-platform-backend.js";

describe("PlanningRealEstatePlatformBackend", () => {
  it("creates plan items and persists a daily operating plan", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    const item = await backend.createPlanItem({
      orgId: "org-1",
      date: "2026-08-11",
      title: "Review acquisitions pipeline",
      priority: 1,
      workerId: "real-estate.acquisitions.org-1",
      source: {
        provider: "google-calendar",
        calendarId: "primary",
        eventId: "event-1"
      }
    });

    const plan = await backend.saveDailyPlan({
      orgId: "org-1",
      date: "2026-08-11",
      timezone: "America/Phoenix",
      objective: "Move the highest-value work forward",
      itemIds: [item.id],
      generatedBy: "openrabbit"
    });

    expect(plan.itemIds).toEqual([item.id]);
    expect(await backend.getDailyPlan("org-1", "2026-08-11")).toEqual(plan);
    expect(await backend.listPlanItems("org-1", "2026-08-11")).toEqual([
      expect.objectContaining({
        id: item.id,
        title: "Review acquisitions pipeline",
        status: "planned"
      })
    ]);
  });

  it("tracks execution status and notes on a plan item", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    const item = await backend.createPlanItem({
      orgId: "org-1",
      date: "2026-08-11",
      title: "Underwrite opportunity"
    });

    const inProgress = await backend.updatePlanItem({
      orgId: "org-1",
      itemId: item.id,
      status: "in_progress",
      taskId: "task-1"
    });
    expect(inProgress.status).toBe("in_progress");
    expect(inProgress.taskId).toBe("task-1");

    const completed = await backend.updatePlanItem({
      orgId: "org-1",
      itemId: item.id,
      status: "completed",
      notes: "Analysis delivered"
    });
    expect(completed.status).toBe("completed");
    expect(completed.notes).toBe("Analysis delivered");
  });

  it("executes an assigned read task and automatically completes the plan item", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    const installation = await backend.installRealEstatePack("org-exec-1");
    const acquisitionsWorkerId = installation.workerIds.find((id) =>
      id.includes("acquisitions")
    );
    expect(acquisitionsWorkerId).toBeTruthy();

    const item = await backend.createPlanItem({
      orgId: "org-exec-1",
      date: "2026-08-11",
      title: "Underwrite 100 Market St",
      workerId: acquisitionsWorkerId,
      notes: "Priority acquisition review"
    });

    const execution = await backend.executePlanItem({
      orgId: "org-exec-1",
      itemId: item.id,
      taskType: "commercial_investment_workflow",
      actionKind: "read",
      taskInput: {
        address: "100 Market St, Phoenix, AZ",
        purchasePrice: 1200000,
        annualGrossIncome: 165000
      }
    });

    expect(execution.taskResult.status).toBe("completed");
    expect(execution.item.status).toBe("completed");
    expect(execution.item.taskId).toMatch(/^plan-task-/);
    expect(execution.item.notes).toContain("Priority acquisition review");
    expect(execution.item.notes).toContain("completed");
    expect(execution.item.metadata).toMatchObject({
      executionTaskType: "commercial_investment_workflow",
      executionActionKind: "read",
      executionStatus: "completed"
    });

    await backend.stopOrg("org-exec-1");
  });

  it("blocks an assigned write task and records the approval on the plan item", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    const installation = await backend.installRealEstatePack("org-exec-2");
    const acquisitionsWorkerId = installation.workerIds.find((id) =>
      id.includes("acquisitions")
    );
    expect(acquisitionsWorkerId).toBeTruthy();

    const item = await backend.createPlanItem({
      orgId: "org-exec-2",
      date: "2026-08-11",
      title: "Prepare consequential acquisition action",
      workerId: acquisitionsWorkerId
    });

    const execution = await backend.executePlanItem({
      orgId: "org-exec-2",
      itemId: item.id,
      taskType: "commercial_investment_workflow",
      actionKind: "write",
      taskInput: { address: "100 Market St, Phoenix, AZ" }
    });

    expect(execution.taskResult.status).toBe("blocked");
    expect(execution.taskResult.error?.code).toBe("approval_required");
    expect(execution.item.status).toBe("blocked");
    expect(execution.item.notes).toContain("pending human approval");
    expect(execution.item.metadata?.approvalId).toBeTruthy();

    await backend.stopOrg("org-exec-2");
  });

  it("moves a blocked plan item to completed after approval resumes the linked task", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    const installation = await backend.installRealEstatePack("org-exec-approval");
    const acquisitionsWorkerId = installation.workerIds.find((id) =>
      id.includes("acquisitions")
    );
    expect(acquisitionsWorkerId).toBeTruthy();

    const item = await backend.createPlanItem({
      orgId: "org-exec-approval",
      date: "2026-08-11",
      title: "Approved acquisition action",
      workerId: acquisitionsWorkerId
    });

    const blocked = await backend.executePlanItem({
      orgId: "org-exec-approval",
      itemId: item.id,
      taskType: "commercial_investment_workflow",
      actionKind: "write",
      taskInput: {
        address: "100 Market St, Phoenix, AZ",
        purchasePrice: 1200000,
        annualGrossIncome: 165000
      }
    });
    const approvalId = blocked.item.metadata?.approvalId as string;
    expect(approvalId).toBeTruthy();

    const decision = await backend.decideApproval({
      orgId: "org-exec-approval",
      approvalId,
      decision: "approve",
      decidedBy: "user-1"
    });
    expect(decision.taskResult?.status).toBe("completed");

    const [reconciled] = await backend.listPlanItems(
      "org-exec-approval",
      "2026-08-11"
    );
    expect(reconciled.status).toBe("completed");
    expect(reconciled.metadata).toMatchObject({
      approvalDecision: "approve",
      approvalId,
      approvalDecidedBy: "user-1",
      executionStatus: "completed"
    });
    expect(reconciled.notes).toContain("completed");

    await backend.stopOrg("org-exec-approval");
  });

  it("keeps a denied linked task blocked and records the cancellation", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    const installation = await backend.installRealEstatePack("org-exec-deny");
    const acquisitionsWorkerId = installation.workerIds.find((id) =>
      id.includes("acquisitions")
    );
    expect(acquisitionsWorkerId).toBeTruthy();

    const item = await backend.createPlanItem({
      orgId: "org-exec-deny",
      date: "2026-08-11",
      title: "Denied acquisition action",
      workerId: acquisitionsWorkerId
    });

    const blocked = await backend.executePlanItem({
      orgId: "org-exec-deny",
      itemId: item.id,
      taskType: "commercial_investment_workflow",
      actionKind: "write",
      taskInput: { address: "100 Market St, Phoenix, AZ" }
    });
    const approvalId = blocked.item.metadata?.approvalId as string;

    const decision = await backend.decideApproval({
      orgId: "org-exec-deny",
      approvalId,
      decision: "deny",
      decidedBy: "user-2"
    });
    expect(decision.taskResult?.status).toBe("cancelled");

    const [reconciled] = await backend.listPlanItems("org-exec-deny", "2026-08-11");
    expect(reconciled.status).toBe("blocked");
    expect(reconciled.metadata).toMatchObject({
      approvalDecision: "deny",
      approvalId,
      executionStatus: "cancelled"
    });
    expect(reconciled.notes).toContain("cancelled");

    await backend.stopOrg("org-exec-deny");
  });

  it("rejects execution when a plan item has no assigned worker", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    const item = await backend.createPlanItem({
      orgId: "org-exec-3",
      date: "2026-08-11",
      title: "Unassigned work"
    });

    await expect(
      backend.executePlanItem({
        orgId: "org-exec-3",
        itemId: item.id,
        taskType: "commercial_investment_workflow",
        taskInput: { address: "100 Market St, Phoenix, AZ" }
      })
    ).rejects.toThrow("has no assigned worker");
  });

  it("keeps planning state isolated by organization", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    await backend.createPlanItem({
      orgId: "org-1",
      date: "2026-08-11",
      title: "Org one task"
    });

    expect(await backend.listPlanItems("org-2", "2026-08-11")).toEqual([]);
    expect(await backend.getDailyPlan("org-2", "2026-08-11")).toBeUndefined();
  });

  it("generates by priority within capacity and exposes the current recommendation", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    const strategic = await backend.createPlanItem({
      orgId: "org-agenda",
      date: "2026-08-13",
      title: "Contact qualified multifamily buyers"
    });
    const urgentLowValue = await backend.createPlanItem({
      orgId: "org-agenda",
      date: "2026-08-13",
      title: "Clean up low-value notes"
    });

    const result = await backend.generateLivingAgenda({
      orgId: "org-agenda",
      date: "2026-08-13",
      availableMinutes: 60,
      surface: "widget",
      candidates: [
        {
          itemId: strategic.id,
          estimatedMinutes: 60,
          priorityFactors: { goalAlignment: 95, impact: 90, urgency: 60 }
        },
        {
          itemId: urgentLowValue.id,
          estimatedMinutes: 30,
          priorityFactors: { goalAlignment: 10, impact: 10, urgency: 95 }
        }
      ]
    });

    expect(result.agenda.items.map((item) => item.itemId)).toEqual([strategic.id]);
    expect(result.agenda.deferred.map((item) => item.itemId)).toEqual([
      urgentLowValue.id
    ]);
    expect(result.now).toMatchObject({
      surface: "widget",
      primaryText: "Contact qualified multifamily buyers",
      currentPlanItemId: strategic.id
    });
  });

  it("reconciles completed, skipped, and blocked work out of the executable agenda", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    const completed = await backend.createPlanItem({
      orgId: "org-reconcile",
      date: "2026-08-13",
      title: "Completed task"
    });
    const skipped = await backend.createPlanItem({
      orgId: "org-reconcile",
      date: "2026-08-13",
      title: "Skipped task"
    });
    const blocked = await backend.createPlanItem({
      orgId: "org-reconcile",
      date: "2026-08-13",
      title: "Blocked task"
    });
    const remaining = await backend.createPlanItem({
      orgId: "org-reconcile",
      date: "2026-08-13",
      title: "Remaining priority"
    });

    const result = await backend.reconcileLivingAgenda({
      orgId: "org-reconcile",
      date: "2026-08-13",
      availableMinutes: 45,
      candidates: [completed, skipped, blocked, remaining].map((item) => ({
        itemId: item.id,
        estimatedMinutes: 30,
        priorityFactors: { goalAlignment: item.id === remaining.id ? 90 : 50 }
      })),
      changes: [
        { kind: "completed", itemId: completed.id },
        { kind: "skipped", itemId: skipped.id },
        { kind: "blocked", itemId: blocked.id }
      ]
    });

    expect(result.reconciliation.agenda.items.map((item) => item.itemId)).toEqual([
      remaining.id
    ]);
    expect(result.reconciliation.coachNotes.join(" ")).toContain("completed");
    expect(result.reconciliation.coachNotes.join(" ")).toContain("blocked");
    expect(result.reconciliation.coachNotes.join(" ")).toContain("skipped");
    expect(result.now.currentPlanItemId).toBe(remaining.id);
  });

  it("rejects agenda candidates from another organization or date", async () => {
    const backend = new PlanningRealEstatePlatformBackend();
    const foreign = await backend.createPlanItem({
      orgId: "org-private",
      date: "2026-08-14",
      title: "Private organization task"
    });

    await expect(
      backend.generateLivingAgenda({
        orgId: "org-other",
        date: "2026-08-14",
        availableMinutes: 60,
        candidates: [{ itemId: foreign.id, estimatedMinutes: 30 }]
      })
    ).rejects.toThrow("not found for organization and date");

    await expect(
      backend.generateLivingAgenda({
        orgId: "org-private",
        date: "2026-08-13",
        availableMinutes: 60,
        candidates: [{ itemId: foreign.id, estimatedMinutes: 30 }]
      })
    ).rejects.toThrow("not found for organization and date");
  });


  it("recovers the operating plan through a durable store after backend restart", async () => {
    const filePath = join(
      mkdtempSync(join(tmpdir(), "openrabbit-orchestrator-")),
      "plans.json"
    );
    const first = new PlanningRealEstatePlatformBackend(
      new JsonFileCalendarPlanStore({ filePath })
    );
    const item = await first.createPlanItem({
      orgId: "org-restart",
      date: "2026-08-13",
      title: "Follow up with qualified buyer",
      notes: "Initial context"
    });
    await first.updatePlanItem({
      orgId: "org-restart",
      itemId: item.id,
      status: "blocked",
      notes: "Waiting for proof of funds",
      taskId: "task-restart"
    });
    await first.saveDailyPlan({
      orgId: "org-restart",
      date: "2026-08-13",
      timezone: "America/Phoenix",
      objective: "Move the buyer conversation forward",
      itemIds: [item.id],
      generatedBy: "openrabbit"
    });

    const restarted = new PlanningRealEstatePlatformBackend(
      new JsonFileCalendarPlanStore({ filePath })
    );
    expect(await restarted.getDailyPlan("org-restart", "2026-08-13")).toMatchObject({
      objective: "Move the buyer conversation forward",
      itemIds: [item.id]
    });
    expect(await restarted.listPlanItems("org-restart", "2026-08-13")).toEqual([
      expect.objectContaining({
        id: item.id,
        status: "blocked",
        taskId: "task-restart",
        notes: "Waiting for proof of funds"
      })
    ]);

    const newItem = await restarted.createPlanItem({
      orgId: "org-restart",
      date: "2026-08-13",
      title: "New work after restart"
    });
    expect(newItem.id).not.toBe(item.id);
  });

});
