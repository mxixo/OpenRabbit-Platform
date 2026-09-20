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
const scopePolicy = require('../services/connection-gateway/google-scope-policy');

function oauthScopes(authorizationUrl) {
  return new Set(new URL(authorizationUrl).searchParams.get('scope').split(/\s+/).filter(Boolean));
}

(async () => {
  for (const id of ['gmail','google-calendar','hubspot','meta','linkedin','tiktok','microsoft','google-maps']) {
    assert.ok(base.providers.some(provider => provider.id === id), `${id} provider must exist`);
  }
  const state = await base.connectionState('test-user');
  assert.strictEqual(state.find(item => item.id === 'gmail').connected, false);
  assert.strictEqual(state.find(item => item.id === 'google-calendar').connected, false);
  assert.strictEqual(state.find(item => item.id === 'hubspot').connected, false);

  assert.strictEqual(scopePolicy.canReadGmail({ scope: scopePolicy.GMAIL_READONLY }), true);
  assert.strictEqual(scopePolicy.canSendGmail({ scope: scopePolicy.GMAIL_READONLY }), false);
  assert.strictEqual(scopePolicy.canSendGmail({ scope: scopePolicy.GMAIL_SEND }), true);
  assert.strictEqual(scopePolicy.canReadCalendar({ scope: scopePolicy.CALENDAR_EVENTS_READONLY }), true);
  assert.strictEqual(scopePolicy.canCreateCalendarEvent({ scope: scopePolicy.CALENDAR_EVENTS_READONLY }), false);
  assert.strictEqual(scopePolicy.canCreateCalendarEvent({ scope: scopePolicy.CALENDAR_EVENTS }), true);
  assert.strictEqual(scopePolicy.canSendGmail({ access_token: 'token-with-unknown-scope' }), false, 'missing scope evidence must fail closed');

  // Initial Google consent is read-only. Write authority is requested only by an
  // explicit incremental capability upgrade, never simply because a provider is Connected.
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-google-client';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-google-secret';
  try {
    const gmailRead = new URL(base.googleStart('test-user', 'gmail'));
    const gmailReadScopes = oauthScopes(gmailRead.toString());
    assert.ok(gmailReadScopes.has(scopePolicy.GMAIL_READONLY));
    assert.ok(!gmailReadScopes.has(scopePolicy.GMAIL_SEND));
    assert.ok(!gmailReadScopes.has(scopePolicy.GMAIL_MODIFY));
    assert.strictEqual(gmailRead.searchParams.get('include_granted_scopes'), 'true');

    const gmailWrite = new URL(base.googleStart('test-user', 'gmail', 'mail.send'));
    const gmailWriteScopes = oauthScopes(gmailWrite.toString());
    assert.ok(gmailWriteScopes.has(scopePolicy.GMAIL_READONLY));
    assert.ok(gmailWriteScopes.has(scopePolicy.GMAIL_SEND));
    assert.ok(!gmailWriteScopes.has(scopePolicy.GMAIL_MODIFY));
    assert.strictEqual(gmailWrite.searchParams.get('include_granted_scopes'), 'true');

    const calendarRead = new URL(base.googleStart('test-user', 'calendar'));
    const calendarReadScopes = oauthScopes(calendarRead.toString());
    assert.ok(calendarReadScopes.has(scopePolicy.CALENDAR_EVENTS_READONLY));
    assert.ok(!calendarReadScopes.has(scopePolicy.CALENDAR_EVENTS));

    const calendarWrite = new URL(base.googleStart('test-user', 'calendar', 'calendar.write'));
    const calendarWriteScopes = oauthScopes(calendarWrite.toString());
    assert.ok(calendarWriteScopes.has(scopePolicy.CALENDAR_EVENTS_READONLY));
    assert.ok(calendarWriteScopes.has(scopePolicy.CALENDAR_EVENTS));

    assert.throws(() => base.googleStart('test-user', 'gmail', 'calendar.write'), /Unsupported Gmail authorization capability/);
    assert.throws(() => base.googleStart('test-user', 'calendar', 'mail.send'), /Unsupported Google Calendar authorization capability/);
  } finally {
    process.env.GOOGLE_OAUTH_CLIENT_ID = '';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = '';
  }

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
    assert.strictEqual(health.version, 7);
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

    const originalLiveToken = base.liveToken;
    try {
      base.liveToken = async (_uid, provider) => provider === 'gmail'
        ? { access_token: 'read-only-gmail', scope: scopePolicy.GMAIL_READONLY }
        : { access_token: 'read-only-calendar', scope: scopePolicy.CALENDAR_EVENTS_READONLY };

      const readOnlyGmailSend = await fetch(`${root}/v1/actions/send-email`, {
        method: 'POST',
        headers: { ...serviceHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'nobody@example.com', subject: 'scope test', body: 'scope test' }),
      });
      assert.strictEqual(readOnlyGmailSend.status, 409);
      const gmailDenied = await readOnlyGmailSend.json();
      assert.strictEqual(gmailDenied.error, 'ADDITIONAL_AUTHORIZATION_REQUIRED');
      assert.strictEqual(gmailDenied.requiredCapability, 'mail.send');

      const readOnlyCalendarCreate = await fetch(`${root}/v1/actions/create-calendar-event`, {
        method: 'POST',
        headers: { ...serviceHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ summary: 'scope test' }),
      });
      assert.strictEqual(readOnlyCalendarCreate.status, 409);
      const calendarDenied = await readOnlyCalendarCreate.json();
      assert.strictEqual(calendarDenied.error, 'ADDITIONAL_AUTHORIZATION_REQUIRED');
      assert.strictEqual(calendarDenied.requiredCapability, 'calendar.write');
    } finally {
      base.liveToken = originalLiveToken;
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  console.log('connection-gateway.test.js: OK');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
