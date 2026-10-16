import test from 'node:test';
import assert from 'node:assert/strict';
import { registerAuthRoutes } from '../lib/routes/authRoutes.js';

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const response = () => ({
  statusCode: 200, headers: {},
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  setHeader(name, value) { this.headers[name] = value; },
});
const request = (password = 'wrong', ip = '198.51.100.10', code) => ({
  ip, body: { username: 'admin', password, ...(code === undefined ? {} : { code }) },
});
const harness = (verifyPassword, security = {}, loadData) => {
  const handlers = new Map();
  const app = { post(route, ...callbacks) { handlers.set(route, callbacks.at(-1)); }, get() {} };
  registerAuthRoutes({ app,
    auth: { getAdminUsername: () => 'admin', verifyAdminPassword: verifyPassword,
      authMiddleware() {}, clearAuthCookie() {}, setAuthCookie() {}, signToken: () => 'synthetic-token' },
    storage: { loadUserData: loadData || (async () => ({ settings: { security } })) },
  });
  return async req => { const res = response(); await handlers.get('/api/login')(req, res); return res; };
};

test('parallel login guesses reserve the five attempts before password verification', async () => {
  const gate = deferred();
  let checks = 0;
  const login = harness(async () => { checks += 1; return gate.promise; });
  const pending = Array.from({ length: 20 }, () => login(request()));
  const admitted = checks;
  gate.resolve(false);
  const results = await Promise.all(pending);
  assert.equal(admitted, 5);
  assert.equal(results.filter(res => res.statusCode === 401).length, 5);
  assert.equal(results.filter(res => res.statusCode === 429).length, 15);
  assert.equal((await login(request())).statusCode, 429);
  assert.equal(checks, 5);
});

test('missing TOTP releases its reservation while wrong passwords and invalid TOTP share the limit', async () => {
  const login = harness(async value => value === 'correct', { twoFactorEnabled: true, twoFactorSecret: 'JBSWY3DPEHPK3PXP' });
  for (let index = 0; index < 8; index += 1) assert.equal((await login(request('correct'))).statusCode, 403);
  for (let index = 0; index < 3; index += 1) assert.equal((await login(request())).statusCode, 401);
  for (let index = 0; index < 2; index += 1) assert.equal((await login(request('correct', undefined, 'not-a-token'))).statusCode, 401);
  assert.equal((await login(request('correct'))).statusCode, 429);
});

test('a late failed attempt cannot reset the counter created after a successful login', async () => {
  const gate = deferred();
  const login = harness(async value => value === 'pending' ? gate.promise : value === 'correct');
  const oldFailure = login(request('pending'));
  assert.equal((await login(request('correct'))).statusCode, 200);
  for (let index = 0; index < 5; index += 1) assert.equal((await login(request())).statusCode, 401);
  gate.resolve(false);
  assert.equal((await oldFailure).statusCode, 401);
  assert.equal((await login(request())).statusCode, 429);
});

test('releasing a reservation from an expired window does not alter the replacement window', async (t) => {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  const gate = deferred();
  const login = harness(async value => value === 'pending' ? gate.promise : false,
    { twoFactorEnabled: true, twoFactorSecret: 'JBSWY3DPEHPK3PXP' });
  const oldAttempt = login(request('pending'));
  now += 15 * 60 * 1000 + 1;
  for (let index = 0; index < 5; index += 1) assert.equal((await login(request())).statusCode, 401);
  gate.resolve(true);
  assert.equal((await oldAttempt).statusCode, 403);
  assert.equal((await login(request())).statusCode, 429);
});

test('releasing an evicted reservation does not change a new counter for the same IP', async () => {
  const gate = deferred();
  const login = harness(async value => value === 'pending' ? gate.promise : false,
    { twoFactorEnabled: true, twoFactorSecret: 'JBSWY3DPEHPK3PXP' });
  const oldAttempt = login(request('pending'));
  for (let index = 0; index < 1000; index += 1) {
    const ip = `203.0.${Math.floor(index / 250)}.${index % 250}`;
    assert.equal((await login(request('wrong', ip))).statusCode, 401);
  }
  for (let index = 0; index < 5; index += 1) assert.equal((await login(request())).statusCode, 401);
  gate.resolve(true);
  assert.equal((await oldAttempt).statusCode, 403);
  assert.equal((await login(request())).statusCode, 429);
});

test('unexpected storage failures release reservations instead of locking out a valid user', async () => {
  let fail = true;
  const login = harness(async () => true, {}, async () => {
    if (fail) throw new Error('synthetic storage failure');
    return { settings: { security: {} } };
  });
  for (let index = 0; index < 6; index += 1) await assert.rejects(login(request('correct')), /storage failure/);
  fail = false;
  assert.equal((await login(request('correct'))).statusCode, 200);
});
