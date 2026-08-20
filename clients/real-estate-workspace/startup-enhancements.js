"use strict";

(function () {
  function addCrmReadyOverlay() {
    const crm = document.querySelector('.panel.crm');
    if (!crm || crm.querySelector('[data-openrabbit-crm-overlay]')) return;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.dataset.openrabbitCrmOverlay = 'true';
    overlay.style.top = '57%';
    overlay.style.width = '275px';
    overlay.innerHTML = `
      <div class="oi">⌂</div>
      <h2>Ready to connect<br>your CRM</h2>
      <p>Your contacts, leads, deals and pipeline will appear here after authorization.</p>
      <a class="connect" href="connections.html" style="display:inline-block;text-decoration:none">Connect CRM</a>
    `;
    crm.appendChild(overlay);

    const secure = document.createElement('div');
    secure.className = 'secure';
    secure.textContent = '🔒 Secure connection · disconnect anytime';
    secure.style.bottom = '8px';
    crm.appendChild(secure);
  }

  function upgradeSocialBrandLogos() {
    const brands = [
      {
        selector: '.social-card.ig',
        name: 'Instagram',
        src: 'https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/instagram.svg',
        background: 'linear-gradient(145deg,#833ab4 0%,#c13584 30%,#e1306c 52%,#fd1d1d 70%,#f77737 84%,#fcaf45 100%)'
      },
      {
        selector: '.social-card.fb',
        name: 'Facebook',
        src: 'https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/facebook.svg',
        background: '#1877F2'
      },
      {
        selector: '.social-card.tt',
        name: 'TikTok',
        src: 'https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/tiktok.svg',
        background: '#000000'
      },
      {
        selector: '.social-card.li',
        name: 'LinkedIn',
        src: 'https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/linkedin.svg',
        background: '#0A66C2'
      },
      {
        selector: '.social-card.sc',
        name: 'Snapchat',
        src: 'https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/snapchat.svg',
        background: '#FFFC00'
      }
    ];

    brands.forEach((brand) => {
      const card = document.querySelector(brand.selector);
      if (!card || card.dataset.openrabbitBrandLogo === 'true') return;

      card.dataset.openrabbitBrandLogo = 'true';
      card.setAttribute('aria-label', brand.name);
      card.title = brand.name;
      card.textContent = '';
      card.style.background = brand.background;
      card.style.alignItems = 'center';
      card.style.justifyContent = 'center';
      card.style.paddingTop = '0';
      card.style.opacity = '1';
      card.style.position = 'relative';
      card.style.overflow = 'hidden';

      const logo = document.createElement('img');
      logo.src = brand.src;
      logo.alt = `${brand.name} logo`;
      logo.width = 58;
      logo.height = 58;
      logo.loading = 'eager';
      logo.decoding = 'async';
      logo.referrerPolicy = 'no-referrer';
      logo.style.cssText = 'width:58px;height:58px;display:block;object-fit:contain;filter:invert(1);drop-shadow:0 2px 5px rgba(0,0,0,.18);';

      if (brand.name === 'Snapchat') {
        logo.style.width = '62px';
        logo.style.height = '62px';
        logo.style.filter = 'invert(1) drop-shadow(0 1px 1px rgba(0,0,0,.55))';
      }

      logo.addEventListener('error', () => {
        card.textContent = brand.name;
        card.style.fontSize = '13px';
        card.style.fontWeight = '900';
      }, { once: true });

      card.appendChild(logo);
    });
  }

  function addMapUi(market, mapFrame) {
    mapFrame.innerHTML = '';
    mapFrame.id = 'dashboardGoogleMap';
    mapFrame.style.background = '#07182a';

    const controls = document.createElement('div');
    controls.style.cssText = 'position:absolute;left:10px;right:10px;top:10px;z-index:5;display:flex;gap:6px;';
    controls.innerHTML = `
      <input id="dashboardMapSearch" aria-label="Search map" placeholder="Search address or place" style="flex:1;min-width:0;border:1px solid #315d89;background:rgba(6,17,31,.94);color:#fff;border-radius:8px;padding:9px 10px;font-size:11px;box-shadow:0 4px 14px rgba(0,0,0,.25)">
      <button id="dashboardMapSearchButton" class="mini" type="button">Search</button>
    `;
    market.appendChild(controls);

    const status = document.createElement('div');
    status.id = 'dashboardMapStatus';
    status.style.cssText = 'position:absolute;left:12px;right:12px;bottom:116px;z-index:5;padding:7px 9px;border-radius:7px;background:rgba(6,17,31,.9);border:1px solid #214b75;color:#cfd9e5;font-size:10px;pointer-events:none;';
    status.textContent = 'Initializing Google Maps…';
    market.appendChild(status);

    return { status };
  }

  function setMapMessage(message) {
    const copy = document.querySelector('.panel.market .market-copy');
    if (!copy) return;
    const action = copy.querySelector('a.wide');
    copy.innerHTML = `${message}<br><br>`;
    if (action) copy.appendChild(action);
  }

  function initDashboardMap() {
    const market = document.querySelector('.panel.market');
    const mapFrame = market?.querySelector('.mapframe');
    if (!market || !mapFrame || mapFrame.dataset.openrabbitLiveMap === 'true') return;
    mapFrame.dataset.openrabbitLiveMap = 'true';

    const { status } = addMapUi(market, mapFrame);
    const input = document.getElementById('dashboardMapSearch');
    const button = document.getElementById('dashboardMapSearchButton');
    const key = window.openRabbitDesktop?.mapsBrowserKey || '';

    if (!key) {
      status.textContent = 'Maps key not found in this desktop environment.';
      setMapMessage('Google Maps is ready in OpenRabbit, but this computer still needs <b>GOOGLE_MAPS_BROWSER_KEY</b> in its local <b>.env</b> file. Relaunch OpenRabbit after adding it.');
      return;
    }

    window.__openRabbitDashboardMapReady = function () {
      const center = { lat: 33.4484, lng: -112.0740 };
      const map = new google.maps.Map(mapFrame, {
        center,
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
      const geocoder = new google.maps.Geocoder();
      let marker = new google.maps.Marker({ map, position: center, title: 'Phoenix, AZ' });
      status.textContent = 'Google Maps live · search an address or place';
      setMapMessage('Live Google Maps is connected. Search Phoenix-area addresses or places here. Listings, pricing, DOM, inventory and comps will populate separately when an authoritative market-data source is connected.');

      async function search() {
        const query = (input?.value || '').trim();
        if (!query) return;
        status.textContent = `Searching: ${query}…`;
        try {
          const result = await geocoder.geocode({ address: query });
          const place = result.results?.[0];
          if (!place) {
            status.textContent = 'No matching place found.';
            return;
          }
          const location = place.geometry.location;
          map.setCenter(location);
          map.setZoom(15);
          marker.setMap(null);
          marker = new google.maps.Marker({ map, position: location, title: place.formatted_address });
          status.textContent = place.formatted_address;
        } catch (error) {
          console.error('OpenRabbit dashboard map search failed', error);
          status.textContent = `Map search failed: ${error.message || error}`;
        }
      }

      button?.addEventListener('click', search);
      input?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') search();
      });
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__openRabbitDashboardMapReady&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      status.textContent = 'Google Maps failed to load. Check the API key, billing and restrictions.';
      setMapMessage('Google Maps could not authenticate from this desktop session. Check the Maps JavaScript API key, billing, API restrictions and application/referrer restrictions.');
    };
    document.head.appendChild(script);
  }

  function start() {
    addCrmReadyOverlay();
    upgradeSocialBrandLogos();
    initDashboardMap();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
