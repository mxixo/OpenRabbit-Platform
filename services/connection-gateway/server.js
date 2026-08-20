"use strict";

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.OPENRABBIT_CONNECTION_GATEWAY_PORT || 8790);
const host = process.env.OPENRABBIT_CONNECTION_GATEWAY_HOST || '0.0.0.0';
const publicBaseUrl = (process.env.OPENRABBIT_CONNECTION_GATEWAY_PUBLIC_URL || `http://127.0.0.1:${port}`).replace(/\/$/, '');
const dataDir = process.env.OPENRABBIT_GATEWAY_DATA_DIR || path.join(process.cwd(), '.openrabbit-gateway');
const tokenFile = path.join(dataDir, 'tokens.enc.json');
const appToken = String(process.env.OPENRABBIT_GATEWAY_APP_TOKEN || '').trim();
const encSecret = String(process.env.OPENRABBIT_TOKEN_ENCRYPTION_KEY || '').trim();
const supabaseUrl = String(process.env.SUPABASE_URL || 'https://djplmhglilcwqfotnjew.supabase.co').trim().replace(/\/$/, '');
const supabasePublishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ZdtVEN0fzdTEQyfQRLfhDA_zjKarn2n').trim();
const states = new Map();

const providers = [
  { id: 'gmail', label: 'Gmail', category: 'mail', oauth: true },
  { id: 'google-calendar', label: 'Google Calendar', category: 'calendar', oauth: true },
  { id: 'hubspot', label: 'HubSpot', category: 'crm', oauth: true },
  { id: 'microsoft', label: 'Microsoft 365', category: 'mail-calendar', oauth: true, planned: true },
  { id: 'meta', label: 'Meta / Instagram / Facebook', category: 'social', oauth: true, planned: true },
  { id: 'linkedin', label: 'LinkedIn', category: 'social', oauth: true, planned: true },
  { id: 'google-maps', label: 'Google Maps', category: 'maps', oauth: false, platformCapability: true }
];

function corsOrigin() { return process.env.OPENRABBIT_GATEWAY_CORS_ORIGIN || '*'; }
function json(res, status, body, extra = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'access-control-allow-origin': corsOrigin(),
    'access-control-allow-headers': 'authorization,content-type,x-openrabbit-user',
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    ...extra
  });
  res.end(payload);
}
function html(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}
function requestId() { return crypto.randomBytes(12).toString('hex'); }
function safe(value) { return String(value || '').replace(/[<>&"']/g, ''); }

function encryptionKey() {
  if (!encSecret) throw new Error('OPENRABBIT_TOKEN_ENCRYPTION_KEY is required');
  return crypto.createHash('sha256').update(encSecret).digest();
}
function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(obj))), cipher.final()]);
  return { v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') };
}
function decrypt(blob) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(blob.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(blob.data, 'base64')), decipher.final()]).toString('utf8'));
}
function readStore() {
  try {
    if (!fs.existsSync(tokenFile)) return {};
    return decrypt(JSON.parse(fs.readFileSync(tokenFile, 'utf8')));
  } catch (error) {
    console.error('Token store read failed', error.message);
    return {};
  }
}
function writeStore(store) {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${tokenFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(encrypt(store)), { mode: 0o600 });
  fs.renameSync(tmp, tokenFile);
  try { fs.chmodSync(tokenFile, 0o600); } catch {}
}
function getUserToken(uid, id) { return readStore()[uid]?.[id] || null; }
function saveToken(uid, id, tokens) {
  const store = readStore();
  store[uid] = store[uid] || {};
  store[uid][id] = { ...tokens, updated_at: new Date().toISOString() };
  writeStore(store);
}
function deleteToken(uid, id) {
  const store = readStore();
  if (store[uid]) delete store[uid][id];
  writeStore(store);
}

