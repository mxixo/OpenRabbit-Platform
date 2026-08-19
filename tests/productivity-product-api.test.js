"use strict";

const assert = require("assert");
const { ProductivityProductApi } = require("../capabilities/productivity/product-api");

(async () => {
  const calls = [];
  const workflow = {
    async scanMail(input) { calls.push(["scan", input]); return [{ id: "p-1", status: "proposed" }]; },
    list() { calls.push(["list"]); return [{ id: "p-1", status: "proposed" }]; },
    edit(id, event, actorId) { calls.push(["edit", id, event, actorId]); return { id, status: "proposed", event }; },
    approve(id, actorId) { calls.push(["approve", id, actorId]); return { id, status: "approved" }; },
    reject(id, actorId) { calls.push(["reject", id, actorId]); return { id, status: "rejected" }; },
    async execute(id, actorId) { calls.push(["execute", id, actorId]); return { proposal: { id, status: "executed" }, result: { id: "cal-1" } }; },
  };
  const api = new ProductivityProductApi({ meetingWorkflow: workflow });

  let response = await api.handle({ method: "POST", path: "/v1/orgs/org-1/meeting-proposals/scan", body: { query: "is:unread" }, actorId: "actor-1" });
  assert.equal(response.status, 201);
  assert.equal(calls[0][1].orgId, "org-1");

  response = await api.handle({ method: "GET", path: "/v1/orgs/org-1/meeting-proposals", actorId: "actor-1" });
  assert.equal(response.status, 200);

  response = await api.handle({ method: "PATCH", path: "/v1/orgs/org-1/meeting-proposals/p-1", body: { event: { title: "Edited" } }, actorId: "actor-1" });
  assert.equal(response.status, 200);
  assert.equal(calls.find((x) => x[0] === "edit")[1], "p-1");

  response = await api.handle({ method: "POST", path: "/v1/orgs/org-1/meeting-proposals/p-1/approve", actorId: "actor-1" });
  assert.equal(response.data.status, "approved");

  response = await api.handle({ method: "POST", path: "/v1/orgs/org-1/meeting-proposals/p-1/execute", actorId: "actor-1" });
  assert.equal(response.data.proposal.status, "executed");

  response = await api.handle({ method: "GET", path: "/bad", actorId: "actor-1" });
  assert.equal(response.status, 404);

  console.log("productivity-product-api.test.js passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
