const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execFile, spawn } = require('child_process');
const gateway = require('./gateway-client');

const repoRoot = path.join(__dirname, '..', '..');
let workspaceServer;
let workspaceOrigin;

function loadLocalEnv() {
  if (app.isPackaged) return;
  const envPath = path.join(repoRoot, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function codexExecutable() {
  const local = path.join(__dirname, 'node_modules', '.bin', process.platform === 'win32' ? 'codex.cmd' : 'codex');
  if (fs.existsSync(local)) return local;
  return process.platform === 'win32' ? 'codex.cmd' : 'codex';
}

function openRabbitCodexHome() {
  const home = path.join(app.getPath('userData'), 'codex');
  fs.mkdirSync(home, { recursive: true });
  return home;
}

function codexEnvironment() {
  const env = { ...process.env, CODEX_HOME: openRabbitCodexHome(), CI: '1', NO_COLOR: '1' };
  delete env.OPENAI_API_KEY;
  delete env.CODEX_API_KEY;
  delete env.CODEX_ACCESS_TOKEN;
  return env;
}

function compactCodexError(stderr, stdout, fallback) {
  const raw = String(stderr || stdout || fallback || 'Codex command failed.').trim();
  const lines = raw.split(/\r?\n/).filter(Boolean);
  return lines.slice(-14).join('\n') || 'Codex command failed.';
}

function runCodex(args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(codexExecutable(), args, {
      cwd: options.cwd || app.getPath('temp'),
      env: options.env || codexEnvironment(),
      timeout: options.timeout || 60000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true
    }, (error, stdout, stderr) => {
      if (error) {
        const wrapped = new Error(compactCodexError(stderr, stdout, error.message || error));
        wrapped.code = error.code;
        wrapped.signal = error.signal;
        return reject(wrapped);
      }
      resolve({ stdout: String(stdout || '').trim(), stderr: String(stderr || '').trim() });
    });
  });
}

