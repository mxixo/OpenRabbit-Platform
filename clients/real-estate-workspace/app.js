"use strict";

const app = document.getElementById("app");
const dealTitle = document.getElementById("dealTitle");
const dealMeta = document.getElementById("dealMeta");
let currentWorkspace = null;

function money(value){return Number.isFinite(Number(value))?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(value)):"—"}
function number(value,suffix=""){return Number.isFinite(Number(value))?`${Number(value)}${suffix}`:"—"}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
function scenarioCard(name, scenario){const m=scenario?.investmentMetrics||{};return `<section class="card span4 scenario"><div class="label">${escapeHtml(name)} scenario</div><h3>${money(m.annualCashFlowBeforeTax)} cash flow</h3><div class="muted">Cap ${number(m.capRate,"%")} · DSCR ${number(m.dscr)} · Cash-on-cash ${number(m.cashOnCash,"%")}</div></section>`}
function credentials(){return {orgId:document.getElementById("orgId").value.trim(),dealId:document.getElementById("dealId").value.trim(),token:document.getElementById("token").value.trim()}}
function headers(token,withJson=false){return {...(token?{Authorization:`Bearer ${token}`}:{ }),...(withJson?{"Content-Type":"application/json"}:{})}}
async function apiRequest(path,{method="GET",body}={}){const {token}=credentials();const response=await fetch(path,{method,headers:headers(token,body!==undefined),...(body!==undefined?{body:JSON.stringify(body)}:{})});const payload=await response.json();if(!response.ok)throw new Error(payload?.error?.message||"OpenRabbit request failed");return payload.data}

