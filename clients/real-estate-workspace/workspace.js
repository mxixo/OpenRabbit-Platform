"use strict";

const STORAGE_KEY = "openrabbit.re.workspace.focus.v1";
const DEFAULT_FOCUS = "calendar";
const SLOT_ORDER = ["left", "right-top", "right-bottom", "bottom"];
const PANEL_ORDER = ["calendar", "email", "crm", "social", "map"];

const workspace = document.getElementById("adaptiveWorkspace");

const TEMPLATES = {
  calendar: {
    title: "Calendar",
    sub: "Your schedule + meaningful AI execution",
    compact: () => `
      <div class="list">
        <div class="item"><strong>10:30 AM · Planning meeting</strong><span class="small muted">You · City planning</span></div>
        <div class="item agent"><strong>11:16 AM · CRM updated</strong><span class="small muted">Transaction Worker</span></div>
        <div class="item"><strong>4:00 PM · Client meeting</strong><span class="small muted">You · Buyer follow-up</span></div>
      </div>`,
    focus: () => `
      <div class="metric-row">
        <div class="metric"><span class="small muted">Your events</span><b>4</b></div>
        <div class="metric"><span class="small muted">Agent actions</span><b>12</b></div>
        <div class="metric"><span class="small muted">Approvals</span><b>3</b></div>
      </div>
      <div style="height:12px"></div>
      <div class="calendar-grid">
        <div class="time">9:00</div><div><strong>Prospecting block</strong><div class="small muted">You</div></div>
        <div class="time">10:30</div><div><strong>Planning meeting</strong><div class="small muted">You</div></div>
        <div class="time">11:14</div><div class="agent"><strong>Signed document received</strong><div class="small muted">Transaction Worker</div></div>
        <div class="time">11:16</div><div class="agent"><strong>CRM record updated</strong><div class="small muted">Transaction Worker</div></div>
        <div class="time">1:08</div><div class="agent"><strong>Deal analysis completed</strong><div class="small muted">Underwriting Worker</div></div>
        <div class="time">1:12</div><div class="agent"><strong>Approval requested · investor outreach</strong><div class="small muted">OpenRabbit</div></div>
        <div class="time">4:00</div><div><strong>Client meeting</strong><div class="small muted">You</div></div>
      </div>`
  },
  email: {
    title: "Email",
    sub: "Professional communication + agent triage",
    compact: () => `
      <div class="list">
        <div class="item"><strong>Needs reply · 3</strong><span class="small muted">Prioritized by relationship + urgency</span></div>
        <div class="item"><strong>Document request · 1</strong><span class="small muted">Agent action pending approval</span></div>
        <div class="item"><strong>Scheduling intent · 2</strong><span class="small muted">Calendar suggestions ready</span></div>
      </div>`,
    focus: () => `
      <div class="metric-row"><div class="metric"><span class="small muted">Unread</span><b>18</b></div><div class="metric"><span class="small muted">Needs action</span><b>6</b></div><div class="metric"><span class="small muted">AI handled</span><b>9</b></div></div>
      <div style="height:12px"></div>
      <div class="list">
        <div class="item"><strong>Betty · requested planning form</strong><span class="small muted">OpenRabbit identified document request and linked it to the CRM record.</span></div>
        <div class="item"><strong>Investor inquiry · Phoenix multifamily</strong><span class="small muted">Property context found. Map and deal brief available.</span></div>
        <div class="item"><strong>Showing coordination</strong><span class="small muted">Detected Thursday 3 PM availability. Calendar invite ready for approval.</span></div>
      </div>`
  },
  crm: {
    title: "CRM",
    sub: "Relationships, leads, pipeline, follow-up intelligence",
    compact: () => `
      <div class="list">
        <div class="item"><strong>7 follow-ups due</strong><span class="small muted">3 high-priority relationships</span></div>
        <div class="item"><strong>2 new lead signals</strong><span class="small muted">Social + email</span></div>
      </div>`,
    focus: () => `
      <div class="metric-row"><div class="metric"><span class="small muted">Active leads</span><b>31</b></div><div class="metric"><span class="small muted">Follow-ups</span><b>7</b></div><div class="metric"><span class="small muted">New signals</span><b>2</b></div></div>
      <div style="height:12px"></div>
      <div class="list">
        <div class="item"><strong>Paris Robbins · Investor</strong><span class="small muted">Multifamily · under $2M · new property match available</span></div>
        <div class="item"><strong>Past client nurture queue</strong><span class="small muted">5 contacts without a meaningful touch in 90+ days</span></div>
        <div class="item"><strong>Lead response SLA</strong><span class="small muted">2 conversations should be answered today</span></div>
      </div>`
  },
  social: {
    title: "Social",
    sub: "Create, approve, schedule, publish, learn",
    compact: () => `
      <span class="mode">Approval required</span>
      <div style="height:9px"></div>
      <div class="list"><div class="item"><strong>12:00 PM · Buyer post</strong><span class="small muted">Pending approval</span></div><div class="item"><strong>Tomorrow · Market update</strong><span class="small muted">Draft scheduled</span></div></div>`,
    focus: () => `
      <div class="metric-row"><div class="metric"><span class="small muted">Connected</span><b>4</b></div><div class="metric"><span class="small muted">Pending</span><b>1</b></div><div class="metric"><span class="small muted">Scheduled</span><b>6</b></div></div>
      <div style="height:12px"></div>
      <div class="composer"><strong>Multi-network composer</strong><p class="muted small">One content idea, network-specific previews, reusable branding, approval policy, and publishing schedule.</p><div class="item"><strong>Today's proposed post</strong><span class="small muted">First-time buyer education · Phoenix · 12:00 PM</span></div></div>
      <div style="height:12px"></div>
      <div class="list"><div class="item"><strong>Autonomy</strong><span class="small muted">Draft only → Approval required → Trusted autopilot</span></div><div class="item"><strong>Lead signals</strong><span class="small muted">Engagement can feed normalized relationship signals back into CRM when provider permissions allow.</span></div></div>`
  },
  map: {
    title: "Map",
    sub: "Listings, clients, comps, opportunities, routes",
    compact: () => `<div class="map-preview"><div><strong>Phoenix property intelligence</strong><div class="small muted">2 opportunities · 3 showings · 6 saved areas</div></div></div>`,
    focus: () => `<div class="map-preview" style="min-height:430px"><div><h2 style="margin:0 0 8px">Interactive property map</h2><p class="muted">MLS/provider listings, CRM client matches, comps, imagery, appointments, and OpenRabbit deal intelligence converge here.</p><div class="metric-row"><div class="metric"><span class="small muted">Matches</span><b>14</b></div><div class="metric"><span class="small muted">Opportunities</span><b>2</b></div><div class="metric"><span class="small muted">Today</span><b>3</b></div></div></div></div>`
  }
};

