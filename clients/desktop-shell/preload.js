const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openRabbitDesktop', Object.freeze({
  platform: process.platform,
  desktop: true,
  mapsBrowserKey: process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.OPENRABBIT_MAPS_BROWSER_KEY || '',
  getIntegrationStatus: () => ipcRenderer.invoke('openrabbit:integration-status'),
  startGoogleOAuth: (kind = 'gmail') => ipcRenderer.invoke('openrabbit:start-google-oauth', kind),
  connectGmail: () => ipcRenderer.invoke('openrabbit:start-google-oauth', 'gmail'),
  connectGoogleCalendar: () => ipcRenderer.invoke('openrabbit:start-google-oauth', 'calendar'),
  getAgentProviderStatus: () => ipcRenderer.invoke('openrabbit:agent-provider-status'),
  connectChatGPT: () => ipcRenderer.invoke('openrabbit:connect-chatgpt'),
  agentChat: (messages) => ipcRenderer.invoke('openrabbit:agent-chat', messages)
}));