function bearer(req) {
  const raw = String(req.headers.authorization || '');
  return raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
}
function matchesServiceToken(token) {
  if (!appToken || !token) return false;
  const a = Buffer.from(token), b = Buffer.from(appToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function supabaseUser(token) {
  if (!token || !supabaseUrl || !supabasePublishableKey) return null;
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabasePublishableKey, authorization: `Bearer ${token}` }
    });
    if (!response.ok) return null;
    const user = await response.json();
    return user?.id ? { id: String(user.id), email: user.email || '' } : null;
  } catch {
    return null;
  }
}
async function authenticate(req) {
  const token = bearer(req);
  const user = await supabaseUser(token);
  if (user) return { mode: 'user', userId: user.id, email: user.email };
  if (matchesServiceToken(token)) {
    const requested = String(req.headers['x-openrabbit-user'] || 'service').replace(/[^a-zA-Z0-9._@-]/g, '').slice(0, 160) || 'service';
    return { mode: 'service', userId: requested };
  }
  return null;
}
async function requireUser(req, res, id) {
  const identity = await authenticate(req);
  if (identity) return identity;
  json(res, 401, { error: 'UNAUTHORIZED', message: 'Sign in to OpenRabbit to continue.', requestId: id });
  return null;
}

function providerConfigured(id) {
  if (id === 'gmail' || id === 'google-calendar') return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
  if (id === 'hubspot') return Boolean(process.env.HUBSPOT_OAUTH_CLIENT_ID && process.env.HUBSPOT_OAUTH_CLIENT_SECRET);
  if (id === 'google-maps') return Boolean(process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.OPENRABBIT_MAPS_BROWSER_KEY);
  return false;
}

async function refreshGoogleToken(uid, id, token) {
  if (!token?.refresh_token) return null;
  if (token.access_token && Number(token.expires_at || 0) > Date.now() + 60000) return token;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  const refreshed = await response.json();
  if (!response.ok || !refreshed.access_token) throw new Error(refreshed.error_description || refreshed.error || 'Google authorization is no longer valid.');
  const next = { ...token, ...refreshed, refresh_token: token.refresh_token, expires_at: Date.now() + Number(refreshed.expires_in || 3600) * 1000 };
  saveToken(uid, id, next);
  return next;
}
async function refreshHubSpotToken(uid, token) {
  if (!token?.refresh_token) return null;
  if (token.access_token && Number(token.expires_at || 0) > Date.now() + 60000) return token;
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.HUBSPOT_OAUTH_CLIENT_ID,
      client_secret: process.env.HUBSPOT_OAUTH_CLIENT_SECRET,
      refresh_token: token.refresh_token
    })
  });
  const refreshed = await response.json();
  if (!response.ok || !refreshed.access_token) throw new Error(refreshed.message || refreshed.error || 'HubSpot authorization is no longer valid.');
  const next = { ...token, ...refreshed, refresh_token: refreshed.refresh_token || token.refresh_token, expires_at: Date.now() + Number(refreshed.expires_in || 1800) * 1000 };
  saveToken(uid, 'hubspot', next);
  return next;
}

