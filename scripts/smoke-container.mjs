import assert from 'node:assert/strict';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:33001';
const securityHeaders = [
  'content-security-policy', 'referrer-policy', 'x-content-type-options',
  'x-frame-options', 'permissions-policy',
];
const get = async (route, status, cache, options = {}) => {
  const response = await fetch(new URL(route, baseUrl), {
    ...options, signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, status, route);
  for (const name of securityHeaders) assert.ok(response.headers.has(name), `${route}: ${name}`);
  if (cache) assert.ok(response.headers.get('cache-control')?.includes(cache), `${route}: cache`);
  return response;
};

const index = await (await get('/', 200, 'no-cache')).text();
assert.match(index, /<html/);
const script = /src="(\/assets\/[^"\s]+\.js)"/.exec(index)?.[1];
assert.ok(script, 'built frontend entry script');
const asset = await get(script, 200, 'immutable');
assert.match(asset.headers.get('content-type'), /javascript/);
assert.ok((await asset.text()).length > 0);
assert.equal(await (await get('/index.html', 200, 'no-cache')).text(), index);
assert.equal(await (await get('/subscriptions/smoke-check', 200, 'no-cache')).text(), index);
assert.equal(await (await get('/', 200, 'no-cache', { method: 'HEAD' })).text(), '');
await get('/assets/smoke-missing.js', 404, 'immutable');
await get('/api/smoke-missing', 404, 'private, no-store');
assert.deepEqual(await (await get('/api/health', 200, 'private, no-store')).json(), { status: 'ok' });
await get('/api/me', 401, 'private, no-store');
const redirect = await get('/api?smoke=1', 301, null, { redirect: 'manual' });
assert.equal(
  new URL(redirect.headers.get('location'), baseUrl).href,
  new URL('/api/?smoke=1', baseUrl).href,
);
console.log('Container HTTP smoke checks passed');
