"use strict";

const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');

function runtimeConfig() {
  try {
    const file = path.join(__dirname, 'runtime-config.json');
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    return {};
  }
}

function authConfig() {
  const config = runtimeConfig();
  return {
    url: String(process.env.SUPABASE_URL || config.supabaseUrl || '').trim().replace(/\/$/, ''),
    key: String(process.env.SUPABASE_PUBLISHABLE_KEY || config.supabasePublishableKey || '').trim()
  };
}

function requireAuthConfig() {
  const config = authConfig();
  if (!config.url || !config.key) throw new Error('OpenRabbit account sign-in is not configured yet.');
  return config;
}

function sessionPath(app) {
  return path.join(app.getPath('userData'), 'openrabbit-session.bin');
}

function encodeSession(session) {
  const raw = JSON.stringify(session);
  if (safeStorage.isEncryptionAvailable()) return safeStorage.encryptString(raw);
  return Buffer.from(raw, 'utf8');
}

function decodeSession(buffer) {
  if (!buffer?.length) return null;
  try {
    const raw = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buffer) : buffer.toString('utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readSession(app) {
  try {
    const file = sessionPath(app);
    if (!fs.existsSync(file)) return null;
    return decodeSession(fs.readFileSync(file));
  } catch {
    return null;
  }
}

function writeSession(app, session) {
  const file = sessionPath(app);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodeSession(session), { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch {}
}

function clearSession(app) {
  try { fs.unlinkSync(sessionPath(app)); } catch {}
}

function headers(key, accessToken) {
  return {
    apikey: key,
    'content-type': 'application/json',
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
  };
}

async function parseResponse(response) {
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) {
    const error = new Error(body?.msg || body?.message || body?.error_description || body?.error || `OpenRabbit account service returned ${response.status}.`);
    error.status = response.status;
    error.code = body?.code || body?.error_code || body?.error;
    throw error;
  }
  return body;
}

function normalizeSession(payload) {
  if (!payload?.access_token) return null;
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_in: payload.expires_in,
    expires_at: Number(payload.expires_at || Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600)),
    token_type: payload.token_type || 'bearer',
    user: payload.user || null
  };
}

async function refreshSession(app, current) {
  if (!current?.refresh_token) return null;
  const { url, key } = requireAuthConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify({ refresh_token: current.refresh_token })
  });
  const payload = await parseResponse(response);
  const next = normalizeSession(payload);
  if (next) writeSession(app, next);
  return next;
}

async function validSession(app) {
  let session = readSession(app);
  if (!session) return null;
  if (Number(session.expires_at || 0) > Math.floor(Date.now() / 1000) + 60) return session;
  try {
    session = await refreshSession(app, session);
    return session;
  } catch {
    clearSession(app);
    return null;
  }
}

async function currentUser(app) {
  const session = await validSession(app);
  if (!session?.access_token) return null;
  const { url, key } = requireAuthConfig();
  try {
    const response = await fetch(`${url}/auth/v1/user`, { headers: headers(key, session.access_token) });
    const user = await parseResponse(response);
    if (user?.id) {
      writeSession(app, { ...session, user });
      return { id: user.id, email: user.email || '', createdAt: user.created_at || null, accessToken: session.access_token };
    }
  } catch {
    clearSession(app);
  }
  return null;
}

async function signIn(app, email, password) {
  const { url, key } = requireAuthConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify({ email: String(email || '').trim(), password: String(password || '') })
  });
  const payload = await parseResponse(response);
  const session = normalizeSession(payload);
  if (!session) throw new Error('OpenRabbit could not create a session.');
  writeSession(app, session);
  return { signedIn: true, user: { id: payload.user?.id, email: payload.user?.email || email } };
}

async function signUp(app, email, password) {
  const { url, key } = requireAuthConfig();
  const response = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify({ email: String(email || '').trim(), password: String(password || '') })
  });
  const payload = await parseResponse(response);
  const session = normalizeSession(payload);
  if (session) writeSession(app, session);
  return {
    signedIn: Boolean(session),
    needsConfirmation: !session,
    user: payload.user ? { id: payload.user.id, email: payload.user.email || email } : { email }
  };
}

async function signOut(app) {
  const session = readSession(app);
  try {
    if (session?.access_token) {
      const { url, key } = requireAuthConfig();
      await fetch(`${url}/auth/v1/logout`, { method: 'POST', headers: headers(key, session.access_token) });
    }
  } catch {}
  clearSession(app);
  return { signedIn: false };
}

module.exports = { authConfig, currentUser, signIn, signUp, signOut, validSession, clearSession };
