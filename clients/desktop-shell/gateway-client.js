"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let identityResolver = null;

function setUserResolver(resolver) {
  identityResolver = typeof resolver === 'function' ? resolver : null;
}

function packagedConfig() {
  try {
    const file = path.join(__dirname, 'runtime-config.json');
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    return {};
  }
}

function gatewayBaseUrl() {
  const config = packagedConfig();
  return String(
    process.env.OPENRABBIT_CONNECTION_GATEWAY_URL ||
    process.env.OPENRABBIT_CONNECTION_GATEWAY_PUBLIC_URL ||
    config.connectionGatewayUrl ||
    ''
  ).trim().replace(/\/$/, '');
}

function identityFile(app) {
  return path.join(app.getPath('userData'), 'openrabbit-identity.json');
}

function installationUserId(app) {
  const file = identityFile(app);
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed?.userId) return parsed.userId;
    }
  } catch {}
  const userId = `install_${crypto.randomUUID()}`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ userId, createdAt: new Date().toISOString(), identityMode: 'installation' }, null, 2), { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch {}
  return userId;
}

async function resolvedIdentity(app) {
  if (identityResolver) {
    try {
      const value = await identityResolver();
      if (value?.id) return { id: String(value.id), accessToken: value.accessToken || value.access_token || '' };
      if (typeof value === 'string' && value.trim()) return { id: value.trim(), accessToken: '' };
    } catch {}
  }
  return { id: installationUserId(app), accessToken: '' };
}

async function headers(app, extra = {}) {
  const identity = await resolvedIdentity(app);
  const legacyToken = String(process.env.OPENRABBIT_GATEWAY_APP_TOKEN || '').trim();
  const bearer = identity.accessToken || legacyToken;
  return {
    accept: 'application/json',
    'x-openrabbit-user': identity.id,
    ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    ...extra
  };
}

async function request(app, route, options = {}) {
  const base = gatewayBaseUrl();
  if (!base) throw new Error('OpenRabbit connection service is not configured yet.');
  const response = await fetch(`${base}${route}`, {
    method: options.method || 'GET',
    headers: await headers(app, options.headers || {}),
    body: options.body
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : { message: await response.text() };
  if (!response.ok) {
    const error = new Error(body?.message || `OpenRabbit connection service returned ${response.status}.`);
    error.status = response.status;
    error.code = body?.error;
    throw error;
  }
  return body;
}

async function health(app) { return request(app, '/health'); }
async function status(app) { return request(app, '/v1/connections'); }
async function mapsConfig(app) { return request(app, '/v1/platform/maps'); }
async function startGoogle(app, kind = 'gmail') {
  const safeKind = kind === 'calendar' ? 'calendar' : 'gmail';
  return request(app, `/v1/connections/google/start?kind=${encodeURIComponent(safeKind)}`, { method: 'POST' });
}
async function startHubSpot(app) { return request(app, '/v1/connections/hubspot/start', { method: 'POST' }); }
async function verify(app, provider) { return request(app, `/v1/connections/${encodeURIComponent(provider)}/verify`, { method: 'POST' }); }
async function disconnect(app, provider) { return request(app, `/v1/connections/${encodeURIComponent(provider)}`, { method: 'DELETE' }); }

module.exports = { gatewayBaseUrl, installationUserId, setUserResolver, health, status, mapsConfig, startGoogle, startHubSpot, verify, disconnect };
