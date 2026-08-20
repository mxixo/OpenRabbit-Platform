"use strict";

(function(){
  const mapEl=document.getElementById('googleMap');
  const statusEl=document.getElementById('mapStatus');
  const input=document.getElementById('mapSearch');
  const button=document.getElementById('mapSearchButton');
  const key=window.openRabbitDesktop?.mapsBrowserKey||'';

  function setStatus(message,type='info'){
    if(!statusEl)return;
    statusEl.textContent=message;
    statusEl.dataset.type=type;
  }

  if(!mapEl){return;}
  if(!key){
    setStatus('Google Maps key not configured. Add GOOGLE_MAPS_BROWSER_KEY to the OpenRabbit .env file, then relaunch the desktop app.','warn');
    return;
  }

  window.__openRabbitInitMap=function(){
    const center={lat:33.4484,lng:-112.0740};
    const map=new google.maps.Map(mapEl,{center,zoom:11,mapTypeControl:false,streetViewControl:false,fullscreenControl:true});
    const geocoder=new google.maps.Geocoder();
    let marker=new google.maps.Marker({map,position:center,title:'Phoenix, AZ'});
    setStatus('Google Maps live · search an address or place','ok');

    async function runSearch(){
      const query=(input?.value||'').trim();
      if(!query)return;
      setStatus(`Searching: ${query}…`,'info');
      try{
        const result=await geocoder.geocode({address:query});
        if(!result.results?.length){setStatus('No matching place found.','warn');return;}
        const place=result.results[0];
        const location=place.geometry.location;
        map.setCenter(location);
        map.setZoom(15);
        marker.setMap(null);
        marker=new google.maps.Marker({map,position:location,title:place.formatted_address});
        setStatus(place.formatted_address,'ok');
      }catch(error){
        console.error('OpenRabbit map search failed',error);
        setStatus(`Map search failed: ${error.message||error}`,'warn');
      }
    }

    button?.addEventListener('click',runSearch);
    input?.addEventListener('keydown',(event)=>{if(event.key==='Enter')runSearch();});
  };

  const script=document.createElement('script');
  script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__openRabbitInitMap&v=weekly`;
  script.async=true;
  script.defer=true;
  script.onerror=()=>setStatus('Google Maps failed to load. Verify the browser key, API enablement and key restrictions.','warn');
  document.head.appendChild(script);
})();
