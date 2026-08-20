const assert = require('assert');

process.env.OPENRABBIT_TOKEN_ENCRYPTION_KEY = process.env.OPENRABBIT_TOKEN_ENCRYPTION_KEY || 'test-only-encryption-key';
process.env.OPENRABBIT_GATEWAY_APP_TOKEN = 'test-service-token';
process.env.GOOGLE_OAUTH_CLIENT_ID = '';
process.env.GOOGLE_OAUTH_CLIENT_SECRET = '';
process.env.HUBSPOT_OAUTH_CLIENT_ID = '';
process.env.HUBSPOT_OAUTH_CLIENT_SECRET = '';
process.env.GOOGLE_MAPS_BROWSER_KEY = '';

const { server, providers, connectionState } = require('../services/connection-gateway/server');

(async () => {
  assert.ok(Array.isArray(providers));
  assert.ok(providers.some(provider => provider.id === 'gmail'));
  assert.ok(providers.some(provider => provider.id === 'google-calendar'));
  assert.ok(providers.some(provider => provider.id === 'hubspot'));
  const maps = providers.find(provider => provider.id === 'google-maps');
  assert.ok(maps && maps.platformCapability, 'Maps must be modeled as a platform capability');

  const state = await connectionState('test-user');
  assert.strictEqual(state.find(item => item.id === 'gmail').connected, false);
  assert.strictEqual(state.find(item => item.id === 'google-calendar').connected, false);
  assert.strictEqual(state.find(item => item.id === 'hubspot').connected, false);
  assert.strictEqual(state.find(item => item.id === 'google-maps').available, false);

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
    assert.strictEqual(health.version, 4);
    assert.strictEqual(health.configured.accountAuth, true);

    const blocked = await fetch(`${base}/v1/connections`);
    assert.strictEqual(blocked.status, 401, 'connection state must require an OpenRabbit session');

    const service = await fetch(`${base}/v1/connections`, {
      headers: { authorization: 'Bearer test-service-token', 'x-openrabbit-user': 'test-user' }
    });
    assert.strictEqual(service.status, 200, 'trusted service token should remain available for internal tooling');
    const body = await service.json();
    assert.strictEqual(body.user, 'test-user');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  console.log('connection-gateway.test.js: OK');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
