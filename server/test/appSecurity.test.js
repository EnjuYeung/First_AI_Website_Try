import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../lib/app.js';

const createTestApp = () => createApp({
  config: {
    allowedOrigins: ['http://localhost:3001', 'https://allowed.example'],
    trustProxy: 'loopback',
    jsonBodyLimit: '16kb',
    maxIconBytes: 1024,
    publicBaseUrl: '',
    debugTelegram: false,
  },
  auth: {
    getAdminUsername: () => 'admin',
    verifyAdminPassword: async () => false,
    authMiddleware() {},
    clearAuthCookie() {},
  },
  storage: {},
  exchangeRate: {},
});

const listen = async (app) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
};

test('CORS allows the Compose frontend origin and returns a controlled rejection otherwise', async (t) => {
  const { server, baseUrl } = await listen(createTestApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const compose = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'http://localhost:3001' },
  });
  assert.equal(compose.status, 200);
  assert.equal(compose.headers.get('access-control-allow-origin'), 'http://localhost:3001');

  const rejected = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://attacker.example' },
  });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get('content-type')?.startsWith('application/json'), true);
  assert.deepEqual(await rejected.json(), { message: 'cors_origin_denied' });
});

test('trusted proxy configuration lets login limiting distinguish forwarded client IPs', async (t) => {
  const { server, baseUrl } = await listen(createTestApp());
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const request = (ip) => fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Nginx appends the real peer to any untrusted value supplied by the
      // client. Express must stop at that first untrusted hop.
      'x-forwarded-for': `192.0.2.250, ${ip}`,
    },
    body: JSON.stringify({ username: 'admin', password: 'wrong' }),
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal((await request('198.51.100.40')).status, 401);
  }
  assert.equal((await request('198.51.100.41')).status, 401);
  assert.equal((await request('198.51.100.40')).status, 429);
});
