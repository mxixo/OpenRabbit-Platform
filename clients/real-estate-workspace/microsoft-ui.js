"use strict";
(function(){
  if(window.__openRabbitMicrosoftUiBound)return;
  window.__openRabbitMicrosoftUiBound=true;
  const api=window.openRabbitDesktop;
  if(!api?.connectMicrosoft)return;
  function cards(){return[...document.querySelectorAll('.panel,.card,article')];}
  function by(words){return cards().find(c=>words.some(w=>String(c.querySelector('.panel-title,.title,h2,h3')?.textContent||'').toLowerCase().includes(w)))||null;}
  function addButton(card,label){
    if(!card||card.querySelector('[data-openrabbit-ms]'))return;
    const target=card.querySelector('.overlay,.body,.actions')||card;
    const wrap=document.createElement('div');wrap.dataset.openrabbitMs='true';wrap.style.cssText='margin-top:8px;display:flex;gap:7px;align-items:center;flex-wrap:wrap';
    const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='border:1px solid #4b6ea8;background:#16345c;color:#fff;border-radius:8px;padding:8px 10px;font-size:10px;font-weight:800;cursor:pointer';
    const s=document.createElement('span');s.style.cssText='font-size:9px;color:#98a7bd';s.textContent='Microsoft 365 / Outlook';
    wrap.append(b,s);target.appendChild(wrap);
    b.addEventListener('click',async()=>{const old=b.textContent;b.disabled=true;b.textContent='Opening Microsoft sign-in…';try{await api.connectMicrosoft();b.textContent='Microsoft connected';setTimeout(()=>location.reload(),600);}catch(e){b.textContent=e?.message||'Microsoft sign-in unavailable';setTimeout(()=>{b.disabled=false;b.textContent=old},3500);}});
  }
  function enhance(){
    addButton(by(['email','inbox','gmail']),'Use Outlook / Microsoft 365');
    addButton(by(['calendar']),'Use Microsoft Calendar');
  }
  enhance();setTimeout(enhance,800);setTimeout(enhance,2200);
})();
