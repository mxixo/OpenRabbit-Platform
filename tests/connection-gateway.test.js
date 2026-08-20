const assert = require('assert');

process.env.OPENRABBIT_TOKEN_ENCRYPTION_KEY = process.env.OPENRABBIT_TOKEN_ENCRYPTION_KEY || 'test-only-encryption-key';
process.env.OPENRABBIT_GATEWAY_APP_TOKEN = '';
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
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.strictEqual(response.status, 200);
    const health = await response.json();
    assert.strictEqual(health.ok, true);
    assert.strictEqual(health.service, 'openrabbit-connection-gateway');
    assert.strictEqual(health.version, 3);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  console.log('connection-gateway.test.js: OK');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
