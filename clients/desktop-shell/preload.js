const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openRabbitDesktop', Object.freeze({
  platform: process.platform,
  desktop: true,
  getIntegrationStatus: () => ipcRenderer.invoke('openrabbit:integration-status'),
  getMapsConfig: () => ipcRenderer.invoke('openrabbit:maps-config'),
  startGoogleOAuth: (kind = 'gmail') => ipcRenderer.invoke('openrabbit:start-google-oauth', kind),
  connectGmail: () => ipcRenderer.invoke('openrabbit:start-google-oauth', 'gmail'),
  connectGoogleCalendar: () => ipcRenderer.invoke('openrabbit:start-google-oauth', 'calendar'),
  connectHubSpot: () => ipcRenderer.invoke('openrabbit:start-hubspot-oauth'),
  disconnectIntegration: (provider) => ipcRenderer.invoke('openrabbit:disconnect-integration', provider),
  getAgentProviderStatus: () => ipcRenderer.invoke('openrabbit:agent-provider-status'),
  connectChatGPT: () => ipcRenderer.invoke('openrabbit:connect-chatgpt'),
  agentChat: (messages) => ipcRenderer.invoke('openrabbit:agent-chat', messages)
}));
