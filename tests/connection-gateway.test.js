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
process.env.MICROSOFT_CLIENT_ID = '';
process.env.MICROSOFT_CLIENT_SECRET = '';

const { server } = require('../services/connection-gateway/server-v6');
const base = require('../services/connection-gateway/server-v5');

(async () => {
  for (const id of ['gmail','google-calendar','hubspot','meta','linkedin','tiktok','microsoft','google-maps']) {
    assert.ok(base.providers.some(provider => provider.id === id), `${id} provider must exist`);
  }
  const state = await base.connectionState('test-user');
  assert.strictEqual(state.find(item => item.id === 'gmail').connected, false);
  assert.strictEqual(state.find(item => item.id === 'google-calendar').connected, false);
  assert.strictEqual(state.find(item => item.id === 'hubspot').connected, false);

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });
  try {
    const address = server.address();
    const root = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${root}/health`);
    assert.strictEqual(response.status, 200);
    const health = await response.json();
    assert.strictEqual(health.ok, true);
    assert.strictEqual(health.service, 'openrabbit-connection-gateway');
    assert.strictEqual(health.version, 6);
    assert.strictEqual(health.configured.microsoft, false);

    const blocked = await fetch(`${root}/v1/live`);
    assert.strictEqual(blocked.status, 401, 'live provider data must require an OpenRabbit session');

    const serviceHeaders = { authorization: 'Bearer test-service-token', 'x-openrabbit-user': 'test-user' };
    const connections = await fetch(`${root}/v1/connections`, { headers: serviceHeaders });
    assert.strictEqual(connections.status, 200);
    const connectionBody = await connections.json();
    const microsoft = connectionBody.connections.find(item => item.id === 'microsoft');
    assert.ok(microsoft, 'Microsoft connection state must be merged into v6');
    assert.strictEqual(microsoft.connected, false);
    assert.strictEqual(microsoft.planned, false);

    const live = await fetch(`${root}/v1/live`, { headers: serviceHeaders });
    assert.strictEqual(live.status, 200);
    const liveBody = await live.json();
    assert.ok(liveBody.generatedAt);
    assert.ok(liveBody.mail && liveBody.calendar && liveBody.crm && liveBody.social);
    assert.ok(liveBody.microsoft, 'v6 live snapshot must include Microsoft state');
    assert.strictEqual(liveBody.microsoft.connected, false);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  console.log('connection-gateway.test.js: OK');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
