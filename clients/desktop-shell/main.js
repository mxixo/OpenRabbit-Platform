const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');

const repoRoot = path.join(__dirname, '..', '..');

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

function googleTokenFile() {
  if (!app.isPackaged) {
    const configured = process.env.GOOGLE_OAUTH_TOKEN_FILE || '.openrabbit/google-oauth.json';
    return path.isAbsolute(configured) ? configured : path.join(repoRoot, configured);
  }
  return path.join(app.getPath('userData'), 'google-oauth.json');
}

function integrationStatus() {
  return {
    google: fs.existsSync(googleTokenFile()),
    maps: Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.OPENRABBIT_MAPS_BROWSER_KEY),
    hubspot: Boolean(process.env.HUBSPOT_ACCESS_TOKEN),
    openai: Boolean(process.env.OPENAI_API_KEY)
  };
}

async function startGoogleOAuth() {
  const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) throw new Error('Google OAuth is not configured. Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to .env.');
  const port = Number(process.env.GOOGLE_OAUTH_CALLBACK_PORT || 53682);
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `http://127.0.0.1:${port}/oauth/google/callback`;
  const state = crypto.randomBytes(24).toString('hex');
  const scopes = ['openid','email','https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/calendar.readonly'];
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', clientId);
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', scopes.join(' '));
  auth.searchParams.set('access_type', 'offline');
  auth.searchParams.set('prompt', 'consent');
  auth.searchParams.set('state', state);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      try { server.close(); } catch {}
      if (error) reject(error); else resolve(value);
    };
    const server = http.createServer(async (req, res) => {
      const requestUrl = new URL(req.url, redirectUri);
      if (requestUrl.pathname !== '/oauth/google/callback') { res.writeHead(404); return res.end('Not found'); }
      if (requestUrl.searchParams.get('state') !== state) { res.writeHead(400); res.end('OAuth state mismatch.'); return finish(new Error('Google OAuth state mismatch.')); }
      const oauthError = requestUrl.searchParams.get('error');
      if (oauthError) { res.writeHead(400); res.end(`Google authorization failed: ${oauthError}`); return finish(new Error(oauthError)); }
      const code = requestUrl.searchParams.get('code');
      try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {'content-type':'application/x-www-form-urlencoded'},
          body: new URLSearchParams({client_id:clientId,client_secret:clientSecret,code,grant_type:'authorization_code',redirect_uri:redirectUri})
        });
        const tokens = await response.json();
        if (!response.ok) throw new Error(tokens.error_description || tokens.error || `Google token exchange failed (${response.status})`);
        if (!tokens.refresh_token) throw new Error('Google did not return a refresh token. Revoke prior OpenRabbit consent and try again.');
        const tokenFile = googleTokenFile();
        fs.mkdirSync(path.dirname(tokenFile), {recursive:true});
        fs.writeFileSync(tokenFile, JSON.stringify({refresh_token:tokens.refresh_token,created_at:new Date().toISOString()}, null, 2), {mode:0o600});
        try { fs.chmodSync(tokenFile, 0o600); } catch {}
        res.writeHead(200, {'content-type':'text/html; charset=utf-8'});
        res.end('<!doctype html><title>OpenRabbit connected</title><style>body{font-family:system-ui;background:#071524;color:white;display:grid;place-items:center;height:100vh;margin:0}.c{max-width:520px;text-align:center}h1{color:#8df4c8}</style><div class="c"><h1>OpenRabbit is connected</h1><p>Gmail and Google Calendar authorization completed successfully. You can close this window and return to OpenRabbit.</p></div>');
        finish(null, {connected:true});
      } catch (error) {
        res.writeHead(500, {'content-type':'text/plain; charset=utf-8'}); res.end(`OpenRabbit authorization failed: ${error.message}`); finish(error);
      }
    });
    server.once('error', (error) => finish(error));
    server.listen(port, '127.0.0.1', async () => {
      try { await shell.openExternal(auth.toString()); } catch (error) { finish(error); }
    });
  });
}

function workspacePath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'workspace', 'index.html');
  return path.join(__dirname, '..', 'real-estate-workspace', 'index.html');
}

function enhancementScriptPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'workspace', 'startup-enhancements.js');
  return path.join(__dirname, '..', 'real-estate-workspace', 'startup-enhancements.js');
}

function createWindow() {
  const window = new BrowserWindow({width:1440,height:960,minWidth:1080,minHeight:720,backgroundColor:'#0b0d10',title:'OpenRabbit',show:false,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => { if (/^https?:\/\//i.test(url)) { event.preventDefault(); shell.openExternal(url); } });
  window.webContents.on('did-finish-load', () => {
    try {
      const script = fs.readFileSync(enhancementScriptPath(), 'utf8');
      window.webContents.executeJavaScript(script).catch((error) => console.error('OpenRabbit startup enhancements failed', error));
    } catch (error) {
      console.error('OpenRabbit startup enhancements unavailable', error);
    }
  });
  window.loadFile(workspacePath());
}

app.whenReady().then(() => {
  loadLocalEnv();
  ipcMain.handle('openrabbit:integration-status', () => integrationStatus());
  ipcMain.handle('openrabbit:start-google-oauth', () => startGoogleOAuth());
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
