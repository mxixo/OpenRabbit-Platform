const assert = require('assert');

process.env.OPENRABBIT_TOKEN_ENCRYPTION_KEY = process.env.OPENRABBIT_TOKEN_ENCRYPTION_KEY || 'test-only-encryption-key';
process.env.OPENRABBIT_GATEWAY_APP_TOKEN = 'test-service-token';
process.env.GOOGLE_OAUTH_CLIENT_ID = '';
process.env.GOOGLE_OAUTH_CLIENT_SECRET = '';
process.env.HUBSPOT_OAUTH_CLIENT_ID = '';
process.env.HUBSPOT_OAUTH_CLIENT_SECRET = '';
process.env.GOOGLE_MAPS_BROWSER_KEY = '';
process.env.META_APP_ID = '';
process.env.META_APP_SECRET = '';
process.env.LINKEDIN_CLIENT_ID = '';
process.env.LINKEDIN_CLIENT_SECRET = '';
process.env.TIKTOK_CLIENT_KEY = '';
process.env.TIKTOK_CLIENT_SECRET = '';

const { server, providers, connectionState, liveSnapshot } = require('../services/connection-gateway/server-v5');

(async () => {
  assert.ok(Array.isArray(providers));
  for (const id of ['gmail','google-calendar','hubspot','meta','linkedin','tiktok']) {
    assert.ok(providers.some(provider => provider.id === id), `${id} provider must exist`);
  }
  const maps = providers.find(provider => provider.id === 'google-maps');
  assert.ok(maps && maps.platformCapability, 'Maps must be modeled as a platform capability');

  const state = await connectionState('test-user');
  for (const id of ['gmail','google-calendar','hubspot','meta','linkedin','tiktok']) {
    assert.strictEqual(state.find(item => item.id === id).connected, false);
  }
  assert.strictEqual(state.find(item => item.id === 'google-maps').available, false);
  const snapshot = await liveSnapshot('test-user');
  assert.strictEqual(snapshot.mail.connected, false);
  assert.strictEqual(snapshot.calendar.connected, false);
  assert.strictEqual(snapshot.crm.connected, false);
  assert.ok(snapshot.social);

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  try {
    const address = server.address();
    const base = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${base}/health`);
    assert.strictEqual(response.status, 200);
    const health = await response.json();
    assert.strictEqual(health.ok, true);
    assert.strictEqual(health.service, 'openrabbit-connection-gateway');
    assert.strictEqual(health.version, 5);
    assert.strictEqual(health.configured.accountAuth, true);

    const blocked = await fetch(`${base}/v1/live`);
    assert.strictEqual(blocked.status, 401, 'live provider data must require an OpenRabbit session');

    const service = await fetch(`${base}/v1/live`, {
      headers: { authorization: 'Bearer test-service-token', 'x-openrabbit-user': 'test-user' }
    });
    assert.strictEqual(service.status, 200, 'trusted internal service token should access live snapshot');
    const body = await service.json();
    assert.ok(body.generatedAt);
    assert.ok(body.mail && body.calendar && body.crm && body.social);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  console.log('connection-gateway.test.js: OK');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
