"use strict";

(()=>{
  const stage=document.querySelector(".large-map");
  if(!stage)return;
  async function loadConfig(){const res=await fetch("/api/config/public");if(!res.ok)throw new Error("Public config unavailable");return res.json()}
  function loadGoogleMaps(apiKey){return new Promise((resolve,reject)=>{if(window.google?.maps?.places)return resolve(window.google.maps);window.__openrabbitMapsReady=()=>resolve(window.google.maps);const script=document.createElement("script");script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=__openrabbitMapsReady&loading=async`;script.async=true;script.defer=true;script.onerror=()=>reject(new Error("Google Maps failed to load"));document.head.appendChild(script)})}
  function button(text){const b=document.createElement("button");b.textContent=text;b.style.cssText="border:1px solid #31506d;background:#0a1723ee;color:#dbe8f5;border-radius:8px;padding:9px 11px;cursor:pointer";return b}
  async function installLiveMap(){try{
    const config=await loadConfig();if(!config.googleMapsBrowserKey)return;
    const maps=await loadGoogleMaps(config.googleMapsBrowserKey);
    stage.classList.add("live-map-active");[...stage.children].forEach(el=>el.style.display="none");
    const canvas=document.createElement("div");canvas.id="googleMapCanvas";canvas.style.cssText="position:absolute;inset:0;border-radius:12px;overflow:hidden";stage.prepend(canvas);
    const map=new maps.Map(canvas,{center:{lat:33.4484,lng:-112.0740},zoom:11,mapTypeControl:true,streetViewControl:true,fullscreenControl:true,zoomControl:true,scaleControl:true,mapTypeId:"roadmap"});
    let searchMarker=null;
    const toolbar=document.createElement("div");toolbar.style.cssText="position:absolute;left:14px;top:14px;z-index:5;display:flex;gap:7px;align-items:center;flex-wrap:wrap;max-width:calc(100% - 28px)";
    const input=document.createElement("input");input.type="search";input.placeholder="Search any address or place…";input.autocomplete="off";input.style.cssText="width:min(390px,60vw);height:40px;border:1px solid #31506d;background:#07131eee;color:white;border-radius:9px;padding:0 13px;box-shadow:0 8px 24px #0008";toolbar.appendChild(input);
    const locate=button("My location"),clear=button("Clear");toolbar.append(locate,clear);stage.appendChild(toolbar);
    const searchBox=new maps.places.SearchBox(input);map.addListener("bounds_changed",()=>searchBox.setBounds(map.getBounds()));
    searchBox.addListener("places_changed",()=>{const places=searchBox.getPlaces()||[];if(!places.length)return;const place=places[0];if(searchMarker)searchMarker.setMap(null);if(place.geometry?.location){searchMarker=new maps.Marker({map,position:place.geometry.location,title:place.name||place.formatted_address||input.value});if(place.geometry.viewport)map.fitBounds(place.geometry.viewport);else{map.setCenter(place.geometry.location);map.setZoom(17)}const info=new maps.InfoWindow({content:`<div style="color:#111;max-width:260px"><b>${place.name||"Location"}</b><br>${place.formatted_address||input.value}</div>`});info.open({map,anchor:searchMarker})}});
    input.addEventListener("keydown",e=>{if(e.key==="Enter")setTimeout(()=>{const first=document.querySelector(".pac-item");if(first)first.click()},0)});
    locate.onclick=()=>{if(!navigator.geolocation)return;navigator.geolocation.getCurrentPosition(pos=>{const p={lat:pos.coords.latitude,lng:pos.coords.longitude};map.setCenter(p);map.setZoom(15);if(searchMarker)searchMarker.setMap(null);searchMarker=new maps.Marker({map,position:p,title:"Your location"})},()=>{})};
    clear.onclick=()=>{input.value="";if(searchMarker){searchMarker.setMap(null);searchMarker=null}map.setCenter({lat:33.4484,lng:-112.0740});map.setZoom(11)};
    const badge=document.createElement("div");badge.textContent="Google Maps · Live";badge.style.cssText="position:absolute;right:12px;bottom:12px;z-index:4;background:#0b1714dd;border:1px solid #315548;border-radius:8px;padding:7px 10px;font-size:11px;color:#6be7b8";stage.appendChild(badge);
  }catch(error){console.warn("Live Google Maps unavailable.",error)}}
  installLiveMap();
})();