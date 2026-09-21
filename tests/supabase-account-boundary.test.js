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

  const gatewayDir = path.join(__dirname, '..', 'services', 'connection-gateway');
  const legacyGateway = path.join(gatewayDir, 'server.js');
  assert.strictEqual(
    fs.existsSync(legacyGateway),
    false,
    'obsolete gateway runtimes with implicit production account fallbacks must not remain executable',
  );

  const gatewayRuntimeSources = fs.readdirSync(gatewayDir)
    .filter(name => name.endsWith('.js'))
    .map(name => fs.readFileSync(path.join(gatewayDir, name), 'utf8'))
    .join('\n');
  const envExample = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');
  const productionCompose = fs.readFileSync(
    path.join(__dirname, '..', 'deploy', 'vps', 'docker-compose.yml'),
    'utf8',
  );
  const deployWorkflow = fs.readFileSync(
    path.join(__dirname, '..', '.github', 'workflows', 'deploy-hostinger-vps.yml'),
    'utf8',
  );

  assert.doesNotMatch(
    gatewayRuntimeSources,
    /djplmhglilcwqfotnjew/,
    'no executable gateway runtime may hardcode the candidate production project',
  );
  assert.doesNotMatch(envExample, /djplmhglilcwqfotnjew/, 'fresh-clone env template must not hardcode the candidate production project');
  assert.match(envExample, /^SUPABASE_URL=\s*$/m, 'Supabase URL must require explicit environment configuration');
  assert.match(envExample, /^SUPABASE_PUBLISHABLE_KEY=\s*$/m, 'Supabase publishable key must require explicit environment configuration');
  assert.match(productionCompose, /^\s+SUPABASE_URL: \$\{SUPABASE_URL:-\}$/m, 'production compose must pass the explicit Supabase project URL');
  assert.match(productionCompose, /^\s+SUPABASE_PUBLISHABLE_KEY: \$\{SUPABASE_PUBLISHABLE_KEY:-\}$/m, 'production compose must pass the explicit Supabase publishable key');
  assert.match(deployWorkflow, /Require explicit production account boundary/, 'production deploy must gate on an explicit account boundary');
  assert.match(deployWorkflow, /SUPABASE_URL=\$\{\{ vars\.SUPABASE_URL \}\}/, 'Hostinger deploy must receive the explicit Supabase URL');
  assert.match(deployWorkflow, /SUPABASE_PUBLISHABLE_KEY=\$\{\{ secrets\.SUPABASE_PUBLISHABLE_KEY \}\}/, 'Hostinger deploy must receive the explicit Supabase publishable key');
  assert.match(deployWorkflow, /grep -q '\"version\":7'/, 'production health verification must target the current gateway v7');
  assert.doesNotMatch(deployWorkflow, /grep -q '\"version\":6'/, 'stale gateway v6 health checks must not block a healthy v7 deploy');

  console.log('supabase-account-boundary.test.js: OK');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
