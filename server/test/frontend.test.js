import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { createApp } from '../lib/app.js';
import { createAuth } from '../lib/auth.js';
import { registerFrontend } from '../lib/frontend.js';

const entry = '<!doctype html><div id="root"></div><script src="/assets/test.abc123.js"></script>';
const jwtSecret = 'synthetic-http-policy-jwt-secret-0123456789';
const password = 'Synthetic-http-Password-1!';
const assertSecurityHeaders = (response) => {
  assert.ok(response.headers.has('content-security-policy'));
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('permissions-policy'), 'camera=(), geolocation=(), microphone=()');
};

const fixture = async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'subm-frontend-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, 'assets'));
  await fs.writeFile(path.join(directory, 'index.html'), entry);
  await fs.writeFile(path.join(directory, 'assets', 'test.abc123.js'), 'console.log("synthetic");');
  const storage = {
    loadCredentials: async () => ({ username: 'admin', passwordHash: await bcrypt.hash(password, 4), tokenVersion: 0 }),
    loadUserData: async () => ({ settings: { security: {} } }),
  };
  const auth = await createAuth({ jwtSecret, storage });
  const app = createApp({
    config: {
      allowedOrigins: ['https://allowed.example'],
      trustProxy: 'loopback, linklocal, uniquelocal',
      jsonBodyLimit: '1kb',
      maxIconBytes: 1024,
      maxWallpaperBytes: 2048,
    },
    auth,
    storage,
    exchangeRate: {},
    frontendDir: directory,
  });
  app.set('env', 'test');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, directory };
};

test('one application serves the entry, SPA paths and HEAD with revalidation and security headers', async (t) => {
  const { baseUrl } = await fixture(t);
  for (const route of ['/', '/index.html', '/subscriptions/example']) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    assert.match(response.headers.get('content-type'), /^text\/html/);
    assertSecurityHeaders(response);
    assert.equal(await response.text(), entry);
  }
  const head = await fetch(`${baseUrl}/subscriptions/example`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('cache-control'), 'no-cache');
  assert.equal(await head.text(), '');
});

test('assets use immutable caching, support revalidation and never fall back to SPA HTML', async (t) => {
  const { baseUrl } = await fixture(t);
  const response = await fetch(`${baseUrl}/assets/test.abc123.js`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assertSecurityHeaders(response);
  assert.match(await response.text(), /synthetic/);
  const cached = await fetch(`${baseUrl}/assets/test.abc123.js`, {
    headers: { 'if-none-match': response.headers.get('etag'), 'cache-control': 'max-age=0' },
  });
  assert.equal(cached.status, 304);
  assertSecurityHeaders(cached);
  const missing = await fetch(`${baseUrl}/assets/missing.js`);
  assert.equal(missing.status, 404);
  assertSecurityHeaders(missing);
  assert.match(missing.headers.get('cache-control'), /immutable/);
  assert.notEqual(await missing.text(), entry);
});

test('unknown API, uploads and unsupported frontend methods do not serve the SPA', async (t) => {
  const { baseUrl } = await fixture(t);
  for (const route of ['/api/not-a-route', '/API/not-a-route', '/api/uploads/synthetic-not-present.png']) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 404);
    assertSecurityHeaders(response);
    assert.notEqual(await response.text(), entry);
  }
  const post = await fetch(`${baseUrl}/subscriptions/example`, { method: 'POST' });
  assert.equal(post.status, 404);
  assert.notEqual(await post.text(), entry);
});

test('health and authenticated APIs keep private caching alongside the frontend', async (t) => {
  const { baseUrl } = await fixture(t);
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('cache-control'), 'private, no-store');
  assertSecurityHeaders(health);
  assert.deepEqual(await health.json(), { status: 'ok' });
  const anonymous = await fetch(`${baseUrl}/api/me`);
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.headers.get('cache-control'), 'private, no-store');
  assertSecurityHeaders(anonymous);
  const previousToken = jwt.sign({ username: 'admin', tokenVersion: 0 }, jwtSecret, {
    issuer: 'subm', audience: 'subm-web', expiresIn: '1h',
  });
  const existingSession = await fetch(`${baseUrl}/api/me`, {
    headers: { authorization: `Bearer ${previousToken}` },
  });
  assert.equal(existingSession.status, 200);
  assert.deepEqual(await existingSession.json(), { username: 'admin' });
});

test('bare API redirects preserve queries without swallowing the API root', async (t) => {
  const { baseUrl } = await fixture(t);
  const response = await fetch(`${baseUrl}/api?example=1`, { redirect: 'manual' });
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), '/api/?example=1');
  assertSecurityHeaders(response);
  assert.equal((await fetch(`${baseUrl}/api/`, { redirect: 'manual' })).status, 404);
});

test('JSON and CORS failures retain security headers while static files remain accessible', async (t) => {
  const { baseUrl } = await fixture(t);
  const malformed = await fetch(`${baseUrl}/api/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
  });
  assert.equal(malformed.status, 400);
  assertSecurityHeaders(malformed);
  const oversized = await fetch(`${baseUrl}/api/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value: 'x'.repeat(2048) }),
  });
  assert.equal(oversized.status, 413);
  assertSecurityHeaders(oversized);
  const denied = await fetch(`${baseUrl}/api/health`, { headers: { origin: 'https://attacker.example' } });
  assert.equal(denied.status, 403);
  assertSecurityHeaders(denied);
  const frontend = await fetch(baseUrl, { headers: { origin: 'https://attacker.example' } });
  assert.equal(frontend.status, 200);
});

test('a single proxy hop still enforces the real client bucket and issues Secure login cookies', async (t) => {
  const { baseUrl } = await fixture(t);
  const login = (forwardedFor, suppliedPassword) => fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': forwardedFor, 'x-forwarded-proto': 'https' },
    body: JSON.stringify({ username: 'admin', password: suppliedPassword }),
  });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal((await login(`192.0.2.${attempt + 1}, 198.51.100.40`, 'wrong')).status, 401);
  }
  assert.equal((await login('192.0.2.99, 198.51.100.40', 'wrong')).status, 429);
  const success = await login('192.0.2.99, 198.51.100.41', password);
  assert.equal(success.status, 200);
  assert.match(success.headers.get('set-cookie'), /; Secure/);
  assert.match(success.headers.get('set-cookie'), /; HttpOnly/);
  assert.match(success.headers.get('set-cookie'), /; SameSite=Lax/);
});

test('production frontend registration fails clearly if the build is missing', () => {
  assert.throws(() => registerFrontend(express(), {
    directory: path.join(os.tmpdir(), 'subm-build-that-does-not-exist'), required: true,
  }), /Frontend build missing/);
});
