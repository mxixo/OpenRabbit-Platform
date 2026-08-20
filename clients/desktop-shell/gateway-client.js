"use strict";

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function gatewayBaseUrl() {
  return String(process.env.OPENRABBIT_CONNECTION_GATEWAY_URL || process.env.OPENRABBIT_CONNECTION_GATEWAY_PUBLIC_URL || '').trim().replace(/\/$/, '');
}

function sessionToken() {
  return String(process.env.OPENRABBIT_SESSION_TOKEN || process.env.OPENRABBIT_GATEWAY_APP_TOKEN || '').trim();
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

function headers(app, extra = {}) {
  const token = sessionToken();
  return {
    accept: 'application/json',
    'x-openrabbit-user': installationUserId(app),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...extra
  };
}

async function request(app, route, options = {}) {
  const base = gatewayBaseUrl();
  if (!base) throw new Error('OpenRabbit connection service is not configured yet.');
  const response = await fetch(`${base}${route}`, {
    method: options.method || 'GET',
    headers: headers(app, options.headers || {}),
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

async function health(app) {
  return request(app, '/health');
}

async function status(app) {
  return request(app, '/v1/connections');
}

async function mapsConfig(app) {
  return request(app, '/v1/platform/maps');
}

async function startGoogle(app, kind = 'gmail') {
  const safeKind = kind === 'calendar' ? 'calendar' : 'gmail';
  return request(app, `/v1/connections/google/start?kind=${encodeURIComponent(safeKind)}`, { method: 'POST' });
}

async function startHubSpot(app) {
  return request(app, '/v1/connections/hubspot/start', { method: 'POST' });
}

async function verify(app, provider) {
  return request(app, `/v1/connections/${encodeURIComponent(provider)}/verify`, { method: 'POST' });
}

async function disconnect(app, provider) {
  return request(app, `/v1/connections/${encodeURIComponent(provider)}`, { method: 'DELETE' });
}

module.exports = {
  gatewayBaseUrl,
  installationUserId,
  health,
  status,
  mapsConfig,
  startGoogle,
  startHubSpot,
  verify,
  disconnect
};