function runCodexHeadless(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(codexExecutable(), args, {
      cwd: options.cwd || app.getPath('temp'),
      env: options.env || codexEnvironment(),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '', settled = false;
    const timeoutMs = options.timeout || 60000;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch {}
      reject(new Error(compactCodexError(stderr, stdout, `Codex timed out after ${Math.round(timeoutMs / 1000)} seconds.`)));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => stdout += chunk);
    child.stderr.on('data', chunk => stderr += chunk);
    child.once('error', error => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } });
    child.once('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(compactCodexError(stderr, stdout, `Codex exited with code ${code}${signal ? ` (${signal})` : ''}.`)));
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

async function codexAuthStatus() {
  try {
    const result = await runCodex(['login', 'status'], { timeout: 15000 });
    const text = `${result.stdout}\n${result.stderr}`.trim();
    const lower = text.toLowerCase();
    if (lower.includes('logged in using chatgpt')) return { connected: true, provider: 'openai-chatgpt', authMode: 'chatgpt', label: 'ChatGPT connected', detail: text, codexAvailable: true };
    return { connected: false, provider: null, authMode: null, label: 'Ready to connect your AI', detail: text || 'Not logged in', codexAvailable: true };
  } catch (error) {
    const detail = error.message || String(error), lower = detail.toLowerCase();
    if (lower.includes('not logged in') || lower.includes('run codex login')) return { connected: false, provider: null, authMode: null, label: 'Ready to connect your AI', detail, codexAvailable: true };
    const unavailable = /enoent|not found|is not recognized|no such file/i.test(detail);
    return { connected: false, provider: null, authMode: null, label: 'Ready to connect your AI', detail, codexAvailable: !unavailable };
  }
}

async function startChatGPTLogin() {
  const before = await codexAuthStatus();
  if (before.connected && before.authMode === 'chatgpt') return before;
  try {
    await runCodex(['login'], { timeout: 10 * 60 * 1000, env: codexEnvironment() });
  } catch (error) {
    const message = error.message || String(error);
    if (/enoent|not found|is not recognized|no such file/i.test(message)) throw new Error('OpenRabbit could not open ChatGPT sign-in on this computer.');
    throw new Error(`ChatGPT sign-in did not complete: ${message}`);
  }
  const status = await codexAuthStatus();
  if (!status.connected || status.authMode !== 'chatgpt') throw new Error(status.detail || 'ChatGPT sign-in did not complete.');
  return status;
}

function mapConnections(list = []) {
  const byId = Object.fromEntries(list.map(item => [item.id, item]));
  return {
    gmail: Boolean(byId.gmail?.connected && byId.gmail?.verified),
    calendar: Boolean(byId['google-calendar']?.connected && byId['google-calendar']?.verified),
    hubspot: Boolean(byId.hubspot?.connected && byId.hubspot?.verified),
    maps: Boolean(byId['google-maps']?.available),
    mapsAvailable: Boolean(byId['google-maps']?.available),
    connections: list
  };
}

async function integrationStatus() {
  const ai = await codexAuthStatus();
  const base = gateway.gatewayBaseUrl();
  if (!base) {
    return {
      gmail: false,
      calendar: false,
      hubspot: false,
      maps: false,
      mapsAvailable: false,
      openai: Boolean(ai.connected),
      openaiDetail: ai.label,
      gatewayConnected: false,
      gatewayConfigured: false,
      gatewayMessage: 'OpenRabbit connection service is not configured yet.'
    };
  }
  try {
    const [connectionResponse, health] = await Promise.all([gateway.status(app), gateway.health(app)]);
    return {
      ...mapConnections(connectionResponse.connections),
      openai: Boolean(ai.connected),
      openaiDetail: ai.label,
      gatewayConnected: Boolean(health.ok),
      gatewayConfigured: true,
      gatewayMessage: health.ok ? 'OpenRabbit connection service online' : 'OpenRabbit connection service unavailable'
    };
  } catch (error) {
    return {
      gmail: false,
      calendar: false,
      hubspot: false,
      maps: false,
      mapsAvailable: false,
      openai: Boolean(ai.connected),
      openaiDetail: ai.label,
      gatewayConnected: false,
      gatewayConfigured: true,
      gatewayMessage: error.message || 'OpenRabbit connection service unavailable'
    };
  }
}

async function pollForConnection(provider, timeoutMs = 5 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const verification = await gateway.verify(app, provider);
      if (verification.connected && verification.verified) return verification;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Sign-in was not completed. You can try again whenever you are ready.');
}

async function startGoogleOAuth(kind = 'gmail') {
  const provider = kind === 'calendar' ? 'google-calendar' : 'gmail';
  const response = await gateway.startGoogle(app, kind);
  if (!response.authorizationUrl) throw new Error('OpenRabbit could not start Google sign-in.');
  await shell.openExternal(response.authorizationUrl);
  await pollForConnection(provider);
  return { connected: true, verified: true, provider };
}

async function startHubSpotOAuth() {
  const response = await gateway.startHubSpot(app);
  if (!response.authorizationUrl) throw new Error('OpenRabbit could not start HubSpot sign-in.');
  await shell.openExternal(response.authorizationUrl);
  await pollForConnection('hubspot');
  return { connected: true, verified: true, provider: 'hubspot' };
}

async function disconnectIntegration(provider) {
  const map = { calendar: 'google-calendar', gmail: 'gmail', hubspot: 'hubspot' };
  const id = map[provider] || provider;
  return gateway.disconnect(app, id);
}

async function getMapsConfig() {
  try {
    const config = await gateway.mapsConfig(app);
    return { available: Boolean(config.available), browserKey: config.browserKey || '' };
  } catch {
    return { available: false, browserKey: '' };
  }
}

function openRabbitAgentInstructions() {
  return [
    'You are OpenRabbit, the AI operating agent inside the OpenRabbit desktop application.',
    'Be concise, practical and action-oriented.',
    'You may explain what OpenRabbit can do, help the user plan work, analyze supplied information, and guide them through the interface.',
    'Do not claim that an external action, email, calendar change, CRM write, social post, or property-data lookup happened unless a connected OpenRabbit tool actually performed it.',
    'When an integration is not connected, clearly say what connection is required.',
    'This desktop chat is currently conversational only. Do not modify local files or execute external actions.'
  ].join(' ');
}

function conversationPrompt(rawMessages) {
  const messages = Array.isArray(rawMessages) ? rawMessages : [];
  const transcript = messages.slice(-20).map(message => {
    const role = message?.role === 'assistant' ? 'OpenRabbit' : 'User';
    return `${role}: ${String(message?.content || '').slice(0, 12000)}`;
  }).filter(Boolean).join('\n\n');
  if (!transcript.trim()) throw new Error('Type a message for OpenRabbit first.');
  return `${openRabbitAgentInstructions()}\n\nConversation:\n${transcript}\n\nRespond only as OpenRabbit to the latest user message. Do not inspect or modify files. Do not use shell commands or tools.`;
}

async function runOpenRabbitAgent(rawMessages) {
  const status = await codexAuthStatus();
  if (!status.connected || status.authMode !== 'chatgpt') throw new Error('ChatGPT is not connected to OpenRabbit yet. Choose Continue with ChatGPT first.');
  const prompt = conversationPrompt(rawMessages);
  const result = await runCodexHeadless(['--ask-for-approval', 'never', 'exec', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', prompt], {
    cwd: app.getPath('temp'), env: codexEnvironment(), timeout: 60000
  });
  const text = result.stdout.trim();
  if (!text) throw new Error(compactCodexError(result.stderr, '', 'ChatGPT returned an empty response.'));
  return { text, model: 'ChatGPT via Codex', provider: 'openai-chatgpt' };
}

function workspaceDirectory() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'workspace');
  return path.join(__dirname, '..', 'real-estate-workspace');
}
function enhancementScriptPath() { return path.join(workspaceDirectory(), 'startup-enhancements.js'); }
function agentChatScriptPath() { return path.join(workspaceDirectory(), 'agent-chat.js'); }
function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' }[ext] || 'application/octet-stream');
}
function startWorkspaceServer() {
  if (workspaceServer && workspaceOrigin) return Promise.resolve(workspaceOrigin);
  const root = path.resolve(workspaceDirectory());
  const port = Number(process.env.OPENRABBIT_DESKTOP_PORT || 53683);
  return new Promise((resolve, reject) => {
    workspaceServer = http.createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url, `http://127.0.0.1:${port}`);
        let pathname = decodeURIComponent(requestUrl.pathname);
        if (pathname === '/') pathname = '/index.html';
        const relative = pathname.replace(/^\/+/, '');
        const filePath = path.resolve(root, relative);
        if (filePath !== root && !filePath.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'content-type': contentType(filePath), 'cache-control': 'no-store' });
        fs.createReadStream(filePath).pipe(res);
      } catch {
        res.writeHead(500);
        res.end('OpenRabbit workspace server error');
      }
    });
    workspaceServer.once('error', reject);
    workspaceServer.listen(port, '127.0.0.1', () => {
      workspaceOrigin = `http://127.0.0.1:${port}`;
      resolve(workspaceOrigin);
    });
  });
}

