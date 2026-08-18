"use strict";

const STORAGE_KEY = "openrabbit.re.workspace.focus.v1";
const DEFAULT_FOCUS = "calendar";
const SLOT_ORDER = ["left", "right-top", "right-bottom", "bottom"];
const PANEL_ORDER = ["calendar", "email", "crm", "social", "map"];
const workspace = document.getElementById("adaptiveWorkspace");
let workspaceModel = null;

function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
function validFocus(value){return PANEL_ORDER.includes(value)?value:DEFAULT_FOCUS}
function loadFocus(){try{return validFocus(localStorage.getItem(STORAGE_KEY)||DEFAULT_FOCUS)}catch{return DEFAULT_FOCUS}}
function saveFocus(value){try{localStorage.setItem(STORAGE_KEY,value)}catch{}}
function panelSlots(focus){const remaining=PANEL_ORDER.filter((id)=>id!==focus);return new Map(remaining.map((id,index)=>[id,SLOT_ORDER[index]]))}
function fmtTime(value){if(!value)return "";const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}
function surface(id){return workspaceModel?.surfaces?.[id]||{status:"not_connected",data:{items:[]}}}
function items(id){return surface(id)?.data?.items||[]}
function empty(message){return `<div class="item"><strong>Not connected yet</strong><span class="small muted">${escapeHtml(message)}</span></div>`}
function statusNote(id){const s=surface(id);return s.status==="ready"?(s.provider?`Connected · ${escapeHtml(s.provider)}`:"Connected"):escapeHtml(s.message||"Connection required")}

