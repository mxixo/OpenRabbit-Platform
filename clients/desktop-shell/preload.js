const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('openRabbitDesktop', Object.freeze({
  platform: process.platform,
  desktop: true,
  mapsBrowserKey: process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.OPENRABBIT_MAPS_BROWSER_KEY || ''
}));
