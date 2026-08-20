"use strict";

const http = require('http');
const crypto = require('crypto');

const port = Number(process.env.OPENRABBIT_CONNECTION_GATEWAY_PORT || 8790);
const host = process.env.OPENRABBIT_CONNECTION_GATEWAY_HOST || '127.0.0.1';
const publicBaseUrl = process.env.OPENRABBIT_CONNECTION_GATEWAY_PUBLIC_URL || `http://${host}:${port}`;

const providers = [
  { id: 'gmail', label: 'Gmail', category: 'mail', oauth: true, status: 'planned' },
  { id: 'google-calendar', label: 'Google Calendar', category: 'calendar', oauth: true, status: 'planned' },
  { id: 'hubspot', label: 'HubSpot', category: 'crm', oauth: true, status: 'planned' },
  { id: 'microsoft', label: 'Microsoft 365', category: 'mail-calendar', oauth: true, status: 'planned' },
  { id: 'meta', label: 'Meta / Instagram / Facebook', category: 'social', oauth: true, status: 'planned' },
  { id: 'linkedin', label: 'LinkedIn', category: 'social', oauth: true, status: 'planned' }
];

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store'
  });
  res.end(payload);
}

function requestId() {
  return crypto.randomBytes(12).toString('hex');
}

function route(req, res) {
  const id = requestId();
  const url = new URL(req.url, publicBaseUrl);

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'openrabbit-connection-gateway',
      version: 1,
      requestId: id
    });
  }

  if (req.method === 'GET' && url.pathname === '/v1/providers') {
    return json(res, 200, {
      providers,
      requestId: id
    });
  }

  if (url.pathname.startsWith('/v1/connections/') || url.pathname.startsWith('/oauth/')) {
    return json(res, 501, {
      error: 'CONNECTION_GATEWAY_NOT_CONFIGURED',
      message: 'OpenRabbit user authentication and encrypted server-side token storage must be configured before production OAuth routes are enabled.',
      requestId: id
    });
  }

  return json(res, 404, { error: 'NOT_FOUND', requestId: id });
}

const server = http.createServer((req, res) => {
  try {
    route(req, res);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: 'INTERNAL_ERROR', message: 'Connection gateway request failed.' });
  }
});

if (require.main === module) {
  server.listen(port, host, () => {
    console.log(`OpenRabbit Connection Gateway listening on ${publicBaseUrl}`);
  });
}

module.exports = { server, providers };
