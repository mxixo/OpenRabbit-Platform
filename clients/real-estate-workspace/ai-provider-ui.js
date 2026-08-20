"use strict";
(function(){
  if(window.__openRabbitProviderUiLoaded)return;
  window.__openRabbitProviderUiLoaded=true;
  const api=window.openRabbitDesktop;
  if(!api?.listAiProviders)return;
  let activeProvider=null;

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

  function setStatus(text,type='warn'){
    const status=document.getElementById('orBrainStatus');
    if(status){status.textContent=text;status.className=`orBrainStatus ${type}`;}
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
      activeProvider=providers.find(p=>p.selected)||providers[0]||null;
      note.textContent=activeProvider?.connected?'connected':(activeProvider?.available?'ready to connect':'adapter queued');
      const providerLabel=document.getElementById('orBrainProvider');
      if(providerLabel&&activeProvider)providerLabel.textContent=activeProvider.name;
    }catch{
      activeProvider=null;
      note.textContent='provider status unavailable';
    }
  }

  async function change(event){
    const providerId=event.target.value;
    const note=document.getElementById('orProviderNote');
    try{
      activeProvider=await api.selectAiProvider(providerId);
      if(activeProvider.available){
        note.textContent=activeProvider.connected?'connected':'ready to connect';
      }else{
        note.textContent='adapter queued';
      }
      const providerLabel=document.getElementById('orBrainProvider');
      if(providerLabel)providerLabel.textContent=activeProvider.name||'AI brain';
      if(activeProvider.id==='openai-chatgpt'&&!activeProvider.connected){
        const connect=document.getElementById('orBrainConnect');
        if(connect){connect.hidden=false;connect.textContent='Continue with ChatGPT';}
      }
      if(!activeProvider.available){
        setStatus(`${activeProvider.name} is reserved in the OpenRabbit brain layer; its connection adapter is not active yet.`);
      }
    }catch(error){
      note.textContent=error?.message||'could not change provider';
    }
  }

  function blockUnsupported(event){
    if(!activeProvider||activeProvider.available)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setStatus(`${activeProvider.name} is selected, but its OpenRabbit adapter is not active yet. Choose ChatGPT to continue now.`);
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
    document.getElementById('orBrainSend')?.addEventListener('click',blockUnsupported,true);
    document.getElementById('orBrainInput')?.addEventListener('keydown',event=>{
      if(event.key==='Enter'&&!event.shiftKey)blockUnsupported(event);
    },true);
    sync();
    return true;
  }

  if(!install()){
    const observer=new MutationObserver(()=>{if(install())observer.disconnect();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
})();