const TEMPLATES = {
  calendar: {
    title: "Calendar", sub: "Your schedule + meaningful AI execution",
    compact(){const rows=items("calendar").slice(0,3);return rows.length?`<div class="list">${rows.map((x)=>`<div class="item ${x.actorType==="worker"?"agent":""}"><strong>${escapeHtml(fmtTime(x.startAt))}${x.startAt?" · ":""}${escapeHtml(x.title)}</strong><span class="small muted">${escapeHtml(x.actorLabel||x.actorType||"")}</span></div>`).join("")}</div>`:empty(surface("calendar").message||"Connect a calendar to populate your schedule.")},
    focus(){const rows=items("calendar");const agent=rows.filter((x)=>x.actorType==="worker").length;return `<div class="metric-row"><div class="metric"><span class="small muted">Scheduled</span><b>${rows.length}</b></div><div class="metric"><span class="small muted">Agent items</span><b>${agent}</b></div><div class="metric"><span class="small muted">Approvals</span><b>${workspaceModel?.summary?.pendingApprovals??0}</b></div></div><div style="height:12px"></div>${rows.length?`<div class="calendar-grid">${rows.map((x)=>`<div class="time">${escapeHtml(fmtTime(x.startAt)||"—")}</div><div class="${x.actorType==="worker"?"agent":""}"><strong>${escapeHtml(x.title)}</strong><div class="small muted">${escapeHtml(x.actorLabel||x.actorType||"")}${x.status?` · ${escapeHtml(x.status)}`:""}</div></div>`).join("")}</div>`:empty(surface("calendar").message||"No schedule data available.")}`}
  },
  email: {
    title: "Email", sub: "Professional communication + agent triage",
    compact(){const rows=items("email");if(!rows.length)return empty(surface("email").message||"Connect email to activate triage.");const action=rows.filter((x)=>x.needsAction).length;return `<div class="list"><div class="item"><strong>Needs action · ${action}</strong><span class="small muted">Across ${rows.length} normalized messages</span></div>${rows.slice(0,2).map((x)=>`<div class="item"><strong>${escapeHtml(x.subject)}</strong><span class="small muted">${escapeHtml(x.summary||x.from||x.actionType||"")}</span></div>`).join("")}</div>`},
    focus(){const rows=items("email");if(!rows.length)return empty(surface("email").message||"Connect Gmail, Microsoft, or another supported provider.");const unread=rows.filter((x)=>x.unread).length, action=rows.filter((x)=>x.needsAction).length;return `<div class="metric-row"><div class="metric"><span class="small muted">Messages</span><b>${rows.length}</b></div><div class="metric"><span class="small muted">Unread</span><b>${unread}</b></div><div class="metric"><span class="small muted">Needs action</span><b>${action}</b></div></div><div style="height:12px"></div><div class="list">${rows.map((x)=>`<div class="item"><strong>${escapeHtml(x.subject)}</strong><span class="small muted">${escapeHtml(x.from||"")}${x.actionType?` · ${escapeHtml(x.actionType)}`:""}${x.summary?` · ${escapeHtml(x.summary)}`:""}</span></div>`).join("")}</div>`}
  },
  crm: {
    title: "CRM", sub: "Relationships, leads, pipeline, follow-up intelligence",
    compact(){const rows=items("crm");if(!rows.length)return empty(surface("crm").message||"Connect a CRM or enable native CRM.");const high=rows.filter((x)=>x.priority==="high").length;return `<div class="list"><div class="item"><strong>${rows.length} relationships</strong><span class="small muted">${high} high priority</span></div>${rows.slice(0,2).map((x)=>`<div class="item"><strong>${escapeHtml(x.displayName)}</strong><span class="small muted">${escapeHtml(x.kind||x.stage||x.summary||"")}</span></div>`).join("")}</div>`},
    focus(){const rows=items("crm");if(!rows.length)return empty(surface("crm").message||"CRM data will appear through the normalized relationship contract.");const high=rows.filter((x)=>x.priority==="high").length, due=rows.filter((x)=>x.nextFollowUpAt).length;return `<div class="metric-row"><div class="metric"><span class="small muted">Relationships</span><b>${rows.length}</b></div><div class="metric"><span class="small muted">High priority</span><b>${high}</b></div><div class="metric"><span class="small muted">Follow-ups</span><b>${due}</b></div></div><div style="height:12px"></div><div class="list">${rows.map((x)=>`<div class="item"><strong>${escapeHtml(x.displayName)}</strong><span class="small muted">${escapeHtml(x.kind||"")}${x.stage?` · ${escapeHtml(x.stage)}`:""}${x.summary?` · ${escapeHtml(x.summary)}`:""}</span></div>`).join("")}</div>`}
  },
  social: {
    title: "Social", sub: "Create, approve, schedule, publish, learn",
    compact(){const rows=items("social"), mode=surface("social")?.data?.autonomyMode||"draft_only";if(!rows.length)return `<span class="mode">${escapeHtml(mode.replaceAll("_"," "))}</span><div style="height:9px"></div>${empty(surface("social").message||"Connect social accounts to activate publishing.")}`;return `<span class="mode">${escapeHtml(mode.replaceAll("_"," "))}</span><div style="height:9px"></div><div class="list">${rows.slice(0,2).map((x)=>`<div class="item"><strong>${escapeHtml(x.title||x.network||"Social post")}</strong><span class="small muted">${escapeHtml(x.status.replaceAll("_"," "))}${x.scheduledAt?` · ${escapeHtml(fmtTime(x.scheduledAt))}`:""}</span></div>`).join("")}</div>`},
    focus(){const rows=items("social"), mode=surface("social")?.data?.autonomyMode||"draft_only";const pending=rows.filter((x)=>x.status==="pending_approval").length, scheduled=rows.filter((x)=>x.status==="scheduled").length;return `<div class="metric-row"><div class="metric"><span class="small muted">Queue</span><b>${rows.length}</b></div><div class="metric"><span class="small muted">Pending</span><b>${pending}</b></div><div class="metric"><span class="small muted">Scheduled</span><b>${scheduled}</b></div></div><div style="height:12px"></div><div class="composer"><strong>Multi-network composer</strong><p class="muted small">Normalized content planning stays separate from irreversible publishing.</p><span class="mode">${escapeHtml(mode.replaceAll("_"," "))}</span></div><div style="height:12px"></div>${rows.length?`<div class="list">${rows.map((x)=>`<div class="item"><strong>${escapeHtml(x.title||x.network||"Social post")}</strong><span class="small muted">${escapeHtml(x.network||"")}${x.status?` · ${escapeHtml(x.status.replaceAll("_"," "))}`:""}</span></div>`).join("")}</div>`:empty(surface("social").message||"No social provider connected.")}`}
  },
  map: {
    title: "Map", sub: "Listings, clients, comps, opportunities, routes",
    compact(){const rows=items("map");if(!rows.length)return `<div class="map-preview">${empty(surface("map").message||"Connect property and map providers.")}</div>`;const opp=rows.filter((x)=>x.kind==="opportunity").length;return `<div class="map-preview"><div><strong>Property intelligence</strong><div class="small muted">${rows.length} mapped items · ${opp} opportunities</div></div></div>`},
    focus(){const rows=items("map"), opp=rows.filter((x)=>x.kind==="opportunity").length, appts=rows.filter((x)=>x.kind==="appointment").length;return `<div class="map-preview" style="min-height:430px"><div><h2 style="margin:0 0 8px">Interactive property map</h2><p class="muted">Normalized location records are ready for the map renderer and MLS/property adapters.</p><div class="metric-row"><div class="metric"><span class="small muted">Mapped</span><b>${rows.length}</b></div><div class="metric"><span class="small muted">Opportunities</span><b>${opp}</b></div><div class="metric"><span class="small muted">Appointments</span><b>${appts}</b></div></div>${rows.length?`<div style="height:12px"></div><div class="small">${rows.slice(0,4).map((x)=>escapeHtml(x.label)).join(" · ")}</div>`:""}</div></div>`}
  }
};

