import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

import { createAuth } from '../lib/auth.js';
import { registerAuthRoutes } from '../lib/routes/authRoutes.js';
import { assertStrongSecret, isStrongPassword } from '../lib/securityPolicy.js';

const response = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  setHeader(name, value) { this.headers[name] = value; },
  cookie() {},
  clearCookie() {},
});

test('credential policy rejects weak passwords and short secrets', () => {
  assert.equal(isStrongPassword('short'), false);
  assert.equal(isStrongPassword('Long-enough-Password-1!'), true);
  assert.throws(() => assertStrongSecret('JWT_SECRET', 'short'));
  assert.equal(assertStrongSecret('JWT_SECRET', 'x'.repeat(32)), 'x'.repeat(32));
});

test('password changes revoke existing JWTs', async () => {
  let credentials = {
    username: 'admin',
    passwordHash: bcrypt.hashSync('Old-password-1!', 4),
    tokenVersion: 0,
  };
  const storage = {
    loadCredentials: async () => credentials,
    saveCredentials: async (next) => { credentials = next; },
  };
  const auth = await createAuth({ jwtSecret: 'test-secret', storage });
  const oldToken = auth.signToken({ username: 'admin' });
  const before = response();
  auth.authMiddleware({ headers: { authorization: `Bearer ${oldToken}` } }, before, () => {
    before.body = 'passed';
  });
  assert.equal(before.body, 'passed');

  await auth.changeAdminPassword('New-password-2!');
  const after = response();
  auth.authMiddleware({ headers: { authorization: `Bearer ${oldToken}` } }, after, () => {
    after.body = 'passed';
  });
  assert.equal(after.statusCode, 401);
  assert.equal(after.body.message, 'Invalid token');
});

test('malformed cookie encoding does not crash authentication', async () => {
  const credentials = {
    username: 'admin',
    passwordHash: bcrypt.hashSync('Password-1!', 4),
    tokenVersion: 0,
  };
  const storage = {
    loadCredentials: async () => credentials,
    saveCredentials: async () => {},
  };
  const auth = await createAuth({ jwtSecret: 'test-secret', storage });
  const token = auth.signToken({ username: 'admin' });

  const valid = response();
  auth.authMiddleware(
    { headers: { cookie: `broken=%E0%A4%A; auth_token=${token}` } },
    valid,
    () => { valid.body = 'passed'; }
  );
  assert.equal(valid.body, 'passed');

  const invalid = response();
  assert.doesNotThrow(() => {
    auth.authMiddleware(
      { headers: { cookie: 'auth_token=%E0%A4%A' } },
      invalid,
      () => { invalid.body = 'passed'; }
    );
  });
  assert.equal(invalid.statusCode, 401);
  assert.equal(invalid.body.message, 'Invalid token');
});

test('login is rate limited and sensitive auth changes require stronger checks', async () => {
  const handlers = new Map();
  const app = {
    post(route, ...routeHandlers) { handlers.set(route, routeHandlers.at(-1)); },
    get() {},
  };
  const auth = {
    getAdminUsername: () => 'admin',
    verifyAdminPassword: async () => false,
    authMiddleware() {},
    clearAuthCookie() {},
  };
  registerAuthRoutes({ app, auth, storage: {} });

  const login = handlers.get('/api/login');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = response();
    await login({ body: { username: 'admin', password: 'wrong' }, socket: { remoteAddress: '127.0.0.1' } }, res);
    assert.equal(res.statusCode, 401);
  }
  const limited = response();
  await login({ body: { username: 'admin', password: 'wrong' }, socket: { remoteAddress: '127.0.0.1' } }, limited);
  assert.equal(limited.statusCode, 429);
  assert.ok(limited.headers['Retry-After']);

  auth.verifyAdminPassword = async () => true;
  auth.changeAdminPassword = async () => assert.fail('weak password must not be accepted');
  const changePassword = handlers.get('/api/change-password');
  const weak = response();
  await changePassword(
    { body: { currentPassword: 'current', newPassword: 'short' }, user: { username: 'admin' } },
    weak
  );
  assert.equal(weak.statusCode, 400);
  assert.equal(weak.body.message, 'weak_password');

  auth.verifyAdminPassword = async () => false;
  const initTwoFactor = handlers.get('/api/2fa/init');
  const reauth = response();
  await initTwoFactor(
    { body: {}, user: { username: 'admin' } },
    reauth
  );
  assert.equal(reauth.statusCode, 401);
  assert.equal(reauth.body.message, 'reauthentication_required');
});
