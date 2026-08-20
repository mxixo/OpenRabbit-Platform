const { app, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const gateway = require('./gateway-client');
const actionQueue = require('./action-queue');

require('./main');

function workspaceDirectory() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'workspace');
  return path.join(__dirname, '..', 'real-estate-workspace');
}

async function pollForProvider(provider, timeoutMs = 5 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const state = await gateway.verify(app, provider);
      if (state.connected && state.verified) return state;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Sign-in was not completed. You can try again whenever you are ready.');
}

async function openOAuth(start, provider, failure) {
  const response = await start();
  if (!response.authorizationUrl) throw new Error(failure);
  await shell.openExternal(response.authorizationUrl);
  await pollForProvider(provider);
  return { connected: true, verified: true, provider };
}

async function startSocialOAuth(provider) {
  return openOAuth(() => gateway.startSocial(app, provider), provider, 'OpenRabbit could not start social account sign-in.');
}
async function startMicrosoftOAuth() {
  return openOAuth(() => gateway.startMicrosoft(app), 'microsoft', 'OpenRabbit could not start Microsoft 365 sign-in.');
}

function sanitizeQueuedAction(input = {}) {
  const externalWriteTypes = new Set(['send_email','create_calendar_event','update_calendar_event','update_crm','publish_social','financial_commitment','delete_record']);
  const type = String(input.type || 'agent_task').slice(0,80);
  return {
    ...input,
    type,
    approvalRequired: externalWriteTypes.has(type) ? true : input.approvalRequired !== false,
    source: String(input.source || 'openrabbit-ai').slice(0,100)
  };
}

app.on('browser-window-created', (_event, window) => {
  window.webContents.on('did-finish-load', () => {
    for (const name of ['live-data.js', 'map-fallback.js', 'microsoft-ui.js', 'ai-orb.js', 'proactive-brief.js', 'action-center.js']) {
      const file = path.join(workspaceDirectory(), name);
      try {
        const source = fs.readFileSync(file, 'utf8');
        window.webContents.executeJavaScript(source).catch(error => console.error(`OpenRabbit ${name} failed`, error));
      } catch (error) {
        console.error(`OpenRabbit ${name} unavailable`, error);
      }
    }
  });
});

app.whenReady().then(() => {
  ipcMain.handle('openrabbit:live-snapshot', () => gateway.liveSnapshot(app));
  ipcMain.handle('openrabbit:start-social-oauth', (_event, provider) => startSocialOAuth(provider));
  ipcMain.handle('openrabbit:start-microsoft-oauth', () => startMicrosoftOAuth());
  ipcMain.handle('openrabbit:actions-list', (_event, status) => actionQueue.list(app, status ? { status } : {}));
  ipcMain.handle('openrabbit:actions-enqueue', (_event, input) => actionQueue.enqueue(app, sanitizeQueuedAction(input)));
  ipcMain.handle('openrabbit:actions-approve', (_event, id) => actionQueue.approve(app, String(id || '')));
  ipcMain.handle('openrabbit:actions-reject', (_event, id, reason) => actionQueue.reject(app, String(id || ''), reason));
  ipcMain.handle('openrabbit:actions-audit', () => actionQueue.auditLog(app));
});
