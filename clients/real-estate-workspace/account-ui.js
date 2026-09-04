"use strict";

(function(){
  const api=window.openRabbitDesktop;
  if(!api?.getAccountStatus)return;

  async function init(){
    try{
      const status=await api.getAccountStatus();
      if(!status?.signedIn||!status.user?.id){
        location.replace('login.html');
        return;
      }
      const profile=document.querySelector('.profile');
      if(!profile)return;
      const email=status.user.email||'OpenRabbit user';
      const initials=email.includes('@')?email.split('@')[0].split(/[._-]/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join(''):'OR';
      profile.innerHTML=`<div class="avatar">${escapeHtml(initials||'OR')}</div><div style="min-width:0"><b style="display:block;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(email)}</b><button id="openRabbitSignOut" style="padding:0;border:0;background:none;color:#9ca3b8;cursor:pointer;font-size:11px">Sign out</button></div>`;
      document.getElementById('openRabbitSignOut')?.addEventListener('click',async()=>{
        const button=document.getElementById('openRabbitSignOut');
        if(button){button.disabled=true;button.textContent='Signing out…';}
        try{await api.signOut();}catch(error){console.error('OpenRabbit sign out failed',error);if(button){button.disabled=false;button.textContent='Sign out';}}
      });
    }catch(error){
      console.error('OpenRabbit account status failed',error);
    }
  }

  function escapeHtml(value){
    return String(value||'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  init();
})();
