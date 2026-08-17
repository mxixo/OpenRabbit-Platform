"use strict";

const app = document.getElementById("app");
const dealTitle = document.getElementById("dealTitle");
const dealMeta = document.getElementById("dealMeta");

function money(value){return Number.isFinite(Number(value))?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(value)):"—"}
function number(value,suffix=""){return Number.isFinite(Number(value))?`${Number(value)}${suffix}`:"—"}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
function scenarioCard(name, scenario){const m=scenario?.investmentMetrics||{};return `<section class="card span4 scenario"><div class="label">${escapeHtml(name)} scenario</div><h3>${money(m.annualCashFlowBeforeTax)} cash flow</h3><div class="muted">Cap ${number(m.capRate,"%")} · DSCR ${number(m.dscr)} · Cash-on-cash ${number(m.cashOnCash,"%")}</div></section>`}
function render(workspace){
  const deal=workspace.deal||{};const report=workspace.latestReport;const summary=workspace.summary||{};
  dealTitle.textContent=deal.address||"Deal Workspace";
  dealMeta.textContent=`${deal.propertyType||"commercial"} · ${deal.status||"screening"} · ${summary.runCount||0} underwriting version(s)`;
  if(!report){app.innerHTML=`<div class="grid"><section class="card span12 empty"><h2>No underwriting yet</h2><p>Create the first underwriting run to unlock scenarios, recommendation, diligence and approval actions.</p></section></div>`;return;}
  const metrics=report.investmentMetrics||{};const dq=report.dataQuality||{};const decision=report.decision||{};const scenarios=report.scenarios||{};
  const warnings=[...(dq.warnings||[]),...(dq.diligenceItems||[])];
  app.innerHTML=`<div class="grid">
    <section class="card span3"><div class="label">NOI</div><div class="kpi">${money(metrics.noi)}</div></section>
    <section class="card span3"><div class="label">Cap rate</div><div class="kpi">${number(metrics.capRate,"%")}</div></section>
    <section class="card span3"><div class="label">DSCR</div><div class="kpi">${number(metrics.dscr)}</div></section>
    <section class="card span3"><div class="label">Confidence</div><div class="kpi">${escapeHtml(dq.confidence||"—")}</div><div class="muted">${number(dq.sourceCoveragePct,"%")} source coverage</div></section>
    ${scenarioCard("Downside",scenarios.downside)}${scenarioCard("Base",scenarios.base)}${scenarioCard("Upside",scenarios.upside)}
    <section class="card span8 decision"><div class="label">OpenRabbit recommendation</div><div class="kpi">${escapeHtml((decision.recommendation||"pending").replaceAll("_"," "))}</div><p class="muted">${(decision.rationale||[]).map(escapeHtml).join(" ")}</p><div class="actions"><button class="primary" disabled>Revise assumptions</button><button class="secondary" disabled>Request approval</button></div></section>
    <section class="card span4"><div class="label">Target purchase price</div><div class="kpi">${money(decision.targetPurchasePrice)}</div><div class="muted">Target cap ${number(decision.targetCapRatePct,"%")}</div></section>
    <section class="card span8 warning"><div class="label">Diligence & data quality</div>${warnings.length?`<ul>${warnings.map((x)=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:"<p>No current warnings.</p>"}</section>
    <section class="card span4"><div class="label">Workflow state</div><p><strong>${summary.pendingApprovalCount||0}</strong> pending approvals</p><p><strong>${summary.approvedApprovalCount||0}</strong> approved approvals</p><p>${workspace.nextActions?.canRequestOutreachApproval?"Ready to request controlled outreach approval.":"Review the current next actions."}</p></section>
    <section class="card span12"><div class="label">Activity history</div><ul class="timeline">${(workspace.audit||[]).slice().reverse().map((x)=>`<li><strong>${escapeHtml(x.kind)}</strong> · ${escapeHtml(x.action||"")} <span class="muted">${escapeHtml(x.timestamp||"")}</span></li>`).join("")||"<li>No activity yet.</li>"}</ul></section>
  </div>`;
}

async function loadWorkspace(){
  const orgId=document.getElementById("orgId").value.trim();const dealId=document.getElementById("dealId").value.trim();const token=document.getElementById("token").value.trim();
  if(!orgId||!dealId){app.innerHTML='<div class="card empty">Organization and deal ID are required.</div>';return;}
  app.innerHTML='<div class="card empty">Loading workspace…</div>';
  try{
    const headers=token?{Authorization:`Bearer ${token}`}:{ };
    const response=await fetch(`/v1/orgs/${encodeURIComponent(orgId)}/deals/${encodeURIComponent(dealId)}/workspace`,{headers});
    const body=await response.json();
    if(!response.ok)throw new Error(body?.error?.message||"Unable to load deal workspace");
    render(body.data);
  }catch(error){app.innerHTML=`<div class="card empty"><strong>Workspace unavailable</strong><p>${escapeHtml(error.message)}</p></div>`;}
}

document.getElementById("loadBtn").addEventListener("click",loadWorkspace);
