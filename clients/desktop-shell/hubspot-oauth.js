const { app, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');

function repoRoot() {
  return path.join(__dirname, '..', '..');
}

function tokenFile() {
  if (app.isPackaged) return path.join(app.getPath('userData'), 'hubspot-oauth.json');
  const configured = process.env.HUBSPOT_OAUTH_TOKEN_FILE || '.openrabbit/hubspot-oauth.json';
  return path.isAbsolute(configured) ? configured : path.join(repoRoot(), configured);
}

function readToken() {
  const file = tokenFile();
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function saveToken(data) {
  const file = tokenFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch {}
}

function oauthConfig() {
  const clientId = (process.env.HUBSPOT_CLIENT_ID || '').trim();
  const clientSecret = (process.env.HUBSPOT_CLIENT_SECRET || '').trim();
  const port = Number(process.env.HUBSPOT_OAUTH_CALLBACK_PORT || 53684);
  const redirectUri = process.env.HUBSPOT_OAUTH_REDIRECT_URI || `http://127.0.0.1:${port}/oauth/hubspot/callback`;
  const scopes = (process.env.HUBSPOT_SCOPES || 'crm.objects.contacts.read crm.objects.companies.read crm.objects.deals.read').trim();
  return { clientId, clientSecret, port, redirectUri, scopes };
}

async function exchange(body) {
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error_description || data.error || `HubSpot token exchange failed (${response.status})`);
  return data;
}

async function refreshToken(current) {
  const { clientId, clientSecret } = oauthConfig();
  if (!clientId || !clientSecret || !current?.refresh_token) return null;
  const next = await exchange({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: current.refresh_token
  });
  const saved = {
    ...current,
    access_token: next.access_token,
    refresh_token: next.refresh_token || current.refresh_token,
    expires_in: next.expires_in,
    updated_at: new Date().toISOString(),
    expires_at: Date.now() + Math.max(0, Number(next.expires_in || 0) - 60) * 1000
  };
  saveToken(saved);
  return saved;
}

async function verifyAccessToken(accessToken) {
  if (!accessToken) return null;
  const response = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(accessToken)}`);
  if (!response.ok) return null;
  return response.json().catch(() => ({}));
}

async function status() {
  let current = readToken();
  if (!current) return { connected: false };
  try {
    if (current.expires_at && Date.now() >= Number(current.expires_at)) current = await refreshToken(current);
    let verification = await verifyAccessToken(current?.access_token);
    if (!verification && current?.refresh_token) {
      current = await refreshToken(current);
      verification = await verifyAccessToken(current?.access_token);
    }
    if (!verification) return { connected: false };
    return {
      connected: true,
      hubId: verification.hub_id || verification.hubId || current.hub_id || null,
      user: verification.user || null,
      scopes: verification.scopes || current.scopes || []
    };
  } catch {
    return { connected: false };
  }
}

async function startOAuth() {
  const { clientId, clientSecret, port, redirectUri, scopes } = oauthConfig();
  if (!clientId || !clientSecret) throw new Error('HubSpot OAuth is not configured. Add HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET to your local OpenRabbit configuration.');

  const state = crypto.randomBytes(24).toString('hex');
  const auth = new URL('https://app.hubspot.com/oauth/authorize');
  auth.searchParams.set('client_id', clientId);
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('scope', scopes);
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
      if (requestUrl.pathname !== '/oauth/hubspot/callback') { res.writeHead(404); return res.end('Not found'); }
      if (requestUrl.searchParams.get('state') !== state) { res.writeHead(400); res.end('OAuth state mismatch.'); return finish(new Error('HubSpot OAuth state mismatch.')); }
      const oauthError = requestUrl.searchParams.get('error');
      if (oauthError) { res.writeHead(400); res.end(`HubSpot authorization failed: ${oauthError}`); return finish(new Error(oauthError)); }
      const code = requestUrl.searchParams.get('code');
      if (!code) { res.writeHead(400); res.end('HubSpot did not return an authorization code.'); return finish(new Error('HubSpot authorization code missing.')); }
      try {
        const tokens = await exchange({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code
        });
        const saved = {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          scopes: scopes.split(/\s+/).filter(Boolean),
          created_at: new Date().toISOString(),
          expires_at: Date.now() + Math.max(0, Number(tokens.expires_in || 0) - 60) * 1000
        };
        const verification = await verifyAccessToken(saved.access_token);
        if (!verification) throw new Error('HubSpot returned credentials, but OpenRabbit could not verify the connection.');
        saved.hub_id = verification.hub_id || verification.hubId || null;
        saveToken(saved);
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<!doctype html><title>OpenRabbit connected</title><style>body{font-family:system-ui;background:#111126;color:white;display:grid;place-items:center;height:100vh;margin:0}.c{max-width:520px;text-align:center}h1{color:#b89cff}</style><div class="c"><h1>HubSpot connected</h1><p>Your CRM connection was verified. You can close this window and return to OpenRabbit.</p></div>');
        finish(null, { connected: true, hubId: saved.hub_id });
      } catch (error) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(`OpenRabbit HubSpot authorization failed: ${error.message}`);
        finish(error);
      }
    });
    server.once('error', finish);
    server.listen(port, '127.0.0.1', async () => {
      try { await shell.openExternal(auth.toString()); } catch (error) { finish(error); }
    });
  });
}

module.exports = { startOAuth, status, tokenFile };
