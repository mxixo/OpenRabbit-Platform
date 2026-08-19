"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DurableMeetingProposalStore } = require("../capabilities/productivity/durable-meeting-proposal-store");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openrabbit-meetings-"));
const filePath = path.join(dir, "meeting-proposals.json");

const first = new DurableMeetingProposalStore({ filePath });
const proposal = { id: "meeting-1", orgId: "org-1", status: "proposed", event: { title: "Review", start: "2026-08-19T14:00:00-07:00", end: "2026-08-19T14:30:00-07:00" }, history: [] };
first.save(proposal);
assert.equal(first.get("meeting-1").status, "proposed");

const second = new DurableMeetingProposalStore({ filePath });
assert.equal(second.get("meeting-1").event.title, "Review", "proposal must survive a fresh store instance");
second.save({ ...second.get("meeting-1"), status: "approved" });

const third = new DurableMeetingProposalStore({ filePath });
assert.equal(third.get("meeting-1").status, "approved", "updated lifecycle state must persist");
assert.equal(third.list().length, 1);

fs.rmSync(dir, { recursive: true, force: true });
console.log("durable-meeting-proposal-store.test.js passed");
