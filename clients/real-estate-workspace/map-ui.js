"use strict";

function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}

function renderMap(){
  const panel=document.querySelector('[data-panel="map"].focused');
  const model=window.__openrabbitWorkspaceModel;
  const rows=model?.surfaces?.map?.data?.items||[];
  if(!panel||!rows.length)return;
  const body=panel.querySelector('.panel-body');
  if(!body)return;

  const lats=rows.map((x)=>Number(x.latitude)).filter(Number.isFinite);
  const lngs=rows.map((x)=>Number(x.longitude)).filter(Number.isFinite);
  if(!lats.length||!lngs.length)return;
  const minLat=Math.min(...lats),maxLat=Math.max(...lats),minLng=Math.min(...lngs),maxLng=Math.max(...lngs);
  const latSpan=Math.max(maxLat-minLat,.01),lngSpan=Math.max(maxLng-minLng,.01);
  const project=(x)=>({left:8+((Number(x.longitude)-minLng)/lngSpan)*84,top:8+(1-((Number(x.latitude)-minLat)/latSpan))*84});
  const selected=rows[0];

  body.innerHTML=`
    <div class="metric-row">
      <div class="metric"><span class="small muted">Mapped</span><b>${rows.length}</b></div>
      <div class="metric"><span class="small muted">Opportunities</span><b>${rows.filter((x)=>x.kind==="opportunity").length}</b></div>
      <div class="metric"><span class="small muted">Listings</span><b>${rows.filter((x)=>x.kind==="listing").length}</b></div>
    </div>
    <div style="height:12px"></div>
    <div class="or-map-shell" style="display:grid;grid-template-columns:minmax(0,2fr) minmax(220px,.8fr);gap:12px;min-height:430px">
      <div class="or-map-canvas" style="position:relative;min-height:430px;border:1px solid #dbe2ea;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,#eef6ff,#e7f0ea 55%,#f8fafc)">
        <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(100,116,139,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(100,116,139,.10) 1px,transparent 1px);background-size:36px 36px"></div>
        ${rows.map((x)=>{const p=project(x);return `<button data-map-item="${escapeHtml(x.id)}" title="${escapeHtml(x.label)}" style="position:absolute;left:${p.left}%;top:${p.top}%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 1px 6px rgba(15,23,42,.28);background:${x.kind==="opportunity"?"#0f172a":"#64748b"};cursor:pointer"></button>`}).join("")}
        <div style="position:absolute;left:12px;bottom:10px;background:rgba(255,255,255,.92);border:1px solid #e5e7eb;border-radius:9px;padding:6px 8px;font-size:11px;color:#475569">Provider-neutral preview · real tiles plug in later</div>
      </div>
      <aside id="mapInspector" class="item" style="margin:0;align-self:stretch"></aside>
    </div>`;

  const inspector=body.querySelector('#mapInspector');
  function show(item){
    if(!inspector)return;
    const meta=item.metadata||{};
    inspector.innerHTML=`<strong style="font-size:16px">${escapeHtml(item.label)}</strong><div class="small muted" style="margin-top:5px">${escapeHtml(item.address||item.kind||"")}</div>${item.price!=null?`<div style="font-size:22px;font-weight:900;margin-top:14px">$${Number(item.price).toLocaleString()}</div>`:""}<div class="list" style="margin-top:14px"><div class="item"><span class="small muted">Type</span><strong>${escapeHtml(meta.propertyType||item.kind||"—")}</strong></div><div class="item"><span class="small muted">MLS</span><strong>${escapeHtml(meta.mlsId||"—")}</strong></div><div class="item"><span class="small muted">Context</span><strong>${escapeHtml([meta.units?`${meta.units} units`:null,meta.bedrooms?`${meta.bedrooms} bd`:null,meta.bathrooms?`${meta.bathrooms} ba`:null,meta.status].filter(Boolean).join(" · ")||"—")}</strong></div></div>${meta.streetViewUrl?`<a href="${escapeHtml(meta.streetViewUrl)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:12px">Street View</a>`:""}${meta.listingUrl?`<a href="${escapeHtml(meta.listingUrl)}" target="_blank" rel="noopener" style="display:inline-block;margin:12px 0 0 12px">Listing</a>`:""}`;
  }
  show(selected);
  body.querySelectorAll('[data-map-item]').forEach((button)=>button.addEventListener('click',()=>{const item=rows.find((x)=>x.id===button.dataset.mapItem);if(item)show(item)}));
}

window.addEventListener('openrabbit:workspace-rendered',renderMap);
window.addEventListener('openrabbit:workspace-model',renderMap);
setTimeout(renderMap,0);
