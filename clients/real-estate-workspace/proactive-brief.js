"use strict";
(function(){
  if(window.__openRabbitProactiveBriefLoaded)return;
  window.__openRabbitProactiveBriefLoaded=true;
  const api=window.openRabbitDesktop;
  const state={lastHash:'',lastGeneratedAt:0,proposals:[],snapshot:null,busy:false};

  const WAIT_MS=90*1000;
  const AI_MIN_INTERVAL=5*60*1000;

  function stable(value){
    if(value===null||value===undefined)return value;
    if(Array.isArray(value))return value.slice(0,8).map(stable);
    if(typeof value==='object')return Object.keys(value).sort().reduce((o,k)=>{if(!/token|secret|key|body|html/i.test(k))o[k]=stable(value[k]);return o;},{});
    if(typeof value==='string')return value.slice(0,500);
    return value;
  }
  function hash(value){
    const s=JSON.stringify(stable(value));let h=2166136261;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return String(h>>>0);
  }
  function count(v){if(Array.isArray(v))return v.length;if(Number.isFinite(Number(v)))return Number(v);return 0;}
  function compact(snapshot){
    const mail=snapshot?.mail||{};
    const calendar=snapshot?.calendar||{};
    const crm=snapshot?.crm||{};
    const social=snapshot?.social||{};
    const topMail=(mail.items||mail.messages||[]).slice(0,5).map(m=>({from:m.from||m.sender||'',subject:m.subject||m.title||'',received:m.receivedAt||m.date||m.internalDate||''}));
    const topEvents=(calendar.events||[]).slice(0,6).map(e=>({title:e.summary||e.title||'',start:e.start?.dateTime||e.start||'',end:e.end?.dateTime||e.end||''}));
    const topDeals=(crm.deals||[]).slice(0,6).map(d=>({name:d.name||d.dealname||'',stage:d.stage||d.dealstage||'',amount:d.amount||'',updated:d.updatedAt||d.hs_lastmodifieddate||''}));
    return {
      mail:{connected:Boolean(mail.connected),total:count(mail.total||mail.items||mail.messages),items:topMail},
      calendar:{connected:Boolean(calendar.connected),events:topEvents},
      crm:{connected:Boolean(crm.connected),contacts:count(crm.contacts),deals:topDeals},
      social:{connected:Boolean(social.connected),accounts:(social.accounts||[]).slice(0,6).map(a=>({provider:a.provider||a.network||'',name:a.name||a.username||'',followers:a.followers||null}))},
      maps:Boolean(snapshot?.maps?.available||snapshot?.mapsAvailable),
      generatedAt:snapshot?.generatedAt||new Date().toISOString()
    };
  }
  function defaultProposals(summary){
    const p=[];
    if(summary.mail.connected&&summary.mail.total>0)p.push({priority:'high',title:'Review new inbox activity',reason:`${summary.mail.total} recent mail items are available.`,prompt:'Review my newest emails, identify anything time-sensitive, and propose the fastest next actions.'});
    if(summary.calendar.connected&&summary.calendar.events.length)p.push({priority:'medium',title:'Protect the next commitments',reason:`${summary.calendar.events.length} upcoming calendar items are visible.`,prompt:'Review my upcoming calendar, identify preparation or follow-up I should do now, and propose any schedule changes.'});
    if(summary.crm.connected&&summary.crm.deals.length)p.push({priority:'high',title:'Move active deals forward',reason:`${summary.crm.deals.length} active CRM deals are visible.`,prompt:'Review my CRM pipeline, identify stalled or high-value opportunities, and tell me exactly what should happen next.'});
    if(summary.social.connected)p.push({priority:'low',title:'Keep social activity moving',reason:'Social accounts are connected.',prompt:'Review my connected social presence and propose the most useful next post or follow-up based on my current business activity.'});
    return p.slice(0,5);
  }
  function extractJson(text){
    const raw=String(text||'').trim();
    const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]||raw;
    const start=fenced.indexOf('['),end=fenced.lastIndexOf(']');
    if(start<0||end<=start)return null;
    try{return JSON.parse(fenced.slice(start,end+1));}catch{return null;}
  }
  function sanitizeProposal(p){
    return {
      priority:['high','medium','low'].includes(String(p?.priority).toLowerCase())?String(p.priority).toLowerCase():'medium',
      title:String(p?.title||'Next best action').slice(0,90),
      reason:String(p?.reason||'OpenRabbit identified a useful next step.').slice(0,220),
      prompt:String(p?.prompt||p?.action||'Help me move this forward.').slice(0,500),
      approval:Boolean(p?.approvalRequired??p?.requiresApproval??true)
    };
  }
  function ensureUi(){
    const panel=document.getElementById('orBrainPanel');
    if(!panel||document.getElementById('orProactiveStrip'))return;
    const strip=document.createElement('div');strip.id='orProactiveStrip';strip.style.cssText='border-bottom:1px solid #252e48;background:#0d1425;padding:9px 11px;display:none';
    strip.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><div><b style="font-size:11px">OpenRabbit next moves</b><div id="orProactiveMeta" style="font-size:9px;color:#8f9bb0;margin-top:2px">Watching connected data</div></div><button id="orProactiveRefresh" type="button" style="border:1px solid #34405c;background:#10182a;color:#dbe2ee;border-radius:8px;padding:5px 8px;font-size:9px;cursor:pointer">Refresh</button></div><div id="orProactiveItems" style="display:grid;gap:6px;margin-top:7px"></div>';
    const hint=panel.querySelector('.orBrainHint');hint?.after(strip);
    document.getElementById('orProactiveRefresh')?.addEventListener('click',()=>scan(true));
  }
  function render(){
    ensureUi();const strip=document.getElementById('orProactiveStrip'),box=document.getElementById('orProactiveItems'),meta=document.getElementById('orProactiveMeta');if(!strip||!box)return;
    strip.style.display=state.proposals.length?'block':'none';box.innerHTML='';
    if(meta)meta.textContent=state.lastGeneratedAt?`Updated ${new Date(state.lastGeneratedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`:'Watching connected data';
    state.proposals.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.style.cssText='text-align:left;border:1px solid #2f3a58;background:#11192b;color:#fff;border-radius:9px;padding:8px;cursor:pointer';b.innerHTML=`<div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:10px">${escapeHtml(p.title)}</b><span style="font-size:8px;color:${p.priority==='high'?'#fda4af':p.priority==='medium'?'#fde68a':'#a7f3d0'}">${p.priority.toUpperCase()}</span></div><div style="font-size:9px;color:#9da8bc;line-height:1.35;margin-top:3px">${escapeHtml(p.reason)}</div>`;b.addEventListener('click',()=>primePrompt(p.prompt));box.appendChild(b);});
    const orb=document.getElementById('orBrainOrb');if(orb){orb.dataset.proactiveCount=String(state.proposals.length);orb.title=state.proposals.length?`${state.proposals.length} OpenRabbit next moves`:'Open OpenRabbit AI';}
  }
  function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function primePrompt(prompt){
    const orb=document.getElementById('orBrainOrb');const panel=document.getElementById('orBrainPanel');
    if(panel&&!panel.classList.contains('open'))orb?.click();
    setTimeout(()=>{const input=document.getElementById('orBrainInput');if(input){input.value=prompt;input.focus();}},60);
  }
  async function generateWithAi(summary){
    const status=await api?.getAgentProviderStatus?.();
    if(!status?.connected||!api?.agentChat)return null;
    const prompt=`You are the proactive OpenRabbit operating brain. Review the compact live business snapshot below and return ONLY a JSON array of up to 5 next-move objects. Each object must have: priority (high|medium|low), title, reason, prompt, approvalRequired. Connect signals across email, calendar, CRM and social when useful. Prefer actions that move revenue, deadlines, client communication or deal progress forward. Do not invent facts. Never claim an action was completed. approvalRequired must be true for sending external communications, calendar changes, CRM writes, social publishing, financial commitments, or destructive actions. Snapshot:\n${JSON.stringify(summary)}`;
    const result=await api.agentChat([{role:'user',content:prompt}]);
    const parsed=extractJson(result?.text);if(!Array.isArray(parsed))return null;return parsed.slice(0,5).map(sanitizeProposal);
  }
  async function scan(force=false){
    if(state.busy||!api?.getLiveSnapshot)return;state.busy=true;
    try{
      const snap=await api.getLiveSnapshot();state.snapshot=snap;const summary=compact(snap);const h=hash(summary);
      if(!force&&h===state.lastHash){render();return;}
      state.lastHash=h;
      let proposals=defaultProposals(summary);
      const now=Date.now();
      if(force||now-state.lastGeneratedAt>=AI_MIN_INTERVAL){
        try{const ai=await generateWithAi(summary);if(ai?.length)proposals=ai;}catch{}
        state.lastGeneratedAt=now;
      }
      state.proposals=proposals;render();
    }catch{
      state.proposals=[];render();
    }finally{state.busy=false;}
  }
  function boot(){ensureUi();scan(false);setInterval(()=>scan(false),WAIT_MS);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,1200));else setTimeout(boot,1200);
})();
