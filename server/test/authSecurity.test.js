import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';

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

test('failed password persistence keeps the committed password and tokens usable and does not poison later changes', async () => {
  let credentials = { username: 'admin', passwordHash: bcrypt.hashSync('Old-password-1!', 4), tokenVersion: 0 };
  let fail = true;
  const storage = {
    loadCredentials: async () => structuredClone(credentials),
    saveCredentials: async next => {
      if (fail) throw new Error('synthetic ENOSPC');
      credentials = structuredClone(next);
    },
  };
  const auth = await createAuth({ jwtSecret: 'test-secret', storage });
  const oldToken = auth.signToken({ username: 'admin' });
  await assert.rejects(auth.changeAdminPassword('New-password-2!'), /ENOSPC/);
  assert.equal(await auth.verifyAdminPassword('Old-password-1!'), true);
  assert.equal(await auth.verifyAdminPassword('New-password-2!'), false);
  const stillAuthenticated = response();
  auth.authMiddleware({ headers: { authorization: `Bearer ${oldToken}` } }, stillAuthenticated, () => { stillAuthenticated.body = 'passed'; });
  assert.equal(stillAuthenticated.body, 'passed');
  assert.equal(credentials.tokenVersion, 0);
  fail = false;
  await auth.changeAdminPassword('New-password-2!');
  assert.equal(credentials.tokenVersion, 1);
  assert.equal(await auth.verifyAdminPassword('New-password-2!'), true);
  const revoked = response();
  auth.authMiddleware({ headers: { authorization: `Bearer ${oldToken}` } }, revoked, () => assert.fail('old token must be revoked'));
  assert.equal(revoked.statusCode, 401);
});

test('overlapping password changes publish only persisted credentials and use consecutive token versions', async () => {
  let credentials = { username: 'admin', passwordHash: bcrypt.hashSync('Old-password-1!', 4), tokenVersion: 0 };
  let releaseFirst;
  let firstStarted;
  const firstWriteStarted = new Promise(resolve => { firstStarted = resolve; });
  const firstWriteGate = new Promise(resolve => { releaseFirst = resolve; });
  const writes = [];
  const storage = {
    loadCredentials: async () => structuredClone(credentials),
    saveCredentials: async next => {
      writes.push(next);
      if (writes.length === 1) {
        firstStarted();
        await firstWriteGate;
      }
      credentials = structuredClone(next);
    },
  };
  const auth = await createAuth({ jwtSecret: 'test-secret', storage });
  const first = auth.changeAdminPassword('First-password-1!');
  await firstWriteStarted;
  const second = auth.changeAdminPassword('Second-password-2!');
  assert.equal(await auth.verifyAdminPassword('Old-password-1!'), true);
  assert.equal(await auth.verifyAdminPassword('First-password-1!'), false);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(writes.map(value => value.tokenVersion), [1, 2]);
  assert.equal(credentials.tokenVersion, 2);
  assert.equal(await auth.verifyAdminPassword('Second-password-2!'), true);
  assert.equal(await bcrypt.compare('Second-password-2!', credentials.passwordHash), true);
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

const createLoginHarness = () => {
  const handlers = new Map();
  let passwordChecks = 0;
  const app = {
    post(route, ...routeHandlers) { handlers.set(route, routeHandlers.at(-1)); },
    get() {},
  };
  const auth = {
    getAdminUsername: () => 'admin',
    verifyAdminPassword: async () => { passwordChecks += 1; return false; },
    authMiddleware() {},
    clearAuthCookie() {},
  };
  registerAuthRoutes({ app, auth, storage: {} });
  return {
    login: handlers.get('/api/login'),
    passwordChecks: () => passwordChecks,
  };
};

const loginRequest = (ip, username = 'admin', extraBody = {}) => ({
  ip,
  socket: { remoteAddress: '172.20.0.2' },
  body: { username, password: 'wrong', ...extraBody },
});

test('login limiting keys attempts by the trusted client IP instead of the proxy socket', async () => {
  const { login } = createLoginHarness();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = response();
    await login(loginRequest('198.51.100.10'), res);
    assert.equal(res.statusCode, 401);
  }

  const otherClient = response();
  await login(loginRequest('198.51.100.11'), otherClient);
  assert.equal(otherClient.statusCode, 401);
});

test('login rejects oversized or unexpected fields before password verification', async () => {
  const { login, passwordChecks } = createLoginHarness();
  const emptyOptionalCode = response();
  await login(loginRequest('198.51.100.20', 'admin', { code: '' }), emptyOptionalCode);
  assert.equal(emptyOptionalCode.statusCode, 401);

  const oversizedUsername = response();
  await login(loginRequest('198.51.100.20', 'x'.repeat(129)), oversizedUsername);
  assert.equal(oversizedUsername.statusCode, 400);
  assert.equal(oversizedUsername.body.message, 'invalid_login_request');

  const oversizedKey = response();
  await login(loginRequest('198.51.100.20', 'admin', { ['x'.repeat(129)]: true }), oversizedKey);
  assert.equal(oversizedKey.statusCode, 400);
  assert.equal(oversizedKey.body.message, 'invalid_login_request');
  assert.equal(passwordChecks(), 1);
});

test('login limiter has a hard entry cap and evicts the oldest state', async () => {
  const { login } = createLoginHarness();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = response();
    await login(loginRequest('198.51.100.30'), res);
    assert.equal(res.statusCode, 401);
  }
  for (let index = 0; index < 1000; index += 1) {
    const res = response();
    await login(loginRequest(`203.0.${Math.floor(index / 250)}.${index % 250}`), res);
    assert.equal(res.statusCode, 401);
  }

  const evictedClient = response();
  await login(loginRequest('198.51.100.30'), evictedClient);
  assert.equal(evictedClient.statusCode, 401);
});

