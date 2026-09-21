const assert = require('assert');

const truth = require('../services/connection-gateway/google-provider-truth');

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() { return body; },
  };
}

(async () => {
  {
    let call;
    const result = await truth.verifyGoogleAccessToken('access-secret', {
      fetchImpl: async (url, options) => {
        call = { url, options };
        return response(200, { sub: 'google-user-123', email: 'person@example.com' });
      },
    });
    assert.deepStrictEqual(result, { verified: true, reason: 'provider_confirmed' });
    assert.strictEqual(call.url, truth.GOOGLE_USERINFO_URL);
    assert.strictEqual(call.options.method, 'GET');
    assert.strictEqual(call.options.headers.authorization, 'Bearer access-secret');
    assert.ok(!JSON.stringify(result).includes('access-secret'));
    assert.ok(!JSON.stringify(result).includes('person@example.com'));
  }

  {
    const result = await truth.verifyGoogleAccessToken('revoked-secret', {
      fetchImpl: async () => response(401, { error: 'invalid_token' }),
    });
    assert.deepStrictEqual(result, { verified: false, reason: 'provider_rejected' });
  }

  {
    await assert.rejects(
      () => truth.verifyGoogleAccessToken('access-secret', {
        fetchImpl: async () => response(503, { error: 'unavailable' }),
      }),
      error => error.code === 'GOOGLE_PROVIDER_UNAVAILABLE' && !error.message.includes('access-secret'),
    );
  }

  {
    assert.strictEqual(
      truth.revocationToken({ access_token: 'access-secret', refresh_token: 'refresh-secret' }),
      'refresh-secret',
      'refresh token should be preferred so the durable grant is revoked',
    );
    assert.strictEqual(truth.revocationToken({ access_token: 'access-secret' }), 'access-secret');
    assert.throws(() => truth.revocationToken({}), /Google access token is required/);
  }

  {
    let call;
    const result = await truth.revokeGoogleGrant(
      { access_token: 'access-secret', refresh_token: 'refresh secret/+=' },
      {
        fetchImpl: async (url, options) => {
          call = { url, options };
          return response(200, {});
        },
      },
    );
    assert.deepStrictEqual(result, { revoked: true, reason: 'provider_confirmed' });
    assert.strictEqual(call.url, truth.GOOGLE_REVOKE_URL);
    assert.strictEqual(call.options.method, 'POST');
    assert.strictEqual(call.options.headers['content-type'], 'application/x-www-form-urlencoded');
    assert.strictEqual(new URLSearchParams(call.options.body).get('token'), 'refresh secret/+=');
    assert.ok(!JSON.stringify(result).includes('refresh secret/+='));
  }

  {
    const result = await truth.revokeGoogleGrant(
      { refresh_token: 'already-invalid' },
      { fetchImpl: async () => response(400, { error: 'invalid_token' }) },
    );
    assert.deepStrictEqual(result, { revoked: false, reason: 'provider_rejected' });
  }

  {
    await assert.rejects(
      () => truth.revokeGoogleGrant(
        { refresh_token: 'refresh-secret' },
        { fetchImpl: async () => { throw new Error('network down'); } },
      ),
      error => error.code === 'GOOGLE_PROVIDER_UNAVAILABLE' && !error.message.includes('refresh-secret'),
    );
  }

  console.log('google-provider-truth.test.js: OK');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
