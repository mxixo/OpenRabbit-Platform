"use strict";
(function(){
  if(window.__openRabbitMapFallbackBound)return;
  window.__openRabbitMapFallbackBound=true;
  const api=window.openRabbitDesktop;

  function mapPanel(){
    const panels=[...document.querySelectorAll('.panel,.card,article')];
    return panels.find(p=>/map search|market intelligence|market/i.test(String(p.querySelector('.panel-title,.title,h2,h3')?.textContent||'')))||null;
  }
  function mapFrame(panel){return panel?.querySelector('.mapframe,.mapWrap,#liveMap')||null;}
  function setBuiltIn(panel){
    const pill=panel?.querySelector('.status,.pill,.ready');
    if(pill){pill.textContent='Built in';pill.classList.add('live');pill.classList.remove('warn','error');}
    document.querySelectorAll('[data-conn="maps"],.conn').forEach(c=>{
      if(/maps/i.test(c.textContent||'')){c.classList.add('live');const em=c.querySelector('em');if(em)em.innerHTML='<span class="dot"></span>Built in';}
    });
  }
  function bboxFor(lat,lon,delta=.08){return [lon-delta,lat-delta,lon+delta,lat+delta].join(',');}
  function embedUrl(lat=33.4484,lon=-112.0740,delta=.12){return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bboxFor(lat,lon,delta))}&layer=mapnik&marker=${encodeURIComponent(lat+','+lon)}`;}

  async function install(){
    const panel=mapPanel(),frame=mapFrame(panel);if(!panel||!frame)return;
    let googleAvailable=false;
    try{const c=await api?.getMapsConfig?.();googleAvailable=Boolean(c?.available&&c?.browserKey);}catch{}
    if(googleAvailable)return;
    setBuiltIn(panel);
    if(frame.dataset.openrabbitOsm==='true')return;
    frame.dataset.openrabbitOsm='true';
    frame.innerHTML='';
    frame.style.position='relative';frame.style.minHeight='300px';frame.style.background='#0b1120';
    const iframe=document.createElement('iframe');iframe.title='OpenRabbit map';iframe.src=embedUrl();iframe.style.cssText='position:absolute;inset:0;width:100%;height:100%;border:0;filter:saturate(.9) contrast(1.02)';iframe.loading='eager';frame.appendChild(iframe);
    const controls=document.createElement('div');controls.style.cssText='position:absolute;left:10px;right:10px;top:10px;z-index:5;display:grid;grid-template-columns:1fr auto;gap:7px';controls.innerHTML='<input aria-label="Search map" placeholder="Search address, neighborhood or ZIP" style="min-width:0;border:1px solid #40506e;background:#08101d;color:#fff;border-radius:8px;padding:10px 11px"><button type="button" style="border:1px solid #6b4eb3;background:#4a2686;color:#fff;border-radius:8px;padding:9px 12px;font-weight:800;cursor:pointer">Search</button>';frame.appendChild(controls);
    const status=document.createElement('div');status.style.cssText='position:absolute;left:10px;bottom:10px;z-index:5;background:rgba(6,12,22,.9);color:#d8deea;border:1px solid #33405b;border-radius:7px;padding:7px 9px;font-size:10px';status.textContent='OpenStreetMap live · no account connection required';frame.appendChild(status);
    const input=controls.querySelector('input'),button=controls.querySelector('button');
    async function search(){const q=input.value.trim();if(!q)return;button.disabled=true;status.textContent='Searching map…';try{const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(q);const r=await fetch(url,{headers:{'Accept-Language':'en'}});const data=await r.json();const hit=data?.[0];if(!hit)throw new Error('No matching location found.');const lat=Number(hit.lat),lon=Number(hit.lon);iframe.src=embedUrl(lat,lon,.025);status.textContent=hit.display_name||q;}catch(e){status.textContent=e?.message||'Map search unavailable.';}finally{button.disabled=false;}}
    button.addEventListener('click',search);input.addEventListener('keydown',e=>{if(e.key==='Enter')search();});
  }
  install();setTimeout(install,1200);setTimeout(install,3500);setInterval(()=>{const p=mapPanel();if(p)setBuiltIn(p);},10000);
})();