async function verifyConnection(uid, id) {
  if (id === 'google-maps') return { connected: false, available: providerConfigured(id), verified: providerConfigured(id) };
  const token = getUserToken(uid, id);
  if (!token) return { connected: false, available: false, verified: false };
  try {
    if (id === 'gmail' || id === 'google-calendar') {
      const live = await refreshGoogleToken(uid, id, token);
      const endpoint = id === 'gmail'
        ? 'https://gmail.googleapis.com/gmail/v1/users/me/profile'
        : 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1';
      const response = await fetch(endpoint, { headers: { authorization: `Bearer ${live.access_token}` } });
      if (!response.ok) throw new Error(`Google verification failed (${response.status})`);
      return { connected: true, available: true, verified: true, updatedAt: live.updated_at || token.updated_at || null };
    }
    if (id === 'hubspot') {
      const live = await refreshHubSpotToken(uid, token);
      const response = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(live.access_token)}`);
      if (!response.ok) throw new Error(`HubSpot verification failed (${response.status})`);
      return { connected: true, available: true, verified: true, updatedAt: live.updated_at || token.updated_at || null };
    }
    return { connected: false, available: false, verified: false };
  } catch (error) {
    console.warn(`Connection verification failed for ${id}:`, error.message);
    return { connected: false, available: true, verified: false, needsReconnect: true };
  }
}
async function connectionState(uid) {
  return Promise.all(providers.map(async provider => ({
    id: provider.id,
    label: provider.label,
    configured: providerConfigured(provider.id),
    planned: Boolean(provider.planned),
    platformCapability: Boolean(provider.platformCapability),
    ...(await verifyConnection(uid, provider.id))
  })));
}

function googleStart(uid, kind) {
  const id = kind === 'calendar' ? 'google-calendar' : 'gmail';
  if (!providerConfigured(id)) throw new Error('Google sign-in is not available yet.');
  const state = crypto.randomBytes(24).toString('hex');
  states.set(state, { uid, id, created: Date.now() });
  const redirect = `${publicBaseUrl}/oauth/google/callback`;
  const scope = id === 'gmail' ? 'https://www.googleapis.com/auth/gmail.readonly' : 'https://www.googleapis.com/auth/calendar.readonly';
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.GOOGLE_OAUTH_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', `openid email ${scope}`);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return url.toString();
}
function hubspotStart(uid) {
  if (!providerConfigured('hubspot')) throw new Error('HubSpot sign-in is not available yet.');
  const state = crypto.randomBytes(24).toString('hex');
  states.set(state, { uid, id: 'hubspot', created: Date.now() });
  const scopes = (process.env.HUBSPOT_OAUTH_SCOPES || 'crm.objects.contacts.read crm.objects.companies.read crm.objects.deals.read').trim();
  const url = new URL('https://app.hubspot.com/oauth/authorize');
  url.searchParams.set('client_id', process.env.HUBSPOT_OAUTH_CLIENT_ID);
  url.searchParams.set('redirect_uri', `${publicBaseUrl}/oauth/hubspot/callback`);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('state', state);
  return url.toString();
}
async function exchangeGoogle(code, record) {
  const redirect = `${publicBaseUrl}/oauth/google/callback`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_OAUTH_CLIENT_ID, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: redirect })
  });
  const token = await response.json();
  if (!response.ok) throw new Error(token.error_description || token.error || `Google token exchange failed (${response.status})`);
  saveToken(record.uid, record.id, { ...token, expires_at: Date.now() + Number(token.expires_in || 3600) * 1000 });
}
async function exchangeHubSpot(code, record) {
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: process.env.HUBSPOT_OAUTH_CLIENT_ID, client_secret: process.env.HUBSPOT_OAUTH_CLIENT_SECRET, redirect_uri: `${publicBaseUrl}/oauth/hubspot/callback`, code })
  });
  const token = await response.json();
  if (!response.ok) throw new Error(token.message || token.error || `HubSpot token exchange failed (${response.status})`);
  saveToken(record.uid, 'hubspot', { ...token, expires_at: Date.now() + Number(token.expires_in || 1800) * 1000 });
}
function popState(value) {
  const record = states.get(value);
  states.delete(value);
  if (!record || Date.now() - record.created > 10 * 60 * 1000) return null;
  return record;
}

async function route(req, res) {
  const id = requestId();
  const url = new URL(req.url, publicBaseUrl);
  if (req.method === 'OPTIONS') return json(res, 204, {});

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'openrabbit-connection-gateway',
      version: 4,
      configured: {
        encryption: Boolean(encSecret),
        accountAuth: Boolean(supabaseUrl && supabasePublishableKey),
        serviceAuth: Boolean(appToken),
        google: providerConfigured('gmail'),
        hubspot: providerConfigured('hubspot'),
        maps: providerConfigured('google-maps')
      },
      requestId: id
    });
  }
  if (req.method === 'GET' && url.pathname === '/v1/providers') {
    return json(res, 200, { providers: providers.map(p => ({ ...p, configured: providerConfigured(p.id) })), requestId: id });
  }

  if (url.pathname === '/oauth/google/callback' && req.method === 'GET') {
    const record = popState(url.searchParams.get('state'));
    if (!record) return html(res, 400, '<h1>OpenRabbit authorization expired</h1><p>Please return to OpenRabbit and try again.</p>');
    if (url.searchParams.get('error')) return html(res, 400, `<h1>Google authorization failed</h1><p>${safe(url.searchParams.get('error'))}</p>`);
    try {
      await exchangeGoogle(url.searchParams.get('code'), record);
      return html(res, 200, '<style>body{font-family:system-ui;background:#0b1020;color:#fff;display:grid;place-items:center;height:100vh}.c{text-align:center}h1{color:#a78bfa}</style><div class="c"><h1>OpenRabbit connected</h1><p>Your Google account is connected. You can close this window and return to OpenRabbit.</p></div>');
    } catch (error) {
      return html(res, 500, `<h1>OpenRabbit connection failed</h1><p>${safe(error.message)}</p>`);
    }
  }
  if (url.pathname === '/oauth/hubspot/callback' && req.method === 'GET') {
    const record = popState(url.searchParams.get('state'));
    if (!record) return html(res, 400, '<h1>OpenRabbit authorization expired</h1><p>Please return to OpenRabbit and try again.</p>');
    if (url.searchParams.get('error')) return html(res, 400, `<h1>HubSpot authorization failed</h1><p>${safe(url.searchParams.get('error'))}</p>`);
    try {
      await exchangeHubSpot(url.searchParams.get('code'), record);
      return html(res, 200, '<style>body{font-family:system-ui;background:#0b1020;color:#fff;display:grid;place-items:center;height:100vh}.c{text-align:center}h1{color:#a78bfa}</style><div class="c"><h1>OpenRabbit connected</h1><p>Your HubSpot account is connected. You can close this window and return to OpenRabbit.</p></div>');
    } catch (error) {
      return html(res, 500, `<h1>OpenRabbit connection failed</h1><p>${safe(error.message)}</p>`);
    }
  }

  const identity = await requireUser(req, res, id);
  if (!identity) return;
  const uid = identity.userId;

  if (req.method === 'GET' && url.pathname === '/v1/connections') {
    return json(res, 200, { user: uid, connections: await connectionState(uid), requestId: id });
  }
  if (req.method === 'GET' && url.pathname === '/v1/platform/maps') {
    const key = process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.OPENRABBIT_MAPS_BROWSER_KEY || '';
    return json(res, 200, { available: Boolean(key), browserKey: key, platformCapability: true, requestId: id });
  }
  if (req.method === 'POST' && url.pathname === '/v1/connections/google/start') {
    try {
      return json(res, 200, { authorizationUrl: googleStart(uid, url.searchParams.get('kind') || 'gmail'), requestId: id });
    } catch (error) {
      return json(res, 503, { error: 'PROVIDER_NOT_CONFIGURED', message: error.message, requestId: id });
    }
  }
  if (req.method === 'POST' && url.pathname === '/v1/connections/hubspot/start') {
    try {
      return json(res, 200, { authorizationUrl: hubspotStart(uid), requestId: id });
    } catch (error) {
      return json(res, 503, { error: 'PROVIDER_NOT_CONFIGURED', message: error.message, requestId: id });
    }
  }
  const verifyMatch = url.pathname.match(/^\/v1\/connections\/([a-z0-9-]+)\/verify$/);
  if (verifyMatch && req.method === 'POST') {
    return json(res, 200, { provider: verifyMatch[1], ...(await verifyConnection(uid, verifyMatch[1])), requestId: id });
  }
  const connectionMatch = url.pathname.match(/^\/v1\/connections\/([a-z0-9-]+)$/);
  if (connectionMatch && req.method === 'DELETE') {
    deleteToken(uid, connectionMatch[1]);
    return json(res, 200, { connected: false, provider: connectionMatch[1], requestId: id });
  }
  return json(res, 404, { error: 'NOT_FOUND', requestId: id });
}

const server = http.createServer((req, res) => {
  route(req, res).catch(error => {
    console.error(error);
    json(res, 500, { error: 'INTERNAL_ERROR', message: 'Connection gateway request failed.' });
  });
});

if (require.main === module) {
  server.listen(port, host, () => console.log(`OpenRabbit Connection Gateway listening on ${publicBaseUrl}`));
}

module.exports = { server, providers, connectionState, verifyConnection, authenticate };
