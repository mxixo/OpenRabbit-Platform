"use strict";

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function createInMemoryStateBacking() {
  return {
    deals: new Map(),
    runs: new Map(),
    tasks: new Map(),
    approvals: new Map(),
    audit: new Map(),
  };
}

class InMemoryRealEstateStateRepository {
  constructor(backing = createInMemoryStateBacking()) {
    this.backing = backing;
  }

  key(orgId, id) {
    return `${orgId}:${id}`;
  }

  async createDeal(input) {
    const now = new Date().toISOString();
    const deal = {
      id: required(input.id, "deal id"),
      orgId: required(input.orgId, "deal orgId"),
      address: required(input.address, "deal address"),
      propertyType: input.propertyType || "commercial",
      status: input.status || "screening",
      createdAt: input.createdAt || now,
      updatedAt: input.updatedAt || now,
      metadata: clone(input.metadata || {}),
    };
    const key = this.key(deal.orgId, deal.id);
    if (this.backing.deals.has(key)) throw new Error(`Deal already exists: ${deal.id}`);
    this.backing.deals.set(key, deal);
    return clone(deal);
  }

  async getDeal(orgId, dealId) {
    return clone(this.backing.deals.get(this.key(orgId, dealId)));
  }

  async listDeals(orgId) {
    return [...this.backing.deals.values()]
      .filter((deal) => deal.orgId === orgId)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .map(clone);
  }

  async saveTaskResult(input) {
    const key = this.key(input.orgId, input.taskId);
    if (this.backing.tasks.has(key)) return clone(this.backing.tasks.get(key));
    const record = { ...clone(input), createdAt: input.createdAt || new Date().toISOString() };
    this.backing.tasks.set(key, record);
    return clone(record);
  }

  async getTaskResult(orgId, taskId) {
    return clone(this.backing.tasks.get(this.key(orgId, taskId)));
  }

  async saveUnderwritingRun(input) {
    const runs = this.backing.runs.get(this.key(input.orgId, input.dealId)) || [];
    if (runs.some((run) => run.taskId === input.taskId)) {
      return clone(runs.find((run) => run.taskId === input.taskId));
    }
    const record = {
      ...clone(input),
      version: runs.length + 1,
      createdAt: input.createdAt || new Date().toISOString(),
    };
    runs.push(record);
    this.backing.runs.set(this.key(input.orgId, input.dealId), runs);
    return clone(record);
  }

  async listUnderwritingRuns(orgId, dealId) {
    return clone(this.backing.runs.get(this.key(orgId, dealId)) || []);
  }

  async createApproval(input) {
    const key = this.key(input.orgId, input.id);
    if (this.backing.approvals.has(key)) return clone(this.backing.approvals.get(key));
    const approval = {
      ...clone(input),
      status: "pending",
      requestedAt: input.requestedAt || new Date().toISOString(),
    };
    this.backing.approvals.set(key, approval);
    return clone(approval);
  }

  async getApproval(orgId, approvalId) {
    return clone(this.backing.approvals.get(this.key(orgId, approvalId)));
  }

  async decideApproval(orgId, approvalId, decision, decidedBy) {
    const key = this.key(orgId, approvalId);
    const current = this.backing.approvals.get(key);
    if (!current) throw new Error(`Approval request not found: ${approvalId}`);
    if (current.status !== "pending") throw new Error(`Approval request ${approvalId} is already ${current.status}`);
    if (!["approve", "deny"].includes(decision)) throw new Error("decision must be approve or deny");
    required(decidedBy, "decidedBy");
    const next = {
      ...current,
      status: decision === "approve" ? "approved" : "denied",
      decidedAt: new Date().toISOString(),
      decidedBy,
    };
    this.backing.approvals.set(key, next);
    return clone(next);
  }

  async listApprovals(orgId, status) {
    return [...this.backing.approvals.values()]
      .filter((item) => item.orgId === orgId && (!status || item.status === status))
      .map(clone);
  }

