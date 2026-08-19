"use strict";

const assert = require("assert");
const { MeetingProposalWorkflow } = require("../capabilities/productivity/meeting-proposals");

(async () => {
  const calls = [];
  const provider = {
    async execute(request) {
      calls.push(request);
      if (request.capabilityId === "mail.search") return [{ id: "msg-1" }];
      if (request.capabilityId === "mail.read") return {
        id: "msg-1",
        threadId: "thread-1",
        subject: "Tour 1638 W Mohave",
        from: "client@example.com",
        body: "Can we meet tomorrow at 10:30?"
      };
      if (request.capabilityId === "calendar.event_create" && request.dryRun) return { dryRun: true };
      if (request.capabilityId === "calendar.event_create") return { id: "cal-123", ...request.input.event };
      throw new Error(`unexpected capability ${request.capabilityId}`);
    }
  };
  const detector = {
    async detect() {
      return [{
        confidence: 0.94,
        event: {
          title: "Property tour — 1638 W Mohave",
          start: "2026-08-20T10:30:00-07:00",
          end: "2026-08-20T11:00:00-07:00",
          location: "1638 W Mohave St, Phoenix, AZ",
          attendees: ["client@example.com"]
        }
      }];
    }
  };

  const workflow = new MeetingProposalWorkflow({ capabilityProvider: provider, detector });
  const [proposal] = await workflow.scanMail({ orgId: "org-1", actorId: "agent-1" });

  assert.equal(proposal.status, "proposed");
  assert.equal(proposal.source.messageId, "msg-1");
  assert.equal(proposal.confidence, 0.94);
  assert.equal(calls.filter((x) => x.capabilityId === "calendar.event_create" && !x.dryRun).length, 0, "detection must not write calendar");

  await assert.rejects(() => workflow.execute(proposal.id, "agent-1"), /approved before execution/);

  const edited = workflow.edit(proposal.id, { start: "2026-08-20T11:00:00-07:00", end: "2026-08-20T11:30:00-07:00" }, "agent-1");
  assert.equal(edited.status, "proposed");
  assert.equal(edited.event.start, "2026-08-20T11:00:00-07:00");

  const approved = workflow.approve(proposal.id, "agent-1");
  assert.equal(approved.status, "approved");

  const executed = await workflow.execute(proposal.id, "agent-1");
  assert.equal(executed.proposal.status, "executed");
  assert.equal(executed.proposal.calendarEventId, "cal-123");
  assert.equal(calls.filter((x) => x.capabilityId === "calendar.event_create" && !x.dryRun).length, 1);
  assert.equal(calls.find((x) => x.capabilityId === "calendar.event_create" && !x.dryRun).idempotencyKey, `meeting-proposal:${proposal.id}`);

  await assert.rejects(async () => workflow.reject(proposal.id, "agent-1"), /Cannot change executed proposal/);
  assert.deepEqual(executed.proposal.history.map((x) => x.action), ["detected", "proposed", "edited", "approved", "executed"]);

  console.log("meeting-proposals.test.js passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