async function createWindow() {
  const origin = await startWorkspaceServer();
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#0b0d10',
    title: 'OpenRabbit',
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) && !url.startsWith(origin)) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (/^https?:\/\//i.test(url) && !url.startsWith(origin)) { event.preventDefault(); shell.openExternal(url); }
  });
  window.webContents.on('did-finish-load', () => {
    for (const scriptPath of [enhancementScriptPath(), agentChatScriptPath()]) {
      try {
        const script = fs.readFileSync(scriptPath, 'utf8');
        window.webContents.executeJavaScript(script).catch(error => console.error('OpenRabbit renderer enhancement failed', error));
      } catch (error) {
        console.error('OpenRabbit renderer enhancement unavailable', scriptPath, error);
      }
    }
  });
  window.loadURL(`${origin}/index.html`);
}

app.whenReady().then(async () => {
  loadLocalEnv();
  ipcMain.handle('openrabbit:integration-status', () => integrationStatus());
  ipcMain.handle('openrabbit:start-google-oauth', (_event, kind) => startGoogleOAuth(kind));
  ipcMain.handle('openrabbit:start-hubspot-oauth', () => startHubSpotOAuth());
  ipcMain.handle('openrabbit:disconnect-integration', (_event, provider) => disconnectIntegration(provider));
  ipcMain.handle('openrabbit:maps-config', () => getMapsConfig());
  ipcMain.handle('openrabbit:agent-provider-status', () => codexAuthStatus());
  ipcMain.handle('openrabbit:connect-chatgpt', () => startChatGPTLogin());
  ipcMain.handle('openrabbit:agent-chat', (_event, messages) => runOpenRabbitAgent(messages));
  try { await createWindow(); }
  catch (error) { console.error('OpenRabbit failed to start', error); app.quit(); }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow().catch(console.error); });
});

app.on('window-all-closed', () => {
  if (workspaceServer) { try { workspaceServer.close(); } catch {} }
  if (process.platform !== 'darwin') app.quit();
});