  async appendAudit(input) {
    const key = this.key(input.orgId, input.id);
    if (this.backing.audit.has(key)) return clone(this.backing.audit.get(key));
    const record = { ...clone(input), timestamp: input.timestamp || new Date().toISOString() };
    this.backing.audit.set(key, record);
    return clone(record);
  }

  async listAudit(orgId) {
    return [...this.backing.audit.values()]
      .filter((item) => item.orgId === orgId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map(clone);
  }
}

function mapDeal(row) {
  return {
    id: row.id,
    orgId: row.org_id,
    address: row.address,
    propertyType: row.property_type,
    status: row.status,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class SupabaseRealEstateStateRepository {
  constructor({ projectUrl, secretKey, fetchImpl = fetch }) {
    this.baseUrl = `${required(projectUrl, "projectUrl").replace(/\/$/, "")}/rest/v1`;
    this.secretKey = required(secretKey, "secretKey");
    this.fetch = fetchImpl;
  }

  async request(path, options = {}) {
    const response = await this.fetch(`${this.baseUrl}/${path}`, {
      ...options,
      headers: {
        apikey: this.secretKey,
        "Content-Type": "application/json",
        Prefer: options.prefer || "return=representation",
        ...(options.headers || {}),
      },
    });
    if (!response.ok) throw new Error(`Supabase state request failed (${response.status}): ${await response.text()}`);
    if (response.status === 204) return [];
    return response.json();
  }

  async createDeal(input) {
    const rows = await this.request("real_estate_deals", {
      method: "POST",
      body: JSON.stringify({
        id: required(input.id, "deal id"),
        org_id: required(input.orgId, "deal orgId"),
        address: required(input.address, "deal address"),
        property_type: input.propertyType || "commercial",
        status: input.status || "screening",
        metadata: input.metadata || {},
      }),
    });
    return mapDeal(rows[0]);
  }

  async getDeal(orgId, dealId) {
    const rows = await this.request(
      `real_estate_deals?org_id=eq.${encodeURIComponent(orgId)}&id=eq.${encodeURIComponent(dealId)}&limit=1`,
      { method: "GET" }
    );
    return rows[0] ? mapDeal(rows[0]) : undefined;
  }

  async listDeals(orgId) {
    const rows = await this.request(
      `real_estate_deals?org_id=eq.${encodeURIComponent(orgId)}&order=updated_at.desc`,
      { method: "GET" }
    );
    return rows.map(mapDeal);
  }

  async saveTaskResult(input) {
    const rows = await this.request("real_estate_task_results?on_conflict=org_id,task_id", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=representation",
      body: JSON.stringify({ org_id: input.orgId, task_id: input.taskId, result: input.result }),
    });
    if (!rows[0]) return this.getTaskResult(input.orgId, input.taskId);
    return { orgId: rows[0].org_id, taskId: rows[0].task_id, result: rows[0].result, createdAt: rows[0].created_at };
  }

  async getTaskResult(orgId, taskId) {
    const rows = await this.request(
      `real_estate_task_results?org_id=eq.${encodeURIComponent(orgId)}&task_id=eq.${encodeURIComponent(taskId)}&limit=1`,
      { method: "GET" }
    );
    return rows[0] && { orgId: rows[0].org_id, taskId: rows[0].task_id, result: rows[0].result, createdAt: rows[0].created_at };
  }

  async saveUnderwritingRun(input) {
    const existing = await this.listUnderwritingRuns(input.orgId, input.dealId);
    const duplicate = existing.find((run) => run.taskId === input.taskId);
    if (duplicate) return duplicate;
    const rows = await this.request("real_estate_underwriting_runs", {
      method: "POST",
      body: JSON.stringify({
        org_id: input.orgId,
        deal_id: input.dealId,
        task_id: input.taskId,
        version: existing.length + 1,
        input: input.input,
        report: input.report,
        status: input.status || "completed",
      }),
    });
    return this.mapRun(rows[0]);
  }

  async listUnderwritingRuns(orgId, dealId) {
    const rows = await this.request(
      `real_estate_underwriting_runs?org_id=eq.${encodeURIComponent(orgId)}&deal_id=eq.${encodeURIComponent(dealId)}&order=version.asc`,
      { method: "GET" }
    );
    return rows.map((row) => this.mapRun(row));
  }

  mapRun(row) {
    return {
      id: String(row.id), orgId: row.org_id, dealId: row.deal_id, taskId: row.task_id,
      version: row.version, input: row.input, report: row.report, status: row.status, createdAt: row.created_at,
    };
  }

  async createApproval(input) {
    const rows = await this.request("real_estate_approval_requests?on_conflict=org_id,id", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=representation",
      body: JSON.stringify({
        id: input.id, org_id: input.orgId, worker_id: input.workerId, task_id: input.taskId,
        task_type: input.taskType, input: input.input, policy_id: input.policyId,
        metadata: input.metadata || {},
      }),
    });
    if (!rows[0]) return this.getApproval(input.orgId, input.id);
    return this.mapApproval(rows[0]);
  }

  async getApproval(orgId, approvalId) {
    const rows = await this.request(`real_estate_approval_requests?org_id=eq.${encodeURIComponent(orgId)}&id=eq.${encodeURIComponent(approvalId)}&limit=1`, { method: "GET" });
    return rows[0] && this.mapApproval(rows[0]);
  }

  async decideApproval(orgId, approvalId, decision, decidedBy) {
    if (!["approve", "deny"].includes(decision)) throw new Error("decision must be approve or deny");
    required(decidedBy, "decidedBy");
    const rows = await this.request(
      `real_estate_approval_requests?org_id=eq.${encodeURIComponent(orgId)}&id=eq.${encodeURIComponent(approvalId)}&status=eq.pending`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: decision === "approve" ? "approved" : "denied", decided_at: new Date().toISOString(), decided_by: decidedBy }),
      }
    );
    if (!rows[0]) throw new Error(`Approval request not found or already decided: ${approvalId}`);
    return this.mapApproval(rows[0]);
  }

  async listApprovals(orgId, status) {
    const suffix = status ? `&status=eq.${encodeURIComponent(status)}` : "";
    const rows = await this.request(`real_estate_approval_requests?org_id=eq.${encodeURIComponent(orgId)}${suffix}&order=requested_at.asc`, { method: "GET" });
    return rows.map((row) => this.mapApproval(row));
  }

  mapApproval(row) {
    return {
      id: row.id, orgId: row.org_id, workerId: row.worker_id, taskId: row.task_id,
      taskType: row.task_type, input: row.input, status: row.status, policyId: row.policy_id,
      requestedAt: row.requested_at, decidedAt: row.decided_at || undefined,
      decidedBy: row.decided_by || undefined, metadata: row.metadata || {},
    };
  }

  async appendAudit(input) {
    const rows = await this.request("real_estate_audit_records?on_conflict=org_id,id", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=representation",
      body: JSON.stringify({
        id: input.id, org_id: input.orgId, kind: input.kind, timestamp: input.timestamp,
        actor_id: input.actorId, worker_id: input.workerId, task_id: input.taskId,
        approval_id: input.approvalId, action: input.action, outcome: input.outcome,
        metadata: input.metadata || {},
      }),
    });
    return rows[0] || input;
  }

  async listAudit(orgId) {
    const rows = await this.request(`real_estate_audit_records?org_id=eq.${encodeURIComponent(orgId)}&order=timestamp.asc`, { method: "GET" });
    return rows.map((row) => ({
      id: row.id, orgId: row.org_id, kind: row.kind, timestamp: row.timestamp,
      actorId: row.actor_id || undefined, workerId: row.worker_id || undefined,
      taskId: row.task_id || undefined, approvalId: row.approval_id || undefined,
      action: row.action || undefined, outcome: row.outcome || undefined,
      metadata: row.metadata || {},
    }));
  }
}

module.exports = {
  createInMemoryStateBacking,
  InMemoryRealEstateStateRepository,
  SupabaseRealEstateStateRepository,
};
