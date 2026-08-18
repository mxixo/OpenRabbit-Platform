"use strict";

function socialModel(){return window.__openrabbitWorkspaceModel?.surfaces?.social}
function orgId(){return new URLSearchParams(location.search).get("org")||"org-test"}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}

async function request(path, options={}){
  const response=await fetch(path,{headers:{"content-type":"application/json",...(options.headers||{})},...options});
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(payload?.error?.message||payload?.message||"Social request failed");
  return payload?.data?.result??payload?.data??payload;
}

function controls(){
  const panel=document.querySelector('[data-panel="social"].focused .panel-body');
  if(!panel)return;
  const surface=socialModel();
  const mode=surface?.data?.autonomyMode||"draft_only";
  const wrapper=document.createElement("div");
  wrapper.className="social-controls";
  wrapper.innerHTML=`
    <div class="composer" style="margin-bottom:12px">
      <strong>Create social post</strong>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
        <select id="socialNetwork"><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="linkedin">LinkedIn</option><option value="tiktok">TikTok</option><option value="x">X</option></select>
        <input id="socialScheduledAt" type="datetime-local" />
      </div>
      <input id="socialTitle" placeholder="Post title / theme" style="width:100%;margin-top:8px" />
      <textarea id="socialBody" placeholder="Write or generate post content…" rows="4" style="width:100%;margin-top:8px"></textarea>
      <button id="socialCreate" class="focus-btn" style="margin-top:8px">Add to queue</button>
    </div>
    <div class="composer" style="margin-bottom:12px">
      <strong>Autonomy</strong>
      <p class="small muted">Changing autonomy is explicit. Repeated approvals never auto-enable publishing.</p>
      <select id="socialMode"><option value="draft_only">Draft only</option><option value="approval_required">Approval required</option><option value="trusted_autopilot">Trusted autopilot</option></select>
      <input id="socialMax" type="number" min="1" max="50" value="1" style="width:90px;margin-left:8px" />
      <span class="small muted">max posts/day</span>
      <button id="socialSavePolicy" class="focus-btn" style="margin-left:8px">Save policy</button>
    </div>`;
  panel.prepend(wrapper);
  document.getElementById("socialMode").value=mode;

  document.getElementById("socialCreate").addEventListener("click",async()=>{
    const network=document.getElementById("socialNetwork").value;
    const title=document.getElementById("socialTitle").value.trim();
    const body=document.getElementById("socialBody").value.trim();
    const local=document.getElementById("socialScheduledAt").value;
    if(!body)return;
    await request(`/v1/orgs/${encodeURIComponent(orgId())}/social/posts`,{method:"POST",body:JSON.stringify({network,title,body,scheduledAt:local?new Date(local).toISOString():undefined,status:local?"pending_approval":"draft",createdBy:"user"})});
    location.reload();
  });

  document.getElementById("socialSavePolicy").addEventListener("click",async()=>{
    const autonomyMode=document.getElementById("socialMode").value;
    const maxPostsPerDay=Number(document.getElementById("socialMax").value||1);
    await request(`/v1/orgs/${encodeURIComponent(orgId())}/social/policy`,{method:"PUT",body:JSON.stringify({autonomyMode,maxPostsPerDay})});
    location.reload();
  });

  panel.querySelectorAll("[data-social-approve]").forEach((button)=>button.addEventListener("click",async()=>{
    await request(`/v1/orgs/${encodeURIComponent(orgId())}/social/posts/${encodeURIComponent(button.dataset.socialApprove)}`,{method:"PATCH",body:JSON.stringify({status:"scheduled"})});
    location.reload();
  }));
}

function decorateQueue(){
  const panel=document.querySelector('[data-panel="social"].focused .panel-body');
  const rows=socialModel()?.data?.items||[];
  if(!panel||!rows.length)return;
  const pending=rows.filter((row)=>row.status==="pending_approval");
  if(!pending.length)return;
  const box=document.createElement("div");
  box.className="list";
  box.style.marginBottom="12px";
  box.innerHTML=pending.map((row)=>`<div class="item"><strong>${escapeHtml(row.title||row.network||"Social post")}</strong><span class="small muted">Pending approval${row.scheduledAt?` · ${escapeHtml(new Date(row.scheduledAt).toLocaleString())}`:""}</span><button class="focus-btn" data-social-approve="${escapeHtml(row.id)}" style="margin-top:7px">Approve scheduling</button></div>`).join("");
  panel.prepend(box);
}

function mount(){setTimeout(()=>{decorateQueue();controls()},0)}
window.addEventListener("openrabbit:workspace-rendered",(event)=>{if(event.detail?.focus==="social")mount()});
