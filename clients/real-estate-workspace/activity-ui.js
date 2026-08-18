"use strict";

(function(){
  const drawer=document.getElementById("activityDrawer");
  const list=document.getElementById("activityList");
  const close=document.getElementById("activityClose");
  const trigger=document.getElementById("activityTrigger");
  const stateLabel=document.getElementById("activityState");
  if(!drawer||!list)return;

  const params=new URLSearchParams(location.search);
  const orgId=params.get("org")||"org-test";
  const date=()=>new Date().toISOString().slice(0,10);
  const esc=(value)=>String(value??"").replace(/[&<>'\"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':"&quot;"}[c]));
  const time=(value)=>{const d=new Date(value);return Number.isNaN(d.getTime())?"":d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})};
  const statusLabel=(value)=>String(value||"unknown").replaceAll("_"," ");

  function openDrawer(){drawer.hidden=false;drawer.setAttribute("aria-hidden","false");load();}
  function closeDrawer(){drawer.hidden=true;drawer.setAttribute("aria-hidden","true");}
  trigger?.addEventListener("click",openDrawer);
  close?.addEventListener("click",closeDrawer);
  document.addEventListener("keydown",(event)=>{if(event.key==="Escape"&&!drawer.hidden)closeDrawer()});

  async function request(path, options={}){
    const response=await fetch(path,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload?.error?.message||payload?.data?.error?.message||`Request failed (${response.status})`);
    return payload?.data?.result??payload?.data??payload;
  }

  function entityText(action){
    const entities=Array.isArray(action.entities)?action.entities:[];
    if(!entities.length)return "";
    return entities.slice(0,4).map((entity)=>`${entity.type}: ${entity.label||entity.id}`).join(" · ");
  }

  function controls(action){
    if(action.status==="pending_approval")return `<button class="activity-btn primary" data-approve="${esc(action.id)}">Approve</button>`;
    if(action.status==="approved"||action.status==="proposed")return `<button class="activity-btn primary" data-execute="${esc(action.id)}">Execute</button>`;
    return "";
  }

  function render(actions){
    if(!actions.length){list.innerHTML='<div class="activity-empty"><strong>No environment-agent activity yet.</strong><span>Proposals, approvals, executions, and failures will appear here as OpenRabbit works.</span></div>';return;}
    list.innerHTML=actions.map((action)=>`<article class="activity-row" data-action-id="${esc(action.id)}">
      <div class="activity-time">${esc(time(action.completedAt||action.createdAt)||"—")}</div>
      <div class="activity-main">
        <div class="activity-title-row"><strong>${esc(action.summary)}</strong><span class="activity-status status-${esc(action.status)}">${esc(statusLabel(action.status))}</span></div>
        <div class="activity-meta">${esc(action.actorType)}${action.actorId?` · ${esc(action.actorId)}`:""}${entityText(action)?` · ${esc(entityText(action))}`:""}</div>
        ${action.metadata?.error?`<div class="activity-error">${esc(action.metadata.error)}</div>`:""}
      </div>
      <div class="activity-controls">${controls(action)}</div>
    </article>`).join("");

    list.querySelectorAll("[data-approve]").forEach((button)=>button.addEventListener("click",()=>approve(button.dataset.approve,button)));
    list.querySelectorAll("[data-execute]").forEach((button)=>button.addEventListener("click",()=>execute(button.dataset.execute,button)));
  }

  async function load(){
    if(stateLabel)stateLabel.textContent="Loading…";
    try{
      const today=await request(`/v1/orgs/${encodeURIComponent(orgId)}/today?date=${encodeURIComponent(date())}`);
      render(today.environmentActions||[]);
      if(stateLabel)stateLabel.textContent=`${(today.environmentActions||[]).length} agent actions today`;
      const summary=today.summary||{};
      const approvals=document.getElementById("todayApprovals"), actions=document.getElementById("todayActions"), schedule=document.getElementById("todaySchedule");
      if(approvals)approvals.textContent=`Approvals ${summary.pendingApprovals??0}`;
      if(actions)actions.textContent=`Agent actions ${summary.agentActionsToday??0}`;
      if(schedule)schedule.textContent=`Scheduled ${summary.scheduledItems??0}`;
    }catch(error){
      list.innerHTML=`<div class="activity-empty"><strong>Activity unavailable</strong><span>${esc(error.message)}</span></div>`;
      if(stateLabel)stateLabel.textContent="Connection needed";
    }
  }

  async function approve(actionId, button){
    button.disabled=true;button.textContent="Approving…";
    try{
      await request(`/v1/orgs/${encodeURIComponent(orgId)}/agent/actions/${encodeURIComponent(actionId)}/approve`,{method:"POST",body:JSON.stringify({approvedBy:"workspace-user"})});
      await load();
    }catch(error){button.disabled=false;button.textContent="Approve";alert(error.message)}
  }

  async function execute(actionId, button){
    button.disabled=true;button.textContent="Executing…";
    try{
      await request(`/v1/orgs/${encodeURIComponent(orgId)}/agent/actions/${encodeURIComponent(actionId)}/execute`,{method:"POST",body:"{}"});
      await load();
      window.dispatchEvent(new CustomEvent("openrabbit:refresh-workspace"));
    }catch(error){button.disabled=false;button.textContent="Execute";alert(error.message)}
  }

  window.addEventListener("openrabbit:activity-refresh",load);
  load();
})();