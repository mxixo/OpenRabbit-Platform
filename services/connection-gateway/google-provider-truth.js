"use strict";

const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

function requireNonEmpty(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function revocationToken(tokenRecord) {
  if (!tokenRecord || typeof tokenRecord !== "object") {
    throw new Error("Google token record is required");
  }
  const refresh = String(tokenRecord.refresh_token || "").trim();
  if (refresh) return refresh;
  return requireNonEmpty(tokenRecord.access_token, "Google access token");
}

async function verifyGoogleAccessToken(accessToken, { fetchImpl = globalThis.fetch } = {}) {
  const token = requireNonEmpty(accessToken, "Google access token");
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");

  let response;
  try {
    response = await fetchImpl(GOOGLE_USERINFO_URL, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
  } catch (error) {
    const wrapped = new Error("Google provider verification request failed");
    wrapped.code = "GOOGLE_PROVIDER_UNAVAILABLE";
    wrapped.cause = error;
    throw wrapped;
  }

  if (response.status === 401 || response.status === 403) {
    return { verified: false, reason: "provider_rejected" };
  }
  if (!response.ok) {
    const error = new Error(`Google provider verification returned HTTP ${response.status}`);
    error.code = "GOOGLE_PROVIDER_UNAVAILABLE";
    throw error;
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    const wrapped = new Error("Google provider verification returned invalid JSON");
    wrapped.code = "GOOGLE_PROVIDER_UNAVAILABLE";
    wrapped.cause = error;
    throw wrapped;
  }
  if (!payload || typeof payload !== "object" || !String(payload.sub || "").trim()) {
    const error = new Error("Google provider verification returned no subject identity");
    error.code = "GOOGLE_PROVIDER_UNAVAILABLE";
    throw error;
  }

  // Deliberately expose no access token, refresh token, auth code, or user content.
  return { verified: true, reason: "provider_confirmed" };
}

async function revokeGoogleGrant(tokenRecord, { fetchImpl = globalThis.fetch } = {}) {
  const token = revocationToken(tokenRecord);
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation is required");

  let response;
  try {
    response = await fetchImpl(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
  } catch (error) {
    const wrapped = new Error("Google provider revocation request failed");
    wrapped.code = "GOOGLE_PROVIDER_UNAVAILABLE";
    wrapped.cause = error;
    throw wrapped;
  }

  if (response.status === 200) {
    return { revoked: true, reason: "provider_confirmed" };
  }
  if (response.status === 400) {
    return { revoked: false, reason: "provider_rejected" };
  }
  const error = new Error(`Google provider revocation returned HTTP ${response.status}`);
  error.code = "GOOGLE_PROVIDER_UNAVAILABLE";
  throw error;
}

module.exports = {
  GOOGLE_USERINFO_URL,
  GOOGLE_REVOKE_URL,
  revocationToken,
  verifyGoogleAccessToken,
  revokeGoogleGrant,
};
