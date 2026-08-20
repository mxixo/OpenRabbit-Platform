const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openRabbitDesktop', Object.freeze({
  platform: process.platform,
  desktop: true,
  getAccountStatus: () => ipcRenderer.invoke('openrabbit:account-status'),
  signIn: (email, password) => ipcRenderer.invoke('openrabbit:account-sign-in', email, password),
  signUp: (email, password) => ipcRenderer.invoke('openrabbit:account-sign-up', email, password),
  signOut: () => ipcRenderer.invoke('openrabbit:account-sign-out'),
  openDashboard: () => ipcRenderer.invoke('openrabbit:open-dashboard'),
  getIntegrationStatus: () => ipcRenderer.invoke('openrabbit:integration-status'),
  getLiveSnapshot: () => ipcRenderer.invoke('openrabbit:live-snapshot'),
  getMapsConfig: () => ipcRenderer.invoke('openrabbit:maps-config'),
  startGoogleOAuth: (kind = 'gmail') => ipcRenderer.invoke('openrabbit:start-google-oauth', kind),
  connectGmail: () => ipcRenderer.invoke('openrabbit:start-google-oauth', 'gmail'),
  connectGoogleCalendar: () => ipcRenderer.invoke('openrabbit:start-google-oauth', 'calendar'),
  connectMicrosoft: () => ipcRenderer.invoke('openrabbit:start-microsoft-oauth'),
  connectHubSpot: () => ipcRenderer.invoke('openrabbit:start-hubspot-oauth'),
  connectSocial: (provider = 'meta') => ipcRenderer.invoke('openrabbit:start-social-oauth', provider),
  disconnectIntegration: (provider) => ipcRenderer.invoke('openrabbit:disconnect-integration', provider),
  getAgentProviderStatus: () => ipcRenderer.invoke('openrabbit:agent-provider-status'),
  connectChatGPT: () => ipcRenderer.invoke('openrabbit:connect-chatgpt'),
  agentChat: (messages) => ipcRenderer.invoke('openrabbit:agent-chat', messages)
}));