function render(workspace){
  currentWorkspace=workspace;
  const deal=workspace.deal||{};const report=workspace.latestReport;const summary=workspace.summary||{};
  dealTitle.textContent=deal.address||"Deal Workspace";
  dealMeta.textContent=`${deal.propertyType||"commercial"} · ${deal.status||"screening"} · ${summary.runCount||0} underwriting version(s)`;
  if(!report){app.innerHTML=`<div class="grid"><section class="card span12 empty"><h2>No underwriting yet</h2><p>Create the first underwriting run to unlock scenarios, recommendation, diligence and approval actions.</p></section></div>`;return;}
  const metrics=report.investmentMetrics||{};const dq=report.dataQuality||{};const decision=report.decision||{};const scenarios=report.scenarios||{};
  const warnings=[...(dq.warnings||[]),...(dq.diligenceItems||[])];
  const pending=(workspace.approvals||[]).filter((x)=>x.status==="pending");
  const approved=(workspace.approvals||[]).filter((x)=>x.status==="approved");
  const actionRows=[
    ...pending.map((x)=>`<div class="approval-row"><span>${escapeHtml(x.taskType)} · pending</span><button class="secondary approveBtn" data-approval-id="${escapeHtml(x.id)}">Approve</button></div>`),
    ...approved.map((x)=>`<div class="approval-row"><span>${escapeHtml(x.taskType)} · approved</span><button class="secondary executeBtn" data-approval-id="${escapeHtml(x.id)}">Execute</button></div>`),
  ].join("");
  app.innerHTML=`<div class="grid">
    <section class="card span3"><div class="label">NOI</div><div class="kpi">${money(metrics.noi)}</div></section>
    <section class="card span3"><div class="label">Cap rate</div><div class="kpi">${number(metrics.capRate,"%")}</div></section>
    <section class="card span3"><div class="label">DSCR</div><div class="kpi">${number(metrics.dscr)}</div></section>
    <section class="card span3"><div class="label">Confidence</div><div class="kpi">${escapeHtml(dq.confidence||"—")}</div><div class="muted">${number(dq.sourceCoveragePct,"%")} source coverage</div></section>
    ${scenarioCard("Downside",scenarios.downside)}${scenarioCard("Base",scenarios.base)}${scenarioCard("Upside",scenarios.upside)}
    <section class="card span8 decision"><div class="label">OpenRabbit recommendation</div><div class="kpi">${escapeHtml((decision.recommendation||"pending").replaceAll("_"," "))}</div><p class="muted">${(decision.rationale||[]).map(escapeHtml).join(" ")}</p><div class="actions"><button class="primary" id="reviseBtn">Revise assumptions</button><button class="secondary" id="requestApprovalBtn" ${workspace.nextActions?.canRequestOutreachApproval?"":"disabled"}>Request outreach approval</button></div></section>
    <section class="card span4"><div class="label">Target purchase price</div><div class="kpi">${money(decision.targetPurchasePrice)}</div><div class="muted">Target cap ${number(decision.targetCapRatePct,"%")}</div></section>
    <section class="card span8 warning"><div class="label">Diligence & data quality</div>${warnings.length?`<ul>${warnings.map((x)=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:"<p>No current warnings.</p>"}</section>
    <section class="card span4"><div class="label">Workflow state</div><p><strong>${summary.pendingApprovalCount||0}</strong> pending approvals</p><p><strong>${summary.approvedApprovalCount||0}</strong> approved approvals</p>${actionRows||"<p>No approval actions awaiting operator input.</p>"}</section>
    <section class="card span12"><div class="label">Activity history</div><ul class="timeline">${(workspace.audit||[]).slice().reverse().map((x)=>`<li><strong>${escapeHtml(x.kind)}</strong> · ${escapeHtml(x.action||"")} <span class="muted">${escapeHtml(x.timestamp||"")}</span></li>`).join("")||"<li>No activity yet.</li>"}</ul></section>
  </div>`;
  document.getElementById("reviseBtn")?.addEventListener("click",reviseAssumptions);
  document.getElementById("requestApprovalBtn")?.addEventListener("click",requestOutreachApproval);
  document.querySelectorAll(".approveBtn").forEach((button)=>button.addEventListener("click",()=>approveAction(button.dataset.approvalId)));
  document.querySelectorAll(".executeBtn").forEach((button)=>button.addEventListener("click",()=>executeAction(button.dataset.approvalId)));
}

async function reviseAssumptions(){
  const report=currentWorkspace?.latestReport;if(!report)return;
  const current=report.assumptions||{};
  const purchasePrice=prompt("Purchase price",current.purchasePrice);if(purchasePrice===null)return;
  const annualGrossIncome=prompt("Annual gross income",current.annualGrossIncome);if(annualGrossIncome===null)return;
  const {orgId,dealId}=credentials();
  const taskId=`underwrite-ui-${Date.now()}`;
  try{
    await apiRequest(`/v1/orgs/${encodeURIComponent(orgId)}/deals/${encodeURIComponent(dealId)}/underwriting-runs`,{method:"POST",body:{taskId,input:{...current,purchasePrice:Number(purchasePrice),annualGrossIncome:Number(annualGrossIncome),address:currentWorkspace.deal.address,propertyType:currentWorkspace.deal.propertyType}}});
    await loadWorkspace();
  }catch(error){alert(error.message)}
}

async function requestOutreachApproval(){
  const report=currentWorkspace?.latestReport;if(!report)return;
  const recipient=prompt("Controlled outreach recipient","test-recipient@openrabbit.local");if(!recipient)return;
  const {orgId,dealId}=credentials();
  const stamp=Date.now();
  try{
    await apiRequest(`/v1/orgs/${encodeURIComponent(orgId)}/deals/${encodeURIComponent(dealId)}/outreach-approvals`,{method:"POST",body:{taskId:`outreach-ui-${stamp}`,approvalId:`approval-ui-${stamp}`,workerId:"workspace-operator",message:{recipient,subject:`Investment review — ${currentWorkspace.deal.address}`,body:report.investorOutreachDraft}}});
    await loadWorkspace();
  }catch(error){alert(error.message)}
}

async function approveAction(approvalId){
  if(!approvalId||!confirm("Approve this external action?"))return;
  const {orgId}=credentials();
  try{
    await apiRequest(`/v1/orgs/${encodeURIComponent(orgId)}/approvals/${encodeURIComponent(approvalId)}/decision`,{method:"POST",body:{decision:"approve"}});
    await loadWorkspace();
  }catch(error){alert(error.message)}
}

async function executeAction(approvalId){
  if(!approvalId||!confirm("Execute this approved external action now?"))return;
  const {orgId}=credentials();
  try{
    await apiRequest(`/v1/orgs/${encodeURIComponent(orgId)}/approvals/${encodeURIComponent(approvalId)}/execute`,{method:"POST"});
    await loadWorkspace();
  }catch(error){alert(error.message)}
}

async function loadWorkspace(){
  const {orgId,dealId}=credentials();
  if(!orgId||!dealId){app.innerHTML='<div class="card empty">Organization and deal ID are required.</div>';return;}
  app.innerHTML='<div class="card empty">Loading workspace…</div>';
  try{render(await apiRequest(`/v1/orgs/${encodeURIComponent(orgId)}/deals/${encodeURIComponent(dealId)}/workspace`))}catch(error){app.innerHTML=`<div class="card empty"><strong>Workspace unavailable</strong><p>${escapeHtml(error.message)}</p></div>`}
}

document.getElementById("loadBtn").addEventListener("click",loadWorkspace);
