"use strict";
(function(){
  if(window.__openRabbitAiOrbLoaded)return;
  window.__openRabbitAiOrbLoaded=true;
  const api=window.openRabbitDesktop;
  const state={messages:[],open:false,dragging:false,moved:false,provider:null};

  function styles(){
    if(document.getElementById('orBrainStyles'))return;
    const s=document.createElement('style');s.id='orBrainStyles';s.textContent=`
      #orBrainOrb{position:fixed;right:22px;bottom:22px;z-index:9996;width:64px;height:64px;border-radius:50%;border:1px solid rgba(173,130,255,.75);background:radial-gradient(circle at 34% 28%,#c4b5fd 0,#7c3aed 32%,#312e81 78%);box-shadow:0 16px 38px rgba(16,8,45,.5),0 0 0 5px rgba(124,58,237,.1);display:grid;place-items:center;color:white;font-size:29px;cursor:grab;user-select:none;touch-action:none}
      #orBrainOrb:active{cursor:grabbing}#orBrainOrb::after{content:'';position:absolute;inset:-7px;border:1px solid rgba(167,139,250,.22);border-radius:50%;animation:orPulse 2.5s infinite}@keyframes orPulse{0%,100%{transform:scale(.92);opacity:.3}50%{transform:scale(1.08);opacity:.75}}
      #orBrainPanel{position:fixed;right:22px;bottom:98px;z-index:9995;width:min(390px,calc(100vw - 28px));height:min(560px,72vh);display:none;grid-template-rows:auto auto 1fr auto;background:linear-gradient(180deg,#0d1323,#090d18);border:1px solid #3f3a68;border-radius:18px;overflow:hidden;box-shadow:0 28px 80px rgba(0,0,0,.55);color:#f8f7ff}
      #orBrainPanel.open{display:grid}.orBrainHead{display:flex;align-items:center;justify-content:space-between;padding:13px 14px;border-bottom:1px solid #2a3150;background:#0b1020}.orBrainTitle{display:flex;gap:10px;align-items:center}.orBrainTitle b{display:block}.orBrainTitle small{display:block;color:#a9b1c5;margin-top:2px}.orBrainMark{width:38px;height:38px;border-radius:12px;background:linear-gradient(145deg,#6d28d9,#a855f7);display:grid;place-items:center;font-size:21px}.orBrainClose{border:1px solid #394366;background:#11182a;color:#fff;width:34px;height:34px;border-radius:9px;cursor:pointer}.orBrainHint{padding:10px 13px;background:#11162a;border-bottom:1px solid #252e48;color:#c3c8d7;font-size:11px;line-height:1.45}.orBrainMsgs{padding:12px;overflow:auto;display:flex;flex-direction:column;gap:9px}.orBrainMsg{max-width:84%;padding:10px 11px;border-radius:12px;font-size:12px;line-height:1.45;white-space:pre-wrap}.orBrainMsg.user{align-self:flex-end;background:#5530a5}.orBrainMsg.ai{align-self:flex-start;background:#131d32;border:1px solid #293756}.orBrainMsg.error{border-color:#713246;color:#ffc0cb}.orBrainEmpty{margin:auto;text-align:center;color:#9ea8bb;max-width:270px;font-size:12px;line-height:1.5}.orBrainEmpty strong{display:block;color:#fff;font-size:17px;margin-bottom:7px}.orBrainCompose{border-top:1px solid #2a3150;padding:10px;background:#0b1020}.orBrainRow{display:grid;grid-template-columns:1fr auto;gap:7px}.orBrainInput{min-width:0;min-height:48px;max-height:100px;resize:vertical;border:1px solid #394366;border-radius:10px;background:#090e1b;color:#fff;padding:10px}.orBrainSend{border:1px solid #724bc2;background:linear-gradient(135deg,#52258e,#7c3aed);color:#fff;border-radius:10px;padding:0 14px;font-weight:800;cursor:pointer}.orBrainStatus{font-size:10px;color:#8f9bb0;margin-top:7px}.orBrainStatus.ok{color:#86efc5}.orBrainStatus.warn{color:#facc7b}.orBrainConnect{width:100%;margin-top:8px;border:1px solid #724bc2;background:#241743;color:#fff;border-radius:8px;padding:8px;font-weight:800;cursor:pointer}.orBrainQuick{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.orBrainQuick button{border:1px solid #34405c;background:#10182a;color:#dbe2ee;border-radius:999px;padding:5px 8px;font-size:10px;cursor:pointer}
      @media(max-width:560px){#orBrainOrb{right:14px;bottom:14px}#orBrainPanel{right:14px;bottom:88px;height:68vh}}
    `;document.head.appendChild(s);
  }

  function build(){
    if(document.getElementById('orBrainOrb'))return;
    styles();
    const orb=document.createElement('button');orb.id='orBrainOrb';orb.type='button';orb.setAttribute('aria-label','Open OpenRabbit AI');orb.textContent='🐇';
    const panel=document.createElement('section');panel.id='orBrainPanel';panel.setAttribute('aria-label','OpenRabbit AI');panel.innerHTML=`
      <div class="orBrainHead"><div class="orBrainTitle"><div class="orBrainMark">🐇</div><div><b>OpenRabbit</b><small id="orBrainProvider">AI brain</small></div></div><button class="orBrainClose" type="button" aria-label="Close">×</button></div>
      <div class="orBrainHint">Tell OpenRabbit what you want done. It should decide the workflow, use connected tools, and ask for approval only when an action needs it.<div class="orBrainQuick"><button type="button" data-or-prompt="Review my inbox and tell me what needs attention.">Review inbox</button><button type="button" data-or-prompt="Plan my day from my calendar and priorities.">Plan my day</button><button type="button" data-or-prompt="Review my CRM pipeline and tell me who needs follow-up.">Review pipeline</button></div></div>
      <div class="orBrainMsgs" id="orBrainMsgs"><div class="orBrainEmpty" id="orBrainEmpty"><strong>What do you want to accomplish?</strong>No workflow builder required. Describe the outcome and OpenRabbit handles the steps.</div></div>
      <div class="orBrainCompose"><div class="orBrainRow"><textarea class="orBrainInput" id="orBrainInput" placeholder="Ask OpenRabbit…"></textarea><button class="orBrainSend" id="orBrainSend" type="button">Send</button></div><div class="orBrainStatus" id="orBrainStatus">Checking your AI connection…</div><button class="orBrainConnect" id="orBrainConnect" type="button" hidden>Connect your AI</button></div>`;
    document.body.appendChild(panel);document.body.appendChild(orb);
    panel.querySelector('.orBrainClose').addEventListener('click',()=>toggle(false));
    panel.querySelectorAll('[data-or-prompt]').forEach(b=>b.addEventListener('click',()=>{toggle(true);const i=document.getElementById('orBrainInput');i.value=b.dataset.orPrompt||'';i.focus();}));
    document.getElementById('orBrainSend').addEventListener('click',send);
    document.getElementById('orBrainInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
    document.getElementById('orBrainConnect').addEventListener('click',connectAi);
    makeDraggable(orb);refreshProvider();
    document.querySelectorAll('[data-ai-prompt]').forEach(el=>el.addEventListener('click',()=>{toggle(true);const i=document.getElementById('orBrainInput');i.value=el.dataset.aiPrompt||el.textContent.trim();i.focus();}));
  }

  function setStatus(text,type=''){const e=document.getElementById('orBrainStatus');if(e){e.textContent=text;e.className='orBrainStatus '+type;}}
  function msg(role,text,extra=''){const box=document.getElementById('orBrainMsgs');document.getElementById('orBrainEmpty')?.remove();const e=document.createElement('div');e.className=`orBrainMsg ${role} ${extra}`;e.textContent=text;box.appendChild(e);box.scrollTop=box.scrollHeight;return e;}
  async function refreshProvider(){
    const connect=document.getElementById('orBrainConnect'),label=document.getElementById('orBrainProvider');
    try{const p=await api?.getAgentProviderStatus?.();state.provider=p;if(p?.connected){label.textContent=p.label||'AI connected';connect.hidden=true;setStatus((p.label||'AI')+' · ready','ok');}else{label.textContent='Choose your AI';connect.hidden=false;setStatus('Ready to connect your AI','warn');}}catch{label.textContent='Choose your AI';connect.hidden=false;setStatus('Ready to connect your AI','warn');}
  }
  async function connectAi(){
    const existing=[...document.querySelectorAll('[data-connect="openai"],button,a')].find(e=>/connect.*ai|talk to openrabbit|connect \/ talk/i.test(e.textContent||''));
    if(existing){existing.click();return;}
    if(api?.connectChatGPT){setStatus('Opening AI sign-in…');try{await api.connectChatGPT();await refreshProvider();}catch(e){setStatus(e?.message||'AI sign-in did not complete.','warn');}}
  }
  async function send(){
    const input=document.getElementById('orBrainInput'),button=document.getElementById('orBrainSend');const text=(input.value||'').trim();if(!text)return;
    if(!state.provider?.connected){await refreshProvider();if(!state.provider?.connected){setStatus('Connect an AI provider first.','warn');document.getElementById('orBrainConnect').hidden=false;return;}}
    state.messages.push({role:'user',content:text});msg('user',text);input.value='';button.disabled=true;setStatus('OpenRabbit is thinking…');const pending=msg('ai','Thinking…');
    try{const r=await api.agentChat(state.messages);pending.remove();const answer=r?.text||'No response received.';state.messages.push({role:'assistant',content:answer});msg('ai',answer);setStatus((r?.model||'AI')+' · ready','ok');}catch(e){pending.remove();msg('ai',e?.message||String(e),'error');setStatus('Request failed','warn');}finally{button.disabled=false;input.focus();}
  }
  function toggle(force){const p=document.getElementById('orBrainPanel');state.open=typeof force==='boolean'?force:!p.classList.contains('open');p.classList.toggle('open',state.open);if(state.open){refreshProvider();setTimeout(()=>document.getElementById('orBrainInput')?.focus(),30);}}
  function makeDraggable(orb){let sx=0,sy=0,ox=0,oy=0;orb.addEventListener('pointerdown',e=>{state.dragging=true;state.moved=false;sx=e.clientX;sy=e.clientY;const r=orb.getBoundingClientRect();ox=r.left;oy=r.top;orb.setPointerCapture(e.pointerId);});orb.addEventListener('pointermove',e=>{if(!state.dragging)return;const dx=e.clientX-sx,dy=e.clientY-sy;if(Math.abs(dx)+Math.abs(dy)>5)state.moved=true;const x=Math.max(6,Math.min(window.innerWidth-orb.offsetWidth-6,ox+dx));const y=Math.max(6,Math.min(window.innerHeight-orb.offsetHeight-6,oy+dy));orb.style.left=x+'px';orb.style.top=y+'px';orb.style.right='auto';orb.style.bottom='auto';});orb.addEventListener('pointerup',()=>{state.dragging=false;if(!state.moved)toggle();});}

  build();
})();