test('dedicated 2FA routes still initialize, verify, and disable TOTP', async () => {
  const handlers = new Map();
  const app = {
    post(route, ...routeHandlers) { handlers.set(route, routeHandlers.at(-1)); },
    get() {},
  };
  let data = {
    revisions: { settings: 1 },
    settings: {
      security: {
        twoFactorEnabled: false,
        twoFactorSecret: '',
        pendingTwoFactorSecret: '',
        lastPasswordChange: '2026-01-01T00:00:00.000Z',
      },
    },
  };
  const storage = {
    async loadUserData() { return structuredClone(data); },
    async updateUserData(_username, updater) {
      data = await updater(structuredClone(data));
      data.revisions.settings += 1;
      return structuredClone(data);
    },
  };
  const auth = {
    getAdminUsername: () => 'admin',
    verifyAdminPassword: async (password) => password === 'Current-password-1!',
    authMiddleware() {},
    clearAuthCookie() {},
  };
  registerAuthRoutes({ app, auth, storage });
  const request = (body) => ({ body, user: { username: 'admin' } });

  const initialized = response();
  await handlers.get('/api/2fa/init')(
    request({ currentPassword: 'Current-password-1!', code: '' }),
    initialized
  );
  assert.equal(initialized.statusCode, 200);
  assert.match(initialized.body.secret, /^[A-Z2-7]+$/);
  assert.equal(data.settings.security.pendingTwoFactorSecret, initialized.body.secret);

  const code = speakeasy.totp({ secret: initialized.body.secret, encoding: 'base32' });
  const verified = response();
  await handlers.get('/api/2fa/verify')(request({ code }), verified);
  assert.equal(verified.body.success, true);
  assert.equal(verified.body.revision, 3);
  assert.equal(verified.body.settingsState.security.twoFactorEnabled, true);
  assert.equal(verified.body.settingsState.security.twoFactorSecret, undefined);
  assert.equal(verified.body.settingsState.security.pendingTwoFactorSecret, undefined);
  assert.equal(data.settings.security.twoFactorEnabled, true);
  assert.equal(data.settings.security.twoFactorSecret, initialized.body.secret);
  assert.equal(data.settings.security.pendingTwoFactorSecret, '');

  const disabled = response();
  await handlers.get('/api/2fa/disable')(
    request({ currentPassword: 'Current-password-1!', code }),
    disabled
  );
  assert.equal(disabled.body.success, true);
  assert.equal(disabled.body.revision, 4);
  assert.equal(disabled.body.settingsState.security.twoFactorEnabled, false);
  assert.deepEqual(data.settings.security, {
    twoFactorEnabled: false,
    twoFactorSecret: '',
    pendingTwoFactorSecret: '',
    lastPasswordChange: '2026-01-01T00:00:00.000Z',
  });
});

test('password changes update the server-managed password-change timestamp', async () => {
  const handlers = new Map();
  const app = {
    post(route, ...routeHandlers) { handlers.set(route, routeHandlers.at(-1)); },
    get() {},
  };
  let data = {
    settings: {
      security: {
        twoFactorEnabled: false,
        twoFactorSecret: '',
        pendingTwoFactorSecret: '',
        lastPasswordChange: '2026-01-01T00:00:00.000Z',
      },
    },
  };
  let changedPassword = '';
  let cookieCleared = false;
  const storage = {
    async updateUserData(_username, updater) {
      data = await updater(structuredClone(data));
      return structuredClone(data);
    },
  };
  const auth = {
    getAdminUsername: () => 'admin',
    verifyAdminPassword: async (password) => password === 'Current-password-1!',
    changeAdminPassword: async (password) => { changedPassword = password; },
    authMiddleware() {},
    clearAuthCookie: () => { cookieCleared = true; },
  };
  registerAuthRoutes({ app, auth, storage });
  const res = response();

  await handlers.get('/api/change-password')(
    {
      body: {
        currentPassword: 'Current-password-1!',
        newPassword: 'Next-password-2!',
      },
      user: { username: 'admin' },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(changedPassword, 'Next-password-2!');
  assert.equal(cookieCleared, true);
  assert.equal(data.settings.security.lastPasswordChange, res.body.lastPasswordChange);
  assert.equal(Number.isFinite(Date.parse(res.body.lastPasswordChange)), true);
  assert.notEqual(res.body.lastPasswordChange, '2026-01-01T00:00:00.000Z');
});

test('password metadata failure does not report an already-committed password change as failed', async (t) => {
  t.mock.method(console, 'error', () => {});
  const handlers = new Map();
  const app = {
    post(route, ...routeHandlers) { handlers.set(route, routeHandlers.at(-1)); },
    get() {},
  };
  let changedPassword = '';
  let cookieCleared = false;
  const auth = {
    getAdminUsername: () => 'admin',
    verifyAdminPassword: async () => true,
    changeAdminPassword: async (password) => { changedPassword = password; },
    authMiddleware() {},
    clearAuthCookie: () => { cookieCleared = true; },
  };
  const storage = {
    async updateUserData() { throw new Error('metadata disk failure'); },
  };
  registerAuthRoutes({ app, auth, storage });
  const res = response();

  await handlers.get('/api/change-password')({
    body: {
      currentPassword: 'Current-password-1!',
      newPassword: 'Next-password-2!',
    },
    user: { username: 'admin' },
  }, res);

  assert.equal(changedPassword, 'Next-password-2!');
  assert.equal(cookieCleared, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});