function validFocus(value){return PANEL_ORDER.includes(value)?value:DEFAULT_FOCUS}
function loadFocus(){try{return validFocus(localStorage.getItem(STORAGE_KEY)||DEFAULT_FOCUS)}catch{return DEFAULT_FOCUS}}
function saveFocus(value){try{localStorage.setItem(STORAGE_KEY,value)}catch{}}

function panelSlots(focus){
  const remaining=PANEL_ORDER.filter((id)=>id!==focus);
  return new Map(remaining.map((id,index)=>[id,SLOT_ORDER[index]]));
}

function renderWorkspace(focus=loadFocus()){
  if(!workspace)return;
  const selected=validFocus(focus);
  const slots=panelSlots(selected);
  workspace.innerHTML=PANEL_ORDER.map((id)=>{
    const template=TEMPLATES[id];
    const isFocused=id===selected;
    const slot=isFocused?"focus":slots.get(id);
    return `<section class="workspace-panel ${isFocused?"focused":""}" data-panel="${id}" data-slot="${slot}">
      <header class="panel-head"><div><div class="panel-title">${template.title}</div><div class="panel-sub">${template.sub}</div></div><button class="focus-btn" data-focus="${id}" aria-label="Focus ${template.title}">${isFocused?"Focused":"Expand"}</button></header>
      <div class="panel-body">${isFocused?template.focus():template.compact()}</div>
      <div class="footer-note">${isFocused?"Primary workspace":"Live preview · click Expand"}</div>
    </section>`;
  }).join("");
  document.querySelectorAll("[data-focus]").forEach((button)=>button.addEventListener("click",()=>{
    const next=button.dataset.focus;
    if(!next||next===selected)return;
    saveFocus(next);
    renderWorkspace(next);
  }));
}

async function loadTodayStrip(){
  const orgId=new URLSearchParams(location.search).get("org")||"org-test";
  const date=new Date().toISOString().slice(0,10);
  try{
    const response=await fetch(`/v1/orgs/${encodeURIComponent(orgId)}/today?date=${encodeURIComponent(date)}`);
    if(!response.ok)return;
    const payload=await response.json();
    const today=payload?.data?.result??payload?.data??payload;
    const summary=today?.summary||{};
    document.getElementById("todayApprovals").textContent=`Approvals ${summary.pendingApprovals??0}`;
    document.getElementById("todayActions").textContent=`Agent actions ${summary.agentActionsToday??0}`;
    document.getElementById("todaySchedule").textContent=`Scheduled ${summary.scheduledItems??0}`;
  }catch{}
}

renderWorkspace();
loadTodayStrip();
