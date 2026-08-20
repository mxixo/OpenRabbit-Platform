"use strict";
(function(){
  if(window.__openRabbitActionCenterLoaded)return;
  window.__openRabbitActionCenterLoaded=true;
  const api=window.openRabbitDesktop;
  let actions=[];
  function ensure(){
    const panel=document.getElementById('orBrainPanel'); if(!panel||document.getElementById('orActionCenter'))return;
    const box=document.createElement('div'); box.id='orActionCenter'; box.style.cssText='border-bottom:1px solid #252e48;background:#0b1222;padding:9px 11px;display:none';
    box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><b style="font-size:11px">Ready for you</b><div id="orActionMeta" style="font-size:9px;color:#8f9bb0;margin-top:2px">OpenRabbit will only interrupt when approval matters</div></div><button id="orActionRefresh" type="button" style="border:1px solid #34405c;background:#10182a;color:#dbe2ee;border-radius:8px;padding:5px 8px;font-size:9px;cursor:pointer">Refresh</button></div><div id="orActionItems" style="display:grid;gap:6px;margin-top:7px"></div>';
    const proactive=document.getElementById('orProactiveStrip'); if(proactive)proactive.after(box); else panel.querySelector('.orBrainHint')?.after(box);
    document.getElementById('orActionRefresh')?.addEventListener('click',load);
  }
  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function render(){
    ensure(); const center=document.getElementById('orActionCenter'),items=document.getElementById('orActionItems'),meta=document.getElementById('orActionMeta'); if(!center||!items)return;
    const pending=actions.filter(a=>['proposed','approved','executing','failed'].includes(a.status)); center.style.display=pending.length?'block':'none'; items.innerHTML='';
    if(meta)meta.textContent=pending.length?`${pending.length} action${pending.length===1?'':'s'} moving forward`:'Nothing needs your attention';
    pending.slice(0,5).forEach(a=>{
      const row=document.createElement('div'); row.style.cssText='border:1px solid #2f3a58;background:#10182a;border-radius:9px;padding:8px;color:#fff';
      const controls=a.status==='proposed'?`<div style="display:flex;gap:5px;margin-top:7px"><button data-approve="${a.id}" style="border:1px solid #6d4bc2;background:#5530a5;color:#fff;border-radius:7px;padding:5px 8px;font-size:9px;font-weight:800;cursor:pointer">Approve</button><button data-reject="${a.id}" style="border:1px solid #3b465f;background:#151c2c;color:#cbd5e1;border-radius:7px;padding:5px 8px;font-size:9px;cursor:pointer">Dismiss</button></div>`:'';
      row.innerHTML=`<div style="display:flex;justify-content:space-between;gap:7px"><b style="font-size:10px">${esc(a.title)}</b><span style="font-size:8px;color:${a.status==='failed'?'#fda4af':a.status==='executing'?'#93c5fd':a.status==='approved'?'#fde68a':'#c4b5fd'}">${esc(a.status.toUpperCase())}</span></div><div style="font-size:9px;color:#9da8bc;line-height:1.35;margin-top:3px">${esc(a.reason)}</div>${controls}`;
      items.appendChild(row);
    });
    items.querySelectorAll('[data-approve]').forEach(b=>b.addEventListener('click',()=>approve(b.dataset.approve,b)));
    items.querySelectorAll('[data-reject]').forEach(b=>b.addEventListener('click',()=>reject(b.dataset.reject,b)));
    const orb=document.getElementById('orBrainOrb'); if(orb){const n=actions.filter(a=>a.status==='proposed').length; orb.dataset.approvalCount=String(n); if(n)orb.title=`${n} OpenRabbit approval${n===1?'':'s'} ready`;}
  }
  async function approve(id,button){button.disabled=true; try{await api?.approveAction?.(id); await load();}catch(e){button.disabled=false; alert(e?.message||'Could not approve action.');}}
  async function reject(id,button){button.disabled=true; try{await api?.rejectAction?.(id); await load();}catch(e){button.disabled=false;}}
  async function load(){try{actions=await api?.listActions?.()||[];render();}catch{actions=[];render();}}
  window.OpenRabbitActions={
    enqueue:async action=>{const result=await api?.enqueueAction?.(action);await load();return result;},
    refresh:load
  };
  function boot(){ensure();load();setInterval(load,15000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,900));else setTimeout(boot,900);
})();
