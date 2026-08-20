"use strict";
(function(){
  if(window.__openRabbitProviderUiLoaded)return;
  window.__openRabbitProviderUiLoaded=true;
  const api=window.openRabbitDesktop;
  if(!api?.listAiProviders)return;

  function addStyles(){
    if(document.getElementById('orProviderStyles'))return;
    const style=document.createElement('style');
    style.id='orProviderStyles';
    style.textContent=`
      .orProviderBar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#0c1222;border-bottom:1px solid #252e48}
      .orProviderBar label{font-size:10px;color:#8f9bb0;white-space:nowrap}
      .orProviderSelect{min-width:0;flex:1;border:1px solid #394366;border-radius:8px;background:#0a1020;color:#f5f3ff;padding:7px 9px;font-size:11px}
      .orProviderNote{font-size:9px;color:#8f9bb0;white-space:nowrap}
    `;
    document.head.appendChild(style);
  }

  async function sync(){
    const select=document.getElementById('orProviderSelect');
    const note=document.getElementById('orProviderNote');
    if(!select)return;
    try{
      const providers=await api.listAiProviders();
      select.innerHTML='';
      providers.forEach(provider=>{
        const option=document.createElement('option');
        option.value=provider.id;
        option.textContent=provider.available?provider.name:`${provider.name} · coming next`;
        option.selected=Boolean(provider.selected);
        select.appendChild(option);
      });
      const active=providers.find(p=>p.selected)||providers[0];
      note.textContent=active?.connected?'connected':(active?.available?'ready to connect':'adapter queued');
    }catch{
      note.textContent='provider status unavailable';
    }
  }

  async function change(event){
    const providerId=event.target.value;
    const note=document.getElementById('orProviderNote');
    try{
      const selected=await api.selectAiProvider(providerId);
      if(selected.available){
        note.textContent=selected.connected?'connected':'ready to connect';
      }else{
        note.textContent='adapter queued';
      }
      const providerLabel=document.getElementById('orBrainProvider');
      if(providerLabel)providerLabel.textContent=selected.name||'AI brain';
      if(selected.id==='openai-chatgpt'&&!selected.connected){
        const connect=document.getElementById('orBrainConnect');
        if(connect){connect.hidden=false;connect.textContent='Continue with ChatGPT';}
      }
      if(!selected.available){
        const status=document.getElementById('orBrainStatus');
        if(status){status.textContent=`${selected.name} is reserved in the OpenRabbit brain layer; its connection adapter is not active yet.`;status.className='orBrainStatus warn';}
      }
    }catch(error){
      note.textContent=error?.message||'could not change provider';
    }
  }

  function install(){
    const panel=document.getElementById('orBrainPanel');
    if(!panel||document.getElementById('orProviderSelect'))return false;
    addStyles();
    const head=panel.querySelector('.orBrainHead');
    if(!head)return false;
    const bar=document.createElement('div');
    bar.className='orProviderBar';
    bar.innerHTML='<label for="orProviderSelect">AI brain</label><select id="orProviderSelect" class="orProviderSelect" aria-label="Choose AI provider"></select><span id="orProviderNote" class="orProviderNote"></span>';
    head.insertAdjacentElement('afterend',bar);
    document.getElementById('orProviderSelect').addEventListener('change',change);
    sync();
    return true;
  }

  if(!install()){
    const observer=new MutationObserver(()=>{if(install())observer.disconnect();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
})();
