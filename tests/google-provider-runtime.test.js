const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openrabbit-google-runtime-'));
process.env.OPENRABBIT_GATEWAY_DATA_DIR = dataDir;
process.env.OPENRABBIT_TOKEN_ENCRYPTION_KEY = 'google-runtime-test-encryption-key';
process.env.OPENRABBIT_GATEWAY_APP_TOKEN = 'google-runtime-service-token';
process.env.GOOGLE_OAUTH_CLIENT_ID = 'google-runtime-client';
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'google-runtime-secret';

const originalFetch = global.fetch;
const base = require('../services/connection-gateway/server-v5');
const scopePolicy = require('../services/connection-gateway/google-scope-policy');

function fakeResponse(status, body = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() { return body; },
    async text() { return JSON.stringify(body); },
  };
}

(async () => {
  const user = 'runtime-test-user';
  const expiry = Date.now() + 60 * 60 * 1000;
  base.saveToken(user, 'gmail', {
    access_token: 'gmail-access',
    refresh_token: 'shared-refresh',
    scope: scopePolicy.GMAIL_READONLY,
    expires_at: expiry,
  });
  base.saveToken(user, 'google-calendar', {
    access_token: 'calendar-access',
    refresh_token: 'shared-refresh',
    scope: scopePolicy.CALENDAR_EVENTS_READONLY,
    expires_at: expiry,
  });

  let mode = 'verified';
  let revokeBody = null;
  global.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/auth/v1/user')) return fakeResponse(401, { error: 'not a user token' });
    if (target === 'https://openidconnect.googleapis.com/v1/userinfo') {
      if (mode === 'verified') {
        assert.ok(String(options.headers.authorization).startsWith('Bearer '));
        return fakeResponse(200, { sub: 'google-subject' });
      }
      if (mode === 'rejected') return fakeResponse(401, { error: 'invalid_token' });
      if (mode === 'unavailable') return fakeResponse(503, { error: 'unavailable' });
    }
    if (target === 'https://oauth2.googleapis.com/revoke') {
      revokeBody = String(options.body || '');
      return fakeResponse(200, {});
    }
    throw new Error(`unexpected fetch in google runtime test: ${target}`);
  };

  try {
    const verified = await base.verifyConnection(user, 'gmail');
    assert.strictEqual(verified.connected, true);
    assert.strictEqual(verified.verified, true);
    assert.strictEqual(verified.verificationState, 'provider_confirmed');
    assert.strictEqual(verified.capabilities.read, true);

    mode = 'rejected';
    const rejected = await base.verifyConnection(user, 'gmail');
    assert.strictEqual(rejected.connected, false, 'provider rejection must override stale local token presence');
    assert.strictEqual(rejected.verified, false);
    assert.strictEqual(rejected.verificationState, 'provider_rejected');

    mode = 'unavailable';
    const unavailable = await base.verifyConnection(user, 'gmail');
    assert.strictEqual(unavailable.connected, true, 'provider outage must not be mislabeled as revoked');
    assert.strictEqual(unavailable.verified, false);
    assert.strictEqual(unavailable.verificationState, 'provider_unavailable');

    await new Promise((resolve, reject) => {
      base.server.listen(0, '127.0.0.1', resolve);
      base.server.once('error', reject);
    });
    try {
      const address = base.server.address();
      const root = `http://127.0.0.1:${address.port}`;
      const response = await originalFetch(`${root}/v1/connections/gmail`, {
        method: 'DELETE',
        headers: {
          authorization: 'Bearer google-runtime-service-token',
          'x-openrabbit-user': user,
        },
      });
      assert.strictEqual(response.status, 200);
      const body = await response.json();
      assert.strictEqual(body.connected, false);
      assert.strictEqual(body.googleGrantRevoked, true);
      assert.strictEqual(body.revocationState, 'provider_confirmed');
      assert.strictEqual(new URLSearchParams(revokeBody).get('token'), 'shared-refresh');
      assert.strictEqual(base.getUserToken(user, 'gmail'), null, 'revocation must remove Gmail local state');
      assert.strictEqual(base.getUserToken(user, 'google-calendar'), null, 'Google project-wide revocation must remove sibling Calendar state');
    } finally {
      await new Promise(resolve => base.server.close(resolve));
    }
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(dataDir, { recursive: true, force: true });
  }

  console.log('google-provider-runtime.test.js: OK');
})().catch(error => {
  global.fetch = originalFetch;
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.error(error);
  process.exit(1);
});
