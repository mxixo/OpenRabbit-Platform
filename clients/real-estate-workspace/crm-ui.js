"use strict";

const crmParams = new URLSearchParams(location.search);
const crmOrgId = crmParams.get("org") || "org-test";

function crmEscape(value){return String(value??"").replace(/[&<>'"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}

async function crmRequest(path, options={}){
  const response = await fetch(path, {
    ...options,
    headers:{"content-type":"application/json", ...(options.headers||{})}
  });
  const payload = await response.json().catch(()=>({}));
  if(!response.ok){
    const message = payload?.error?.message || payload?.message || `CRM request failed (${response.status})`;
    throw new Error(message);
  }
  return payload?.data?.result ?? payload?.data ?? payload;
}

function installCrmStyles(){
  if(document.getElementById("openrabbitCrmStyles")) return;
  const style=document.createElement("style");
  style.id="openrabbitCrmStyles";
  style.textContent=`
    .crm-tools{display:grid;gap:10px;margin-bottom:12px}.crm-form{display:grid;grid-template-columns:1.5fr 1fr 1fr auto;gap:8px;padding:12px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc}.crm-form input,.crm-form select,.crm-row-edit input,.crm-row-edit select{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px;background:white;color:#0f172a}.crm-form button,.crm-row-edit button{border:0;border-radius:8px;padding:8px 10px;font-weight:800;cursor:pointer;background:#0f172a;color:white}.crm-help{font-size:11px;color:#64748b}.crm-row-edit{display:grid;grid-template-columns:1fr 1fr 1.2fr auto;gap:7px;margin-top:8px}.crm-notice{font-size:12px;padding:8px 10px;border-radius:8px;background:#e0f2fe;color:#075985}.crm-error{background:#fee2e2;color:#991b1b}@media(max-width:760px){.crm-form,.crm-row-edit{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function crmFocusedPanel(){
  return document.querySelector('.workspace-panel.focused[data-panel="crm"] .panel-body');
}

function crmRelationshipItems(){
  const rows = window.__openrabbitWorkspaceModel?.surfaces?.crm?.data?.items;
  return Array.isArray(rows) ? rows : [];
}

function addNativeControls(panel){
  if(panel.querySelector("[data-native-crm-controls]")) return;
  const tools=document.createElement("div");
  tools.className="crm-tools";
  tools.dataset.nativeCrmControls="true";
  tools.innerHTML=`
    <form class="crm-form" id="crmCreateForm">
      <input name="displayName" placeholder="Name or company" required />
      <select name="kind"><option value="lead">Lead</option><option value="client">Client</option><option value="investor">Investor</option><option value="partner">Partner</option><option value="vendor">Vendor</option></select>
      <select name="priority"><option value="medium">Medium priority</option><option value="high">High priority</option><option value="low">Low priority</option></select>
      <button type="submit">Add relationship</button>
    </form>
    <div class="crm-help">Native CRM is active. Connected CRM imports use the same normalized relationship model; provider OAuth/adapters come next.</div>
    <div id="crmNotice" hidden></div>`;
  panel.prepend(tools);

  tools.querySelector("#crmCreateForm")?.addEventListener("submit", async (event)=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const notice=tools.querySelector("#crmNotice");
    try{
      notice.hidden=false; notice.className="crm-notice"; notice.textContent="Adding relationship…";
      await crmRequest(`/v1/orgs/${encodeURIComponent(crmOrgId)}/crm/relationships`, {method:"POST", body:JSON.stringify({displayName:form.get("displayName"),kind:form.get("kind"),priority:form.get("priority"),stage:"new"})});
      notice.textContent="Relationship added. Refreshing workspace…";
      setTimeout(()=>location.reload(),250);
    }catch(error){notice.hidden=false;notice.className="crm-notice crm-error";notice.textContent=error instanceof Error?error.message:"CRM request failed"}
  });

  const modelRows=crmRelationshipItems();
  if(!modelRows.length) return;
  const cards=[...panel.querySelectorAll(".list .item")].slice(-modelRows.length);
  cards.forEach((card,index)=>{
    const rel=modelRows[index];
    if(!rel || card.querySelector("[data-crm-edit]")) return;
    const editor=document.createElement("div");
    editor.className="crm-row-edit";
    editor.dataset.crmEdit=rel.id;
    editor.innerHTML=`
      <input data-field="stage" value="${crmEscape(rel.stage||"")}" placeholder="Stage" />
      <select data-field="priority"><option value="low" ${rel.priority==="low"?"selected":""}>Low</option><option value="medium" ${!rel.priority||rel.priority==="medium"?"selected":""}>Medium</option><option value="high" ${rel.priority==="high"?"selected":""}>High</option></select>
      <input data-field="nextFollowUpAt" type="datetime-local" value="${rel.nextFollowUpAt?crmEscape(rel.nextFollowUpAt.slice(0,16)):""}" />
      <button type="button">Save</button>`;
    editor.querySelector("button")?.addEventListener("click", async ()=>{
      const button=editor.querySelector("button");
      const payload={stage:editor.querySelector('[data-field="stage"]').value,priority:editor.querySelector('[data-field="priority"]').value,nextFollowUpAt:editor.querySelector('[data-field="nextFollowUpAt"]').value||" "};
      try{
        button.disabled=true;button.textContent="Saving…";
        await crmRequest(`/v1/orgs/${encodeURIComponent(crmOrgId)}/crm/relationships/${encodeURIComponent(rel.id)}`, {method:"PATCH",body:JSON.stringify(payload)});
        button.textContent="Saved";
        setTimeout(()=>location.reload(),250);
      }catch(error){button.disabled=false;button.textContent="Retry";alert(error instanceof Error?error.message:"CRM update failed")}
    });
    card.appendChild(editor);
  });
}

function enhanceCrm(){installCrmStyles();const panel=crmFocusedPanel();if(panel)addNativeControls(panel)}

const crmObserver=new MutationObserver(()=>queueMicrotask(enhanceCrm));
const crmWorkspace=document.getElementById("adaptiveWorkspace");
if(crmWorkspace) crmObserver.observe(crmWorkspace,{childList:true,subtree:true});
window.addEventListener("load",enhanceCrm);
