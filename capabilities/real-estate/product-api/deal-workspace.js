"use strict";

function buildActionState({ latestRun, approvals }) {
  const decision = latestRun?.report?.decision || null;
  const pendingApprovals = approvals.filter((item) => item.status === "pending");
  const approvedApprovals = approvals.filter((item) => item.status === "approved");
  const nextActions = decision?.suggestedNextActions || [];

  return {
    recommendation: decision?.recommendation || null,
    suggestedNextActions: nextActions,
    approvalRequiredFor: decision?.approvalRequiredFor || [],
    pendingApprovalCount: pendingApprovals.length,
    approvedApprovalCount: approvedApprovals.length,
    canRequestOutreachApproval: Boolean(
      latestRun &&
      pendingApprovals.length === 0 &&
      decision?.approvalRequiredFor?.includes("send_investor_outreach")
    ),
  };
}

async function buildDealWorkspace({ repository, durableService, orgId, dealId }) {
  const deal = await durableService.getDeal(orgId, dealId);
  if (!deal) throw new Error(`Deal not found: ${dealId}`);

  const [runs, approvals, audit] = await Promise.all([
    durableService.listRuns(orgId, dealId),
    repository.listApprovals(orgId),
    repository.listAudit(orgId),
  ]);

  const dealApprovals = approvals.filter((approval) => approval.input?.dealId === dealId);
  const dealTaskIds = new Set(runs.map((run) => run.taskId));
  for (const approval of dealApprovals) dealTaskIds.add(approval.taskId);
  const dealAudit = audit.filter(
    (entry) => entry.metadata?.dealId === dealId || dealTaskIds.has(entry.taskId)
  );
  const latestRun = runs.length ? runs[runs.length - 1] : null;

  return {
    workspaceVersion: "1.0.0",
    deal,
    underwriting: {
      status: latestRun ? "analyzed" : "not_started",
      latestRun,
      latestReport: latestRun?.report || null,
      runCount: runs.length,
      versions: runs.map((run) => ({
        version: run.version,
        taskId: run.taskId,
        status: run.status,
        createdAt: run.createdAt,
        contractVersion: run.report?.contractVersion || null,
      })),
    },
    approvals: dealApprovals,
    actions: buildActionState({ latestRun, approvals: dealApprovals }),
    history: dealAudit,
  };
}

module.exports = { buildDealWorkspace, buildActionState };