function renderWorkspace(focus=loadFocus()){
  if(!workspace)return;
  const selected=validFocus(focus), slots=panelSlots(selected);
  workspace.innerHTML=PANEL_ORDER.map((id)=>{
    const template=TEMPLATES[id], isFocused=id===selected, slot=isFocused?"focus":slots.get(id);
    return `<section class="workspace-panel ${isFocused?"focused":""}" data-panel="${id}" data-slot="${slot}"><header class="panel-head"><div><div class="panel-title">${template.title}</div><div class="panel-sub">${template.sub}</div></div><button class="focus-btn" data-focus="${id}" aria-label="Focus ${template.title}">${isFocused?"Focused":"Expand"}</button></header><div class="panel-body">${isFocused?template.focus():template.compact()}</div><div class="footer-note">${isFocused?`Primary workspace · ${statusNote(id)}`:`Live preview · ${statusNote(id)}`}</div></section>`;
  }).join("");
  document.querySelectorAll("[data-focus]").forEach((button)=>button.addEventListener("click",()=>{const next=button.dataset.focus;if(!next||next===selected)return;saveFocus(next);renderWorkspace(next)}));
}

function updateTodayStrip(){const s=workspaceModel?.summary||{};document.getElementById("todayApprovals").textContent=`Approvals ${s.pendingApprovals??0}`;document.getElementById("todayActions").textContent=`Agent actions ${s.agentActionsToday??0}`;document.getElementById("todaySchedule").textContent=`Scheduled ${s.scheduledItems??0}`}

async function loadWorkspaceModel(){
  const params=new URLSearchParams(location.search), orgId=params.get("org")||"org-test", date=new Date().toISOString().slice(0,10);
  renderWorkspace(loadFocus());
  try{
    const response=await fetch(`/v1/orgs/${encodeURIComponent(orgId)}/workspace?date=${encodeURIComponent(date)}`);
    if(!response.ok)throw new Error("workspace API unavailable");
    const payload=await response.json();
    workspaceModel=payload?.data?.result??payload?.data??payload;
    updateTodayStrip();
    const stored=loadFocus();
    renderWorkspace(stored||workspaceModel?.focusRecommendation||DEFAULT_FOCUS);
  }catch{
    updateTodayStrip();
    renderWorkspace(loadFocus());
  }
}

loadWorkspaceModel();
