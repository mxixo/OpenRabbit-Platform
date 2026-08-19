"use strict";

(()=>{
  const stage=document.querySelector(".large-map");
  if(!stage)return;

  async function loadConfig(){
    const res=await fetch("/api/config/public");
    if(!res.ok)throw new Error("Public config unavailable");
    return res.json();
  }

  function loadGoogleMaps(apiKey){
    return new Promise((resolve,reject)=>{
      if(window.google?.maps)return resolve(window.google.maps);
      window.__openrabbitMapsReady=()=>resolve(window.google.maps);
      const script=document.createElement("script");
      script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=__openrabbitMapsReady&loading=async`;
      script.async=true;script.defer=true;script.onerror=()=>reject(new Error("Google Maps failed to load"));document.head.appendChild(script);
    });
  }

  async function installLiveMap(){
    try{
      const config=await loadConfig();
      if(!config.googleMapsBrowserKey)return;
      const maps=await loadGoogleMaps(config.googleMapsBrowserKey);
      stage.classList.add("live-map-active");
      [...stage.children].forEach(el=>{if(el.id!=="propertyPopover")el.style.display="none"});
      const canvas=document.createElement("div");canvas.id="googleMapCanvas";canvas.style.cssText="position:absolute;inset:0;border-radius:12px;overflow:hidden";stage.prepend(canvas);
      const map=new maps.Map(canvas,{center:{lat:33.4484,lng:-112.0740},zoom:11,mapTypeControl:false,streetViewControl:false,fullscreenControl:false});
      const properties=[
        {name:"Royal Palm Inn",position:{lat:33.5201,lng:-112.1138},score:91},
        {name:"1638 W Mohave St",position:{lat:33.4315,lng:-112.0942},score:84},
        {name:"Westminster St",position:{lat:33.4624,lng:-112.0500},score:78},
        {name:"Phoenix 4-Plex",position:{lat:33.4870,lng:-112.0730},score:88}
      ];
      properties.forEach(p=>{
        const marker=new maps.Marker({position:p.position,map,title:`${p.name} · ${p.score}`});
        marker.addListener("click",()=>{
          window.dispatchEvent(new CustomEvent("openrabbit:market-property",{detail:{name:p.name}}));
        });
      });
      const badge=document.createElement("div");badge.textContent="Google Maps · Live";badge.style.cssText="position:absolute;right:12px;top:12px;z-index:3;background:#0b1714dd;border:1px solid #315548;border-radius:8px;padding:7px 10px;font-size:11px;color:#6be7b8";stage.appendChild(badge);
    }catch(error){console.warn("Live Google Maps unavailable; using prototype map.",error)}
  }

  installLiveMap();
})();