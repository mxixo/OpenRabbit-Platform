import http from 'node:http';
import { CashAppClient } from './cashAppClient.js';

const port = Number(process.env.PORT || 8787);
const redirectUrl = process.env.CASH_APP_REDIRECT_URL || `http://localhost:${port}/cash-app/callback`;

const client = new CashAppClient({
  env: process.env.CASH_APP_ENV || 'sandbox',
  clientId: process.env.CASH_APP_CLIENT_ID,
  apiKeyId: process.env.CASH_APP_API_KEY_ID,
  apiKeySecret: process.env.CASH_APP_API_KEY_SECRET,
  region: process.env.CASH_APP_REGION || 'PDX',
});

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload, null, 2));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, connector: 'cash-app', env: client.env });
    }

    if (req.method === 'POST' && url.pathname === '/cash-app/connect') {
      let actions = [{ type: 'CHECKING_BALANCE' }];
      const body = await client.createCustomerRequest({
        actions,
        redirectUrl,
        referenceId: `openrabbit-${crypto.randomUUID()}`,
      });
      return json(res, 201, body);
    }

    if (req.method === 'GET' && url.pathname.startsWith('/cash-app/request/')) {
      const requestId = decodeURIComponent(url.pathname.split('/').pop());
      return json(res, 200, await client.retrieveCustomerRequest(requestId));
    }

    if (req.method === 'GET' && url.pathname === '/cash-app/callback') {
      return json(res, 200, {
        ok: true,
        message: 'Cash App returned to OpenRabbit. Persist the approved request/grant IDs here once partner credentials are active.',
        query: Object.fromEntries(url.searchParams.entries()),
      });
    }

    return json(res, 404, { error: 'not_found' });
  } catch (error) {
    return json(res, error.status || 500, {
      error: error.code || 'cash_app_connector_error',
      message: error.message,
      details: error.payload || undefined,
    });
  }
});

server.listen(port, () => {
  console.log(`OpenRabbit Cash App connector listening on http://localhost:${port}`);
});
