const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openRabbitDesktop', Object.freeze({
  platform: process.platform,
  desktop: true,
  mapsBrowserKey: process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.OPENRABBIT_MAPS_BROWSER_KEY || '',
  getIntegrationStatus: () => ipcRenderer.invoke('openrabbit:integration-status'),
  startGoogleOAuth: () => ipcRenderer.invoke('openrabbit:start-google-oauth'),
  agentChat: (messages) => ipcRenderer.invoke('openrabbit:agent-chat', messages)
}));
