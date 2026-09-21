const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.SUPABASE_URL = '';
process.env.SUPABASE_PUBLISHABLE_KEY = '';
process.env.OPENRABBIT_GATEWAY_APP_TOKEN = 'test-service-token';
process.env.OPENRABBIT_TOKEN_ENCRYPTION_KEY = 'test-only-encryption-key';

const gateway = require('../services/connection-gateway/server-v5');

(async () => {
  assert.strictEqual(
    gateway.supabaseAuthConfigured,
    false,
    'fresh/unconfigured runtime must not inherit an implicit Supabase account boundary',
  );

  const originalFetch = global.fetch;
  let providerFetches = 0;
  global.fetch = async () => {
    providerFetches += 1;
    throw new Error('unconfigured Supabase auth must not make a provider request');
  };
  try {
    const unknownUser = await gateway.authenticate({
      headers: { authorization: 'Bearer customer-session-token' },
    });
    assert.strictEqual(unknownUser, null, 'customer auth must fail closed when Supabase is unconfigured');
    assert.strictEqual(providerFetches, 0, 'unconfigured customer auth must not call any implicit Supabase project');

    const service = await gateway.authenticate({
      headers: {
        authorization: 'Bearer test-service-token',
        'x-openrabbit-user': 'smoke-user',
      },
    });
    assert.deepStrictEqual(service, { mode: 'service', userId: 'smoke-user' });
    assert.strictEqual(providerFetches, 0, 'service-mode smoke tests must remain local when Supabase is unconfigured');
  } finally {
    global.fetch = originalFetch;
  }

  const gatewaySource = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'connection-gateway', 'server-v5.js'),
    'utf8',
  );
  const envExample = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');

  assert.doesNotMatch(gatewaySource, /djplmhglilcwqfotnjew/, 'gateway source must not hardcode the candidate production project');
  assert.doesNotMatch(envExample, /djplmhglilcwqfotnjew/, 'fresh-clone env template must not hardcode the candidate production project');
  assert.match(envExample, /^SUPABASE_URL=\s*$/m, 'Supabase URL must require explicit environment configuration');
  assert.match(envExample, /^SUPABASE_PUBLISHABLE_KEY=\s*$/m, 'Supabase publishable key must require explicit environment configuration');

  console.log('supabase-account-boundary.test.js: OK');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
