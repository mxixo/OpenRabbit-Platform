"use strict";

const emailParams = new URLSearchParams(location.search);
const emailOrgId = emailParams.get("org") || "org-test";
const resolutionLoading = new Set();

async function emailRequest(path, options={}){
  const response = await fetch(path, {
    ...options,
    headers:{"content-type":"application/json", ...(options.headers||{})}
  });
  const payload = await response.json().catch(()=>({}));
  if(!response.ok){
    const message = payload?.error?.message || payload?.message || `Email request failed (${response.status})`;
    throw new Error(message);
  }
  return payload?.data?.result ?? payload?.data ?? payload;
}

function installEmailStyles(){
  if(document.getElementById("openrabbitEmailStyles")) return;
  const style=document.createElement("style");
  style.id="openrabbitEmailStyles";
  style.textContent=`
    .email-action{margin-top:9px;padding-top:9px;border-top:1px solid #e5e7eb;display:grid;gap:7px}.email-action-row{display:grid;grid-template-columns:1fr 1fr auto;gap:7px}.email-action input,.email-action button{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px;background:white;color:#0f172a}.email-action button{width:auto;background:#0f172a;color:white;border:0;font-weight:800;cursor:pointer}.email-context{font-size:11px;color:#64748b}.email-done{font-size:11px;color:#166534;font-weight:800}.resolution-box{margin-top:9px;padding:10px;border:1px solid #dbe2ea;border-radius:10px;background:#f8fafc;display:grid;gap:8px}.resolution-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.resolution-candidate{background:white;border:1px solid #e5e7eb;border-radius:9px;padding:9px;display:grid;gap:6px}.resolution-row{display:flex;gap:7px;align-items:center;justify-content:space-between}.resolution-actions{display:flex;gap:6px}.resolution-actions button{border:1px solid #cbd5e1;background:white;color:#0f172a;border-radius:8px;padding:6px 9px;font-weight:800;cursor:pointer}.resolution-actions button[data-decision="accepted"]{background:#0f172a;color:white;border-color:#0f172a}.resolution-confidence{font-size:11px;font-weight:900;color:#475569}.resolution-reason{font-size:11px;color:#64748b}.resolution-status{font-size:11px;color:#64748b}@media(max-width:760px){.email-action-row{grid-template-columns:1fr}.resolution-row{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);
}

function focusedEmailPanel(){
  return document.querySelector('.workspace-panel.focused[data-panel="email"] .panel-body');
}

function emailRows(){
  const rows=window.__openrabbitWorkspaceModel?.surfaces?.email?.data?.items;
  return Array.isArray(rows)?rows:[];
}

function defaultStart(){
  const d=new Date(Date.now()+60*60*1000);
  d.setMinutes(Math.ceil(d.getMinutes()/15)*15,0,0);
  const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
}

function installScheduling(message, card){
  if(message.actionType!=="scheduling" || !message.needsAction || card.querySelector("[data-email-schedule]")) return;
  const action=document.createElement("div");
  action.className="email-action";
  action.dataset.emailSchedule=message.id;
  action.innerHTML=`
    <div class="email-context">Scheduling intent detected${message.relationshipId?" · linked CRM relationship":""}${message.propertyId?" · linked property":""}</div>
    <div class="email-action-row">
      <input data-start type="datetime-local" value="${defaultStart()}" aria-label="Meeting start" />
      <input data-end type="datetime-local" aria-label="Meeting end" />
      <button type="button">Add to calendar</button>
    </div>
    <div data-status class="email-context">OpenRabbit will preserve the email, CRM, and property links on the calendar item.</div>`;
  const start=action.querySelector("[data-start]");
  const end=action.querySelector("[data-end]");
  const button=action.querySelector("button");
  const status=action.querySelector("[data-status]");
  start.addEventListener("change",()=>{if(!end.value && start.value){const d=new Date(start.value);d.setMinutes(d.getMinutes()+30);const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);end.value=local.toISOString().slice(0,16)}});
  button.addEventListener("click",async()=>{
    if(!start.value){status.textContent="Choose a start time first.";return}
    try{
      button.disabled=true;button.textContent="Scheduling…";
      const result=await emailRequest(`/v1/orgs/${encodeURIComponent(emailOrgId)}/email/messages/${encodeURIComponent(message.id)}/schedule`,{method:"POST",body:JSON.stringify({startAt:start.value,endAt:end.value||undefined,title:message.subject})});
      button.textContent="Scheduled";
      status.className="email-done";
      status.textContent=`Added to Calendar${result?.item?.startAt?` · ${new Date(result.item.startAt).toLocaleString()}`:""}`;
      window.dispatchEvent(new CustomEvent("openrabbit:refresh-workspace"));
    }catch(error){button.disabled=false;button.textContent="Retry";status.textContent=error instanceof Error?error.message:"Scheduling failed"}
  });
  card.appendChild(action);
}

async function installResolution(message, card){
  if(message.relationshipId && message.propertyId) return;
  if(card.querySelector("[data-resolution-box]")) return;
  if(resolutionLoading.has(message.id)) return;
  resolutionLoading.add(message.id);
  try{
    const result=await emailRequest(`/v1/orgs/${encodeURIComponent(emailOrgId)}/resolution/email/${encodeURIComponent(message.id)}`);
    const candidates=(result?.candidates||[]).filter((candidate)=>candidate.disposition==="suggest");
    if(!candidates.length) return;
    const box=document.createElement("div");
    box.className="resolution-box";
    box.dataset.resolutionBox=message.id;
    box.innerHTML=`<div class="resolution-head"><strong>Possible context matches</strong><span class="resolution-confidence">Review required</span></div><div class="resolution-status">OpenRabbit found plausible links but will not apply them without your approval.</div>`;
    for(const candidate of candidates.slice(0,4)){
      const row=document.createElement("div");
      row.className="resolution-candidate";
      const pct=Math.round(Number(candidate.confidence||0)*100);
      row.innerHTML=`<div class="resolution-row"><div><strong>${String(candidate.label||candidate.targetId)}</strong><div class="resolution-confidence">${candidate.targetType} · ${pct}% confidence</div></div><div class="resolution-actions"><button data-decision="rejected" type="button">Reject</button><button data-decision="accepted" type="button">Accept</button></div></div><div class="resolution-reason">${(candidate.reasons||[]).join(" · ")}</div>`;
      row.querySelectorAll("[data-decision]").forEach((button)=>button.addEventListener("click",async()=>{
        const decision=button.dataset.decision;
        row.querySelectorAll("button").forEach((b)=>b.disabled=true);
        try{
          await emailRequest(`/v1/orgs/${encodeURIComponent(emailOrgId)}/resolution/email/${encodeURIComponent(message.id)}/decision`,{
            method:"POST",
            body:JSON.stringify({targetType:candidate.targetType,targetId:candidate.targetId,decision,actorId:"workspace-user"})
          });
          row.innerHTML=`<div class="email-done">${decision==="accepted"?"Accepted and linked":"Rejected"} · feedback recorded</div>`;
          if(decision==="accepted") window.dispatchEvent(new CustomEvent("openrabbit:refresh-workspace"));
        }catch(error){
          row.querySelectorAll("button").forEach((b)=>b.disabled=false);
          const status=box.querySelector(".resolution-status");
          if(status) status.textContent=error instanceof Error?error.message:"Could not save resolution decision";
        }
      }));
      box.appendChild(row);
    }
    card.appendChild(box);
  }catch{
    // Resolution is assistive. Email remains usable if inspection is unavailable.
  }finally{
    resolutionLoading.delete(message.id);
  }
}

function enhanceEmail(){
  installEmailStyles();
  const panel=focusedEmailPanel();
  if(!panel) return;
  const rows=emailRows();
  for(const message of rows){
    const card=panel.querySelector(`[data-email-id="${CSS.escape(message.id)}"]`);
    if(!card) continue;
    installScheduling(message, card);
    installResolution(message, card);
  }
}

const emailWorkspace=document.getElementById("adaptiveWorkspace");
if(emailWorkspace){
  const observer=new MutationObserver(()=>queueMicrotask(enhanceEmail));
  observer.observe(emailWorkspace,{childList:true,subtree:true});
}
window.addEventListener("openrabbit:workspace-model",enhanceEmail);
window.addEventListener("openrabbit:workspace-rendered",enhanceEmail);
window.addEventListener("load",enhanceEmail);
