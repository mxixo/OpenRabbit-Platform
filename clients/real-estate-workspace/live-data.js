"use strict";
(function(){
  if (window.__openRabbitLiveDataBound) return;
  window.__openRabbitLiveDataBound = true;
  const api = window.openRabbitDesktop;
  if (!api?.getLiveSnapshot) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); };
  const css = document.createElement('style');
  css.textContent = `.or-live{position:absolute;inset:48px 10px 10px;z-index:12;background:linear-gradient(180deg,rgba(10,15,29,.985),rgba(8,12,23,.985));border:1px solid #34405d;border-radius:12px;padding:12px;overflow:auto;color:#f7f8fc}.or-live h3{margin:0 0 4px;font-size:13px}.or-live .sub{font-size:10px;color:#9ea9bd;margin-bottom:10px}.or-live-list{display:grid;gap:7px}.or-live-row{border:1px solid #29354d;border-radius:8px;background:#101829;padding:8px 9px}.or-live-row b{display:block;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.or-live-row span{display:block;color:#aab4c7;font-size:9px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.or-live-row p{margin:5px 0 0;color:#cbd3df;font-size:9px;line-height:1.3}.or-live-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.or-live-metric{border:1px solid #2c3851;border-radius:8px;padding:8px;background:#111a2d}.or-live-metric strong{display:block;font-size:18px}.or-live-metric small{color:#9eabc0;font-size:9px}.or-social-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.or-social-actions button{border:1px solid #6b4eb3;background:#39226e;color:#fff;border-radius:7px;padding:7px 9px;font-size:10px;font-weight:700;cursor:pointer}.or-live-badge{display:inline-flex;align-items:center;gap:4px;color:#84edca;font-size:9px;font-weight:800}.or-live-dot{width:6px;height:6px;border-radius:99px;background:#34d399}.or-live-error{color:#fda4af;font-size:9px;margin-top:6px}`;
  document.head.appendChild(css);

  function panelByText(words){
    const nodes=[...document.querySelectorAll('.panel,.card,article')];
    return nodes.find(n=>words.some(w=>String(n.querySelector('.panel-title,.title,h2,h3')?.textContent||'').toLowerCase().includes(w))) || null;
  }
  function clearReady(panel){
    if(!panel)return;
    panel.querySelectorAll('.overlay,[data-openrabbit-crm-overlay],[data-openrabbit-agent-overlay]').forEach(x=>x.style.display='none');
  }
  function liveHost(panel,key){
    if(!panel)return null;
    panel.style.position='relative';
    let host=panel.querySelector(`[data-openrabbit-live="${key}"]`);
    if(!host){host=document.createElement('div');host.className='or-live';host.dataset.openrabbitLive=key;panel.appendChild(host);}
    clearReady(panel); return host;
  }
  function removeLive(panel,key){const h=panel?.querySelector(`[data-openrabbit-live="${key}"]`);if(h)h.remove();panel?.querySelectorAll('.overlay,[data-openrabbit-crm-overlay]').forEach(x=>x.style.display='');}
  function setPill(panel,text,live){const p=panel?.querySelector('.status,.pill,.ready');if(!p)return;p.textContent=text;if(live){p.classList.add('live');p.classList.remove('warn');}}

  function renderMail(data){const p=panelByText(['email','inbox']);if(!p)return;if(!data?.connected){removeLive(p,'mail');return;}const h=liveHost(p,'mail');setPill(p,'Live',true);const unread=(data.items||[]).filter(x=>x.unread).length;h.innerHTML=`<h3><span class="or-live-badge"><span class="or-live-dot"></span>Live Gmail</span></h3><div class="sub">${unread} unread in the latest ${data.items?.length||0} messages · refreshes automatically</div><div class="or-live-list">${(data.items||[]).slice(0,8).map(m=>`<div class="or-live-row"><b>${m.unread?'● ':''}${esc(m.subject)}</b><span>${esc(m.from)} · ${esc(fmt(m.date))}</span><p>${esc(m.snippet)}</p></div>`).join('')||'<div class="sub">No recent messages.</div>'}</div>`;}
  function renderCalendar(data){const p=panelByText(['calendar','agenda']);if(!p)return;if(!data?.connected){removeLive(p,'calendar');return;}const h=liveHost(p,'calendar');setPill(p,'Live',true);h.innerHTML=`<h3><span class="or-live-badge"><span class="or-live-dot"></span>Live Calendar</span></h3><div class="sub">Upcoming events · ${esc(data.timeZone||'your calendar timezone')}</div><div class="or-live-list">${(data.events||[]).slice(0,9).map(e=>`<div class="or-live-row"><b>${esc(e.title)}</b><span>${esc(fmt(e.start))}${e.location?' · '+esc(e.location):''}</span></div>`).join('')||'<div class="sub">No upcoming events.</div>'}</div>`;}
  function renderCrm(data){const p=panelByText(['crm','pipeline']);if(!p)return;if(!data?.connected){removeLive(p,'crm');return;}const h=liveHost(p,'crm');setPill(p,'Live',true);const amount=(data.deals||[]).reduce((s,d)=>s+(Number(d.amount)||0),0);h.innerHTML=`<h3><span class="or-live-badge"><span class="or-live-dot"></span>Live HubSpot</span></h3><div class="or-live-grid"><div class="or-live-metric"><strong>${data.contacts?.length||0}</strong><small>Recent contacts</small></div><div class="or-live-metric"><strong>${data.deals?.length||0}</strong><small>Active/recent deals</small></div><div class="or-live-metric"><strong>$${Math.round(amount).toLocaleString()}</strong><small>Deal value loaded</small></div><div class="or-live-metric"><strong>${new Set((data.deals||[]).map(d=>d.dealstage).filter(Boolean)).size}</strong><small>Pipeline stages</small></div></div><div class="or-live-list" style="margin-top:8px">${(data.deals||[]).slice(0,6).map(d=>`<div class="or-live-row"><b>${esc(d.dealname||'Deal')}</b><span>${esc(d.dealstage||'No stage')}${d.amount?' · $'+Number(d.amount).toLocaleString():''}</span></div>`).join('')}</div>`;}
  function socialConnected(s){return Boolean(s?.meta?.connected||s?.linkedin?.connected||s?.tiktok?.connected);}
  function renderSocial(s){const p=panelByText(['social']);if(!p)return;if(!socialConnected(s)){removeLive(p,'social');return;}const h=liveHost(p,'social');setPill(p,'Live',true);const ig=s.meta?.instagram?.[0];const pageCount=s.meta?.pages?.length||0;const mediaCount=(s.meta?.instagram||[]).reduce((n,a)=>n+(a.media?.length||0),0);const videoCount=s.tiktok?.videos?.length||0;h.innerHTML=`<h3><span class="or-live-badge"><span class="or-live-dot"></span>Live Social</span></h3><div class="or-live-grid"><div class="or-live-metric"><strong>${pageCount}</strong><small>Facebook Pages</small></div><div class="or-live-metric"><strong>${mediaCount}</strong><small>Instagram posts loaded</small></div><div class="or-live-metric"><strong>${s.linkedin?.connected?'✓':'—'}</strong><small>LinkedIn</small></div><div class="or-live-metric"><strong>${videoCount}</strong><small>TikTok videos loaded</small></div></div>${ig?`<div class="or-live-row" style="margin-top:8px"><b>@${esc(ig.username)}</b><span>${ig.media?.length||0} recent Instagram media items</span></div>`:''}`;}

  function enhanceSocialConnect(){
    const p=panelByText(['social']);if(!p||p.querySelector('[data-openrabbit-social-actions]'))return;
    const box=document.createElement('div');box.dataset.openrabbitSocialActions='true';box.className='or-social-actions';box.innerHTML='<button data-p="meta">Instagram / Facebook</button><button data-p="linkedin">LinkedIn</button><button data-p="tiktok">TikTok</button>';
    const target=p.querySelector('.overlay,.body')||p;target.appendChild(box);
    box.addEventListener('click',async e=>{const b=e.target.closest('button[data-p]');if(!b)return;b.disabled=true;const old=b.textContent;b.textContent='Opening sign-in…';try{await api.connectSocial(b.dataset.p);await refresh();}catch(err){b.textContent=err?.message||'Not available yet';setTimeout(()=>{b.textContent=old;b.disabled=false},3500);return;}b.textContent='Connected';});
  }

  async function refresh(){
    try{
      const snapshot=await api.getLiveSnapshot();
      renderMail(snapshot.mail);renderCalendar(snapshot.calendar);renderCrm(snapshot.crm);renderSocial(snapshot.social);enhanceSocialConnect();
      window.__openRabbitLastLiveSnapshot=snapshot;
    }catch(error){console.debug('OpenRabbit live refresh:',error?.message||error);enhanceSocialConnect();}
  }
  refresh();
  setInterval(refresh,30000);
})();
