import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import { registerDataRoutes } from '../lib/routes/dataRoutes.js';
import * as defaults from '../lib/defaults.js';

const createResponse = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  setHeader(name, value) {
    this.headers[name] = value;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const createRouteHarness = (storage, directory = 'subm-data-routes-test') => {
  const handlers = new Map();
  const app = {};
  for (const method of ['get', 'post', 'put', 'delete']) {
    app[method] = (route, ...callbacks) => {
      handlers.set(`${method.toUpperCase()} ${route}`, callbacks.at(-1));
    };
  }
  registerDataRoutes({
    app,
    auth: { authMiddleware() {} },
    storage,
    uploadsDir: path.join(os.tmpdir(), directory),
    maxIconBytes: 1024,
  });
  return handlers;
};

test('a post-commit icon cleanup failure does not turn a committed update into a 500', async (t) => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(fs, 'unlink', async () => {
    const error = new Error('permission denied');
    error.code = 'EPERM';
    throw error;
  });
  const existing = {
    id: 'sub-1',
    name: 'Example',
    price: 10,
    currency: 'USD',
    frequency: 'Monthly',
    category: 'Other',
    paymentMethod: 'Credit Card',
    status: 'active',
    startDate: '2026-01-01',
    nextBillingDate: '2026-08-01',
    iconUrl: '/api/uploads/00000000-0000-4000-8000-000000000001.png',
    notificationsEnabled: true,
  };
  let persisted;
  const handlers = createRouteHarness({
    async updateUserFeature(_username, feature, revision, updater) {
      assert.equal(feature, 'subscriptions');
      assert.equal(revision, 1);
      persisted = await updater([structuredClone(existing)]);
      return { data: persisted, revision: 2 };
    },
  }, 'subm-data-routes-cleanup-test');
  const updated = { ...existing };
  delete updated.iconUrl;
  const response = createResponse();

  await handlers.get('PUT /api/subscriptions/:id')({
    body: updated,
    params: { id: existing.id },
    user: { username: 'admin' },
    get: (name) => name.toLowerCase() === 'if-match' ? '"1"' : '',
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.revision, 2);
  assert.equal(persisted[0].iconUrl, undefined);
});

test('data responses expose 2FA status without exposing TOTP seeds', async () => {
  const stored = defaults.defaultUserData();
  stored.settings.security = {
    twoFactorEnabled: true,
    twoFactorSecret: 'ACTIVE-TOTP-SEED',
    pendingTwoFactorSecret: 'PENDING-TOTP-SEED',
    lastPasswordChange: '2026-01-01T00:00:00.000Z',
  };
  stored.revisions = { subscriptions: 1, settings: 2, notifications: 3 };
  const handlers = createRouteHarness({
    async loadUserData(username) {
      assert.equal(username, 'admin');
      return stored;
    },
  }, 'subm-data-routes-redaction-test');

  const response = createResponse();
  await handlers.get('GET /api/data')({ user: { username: 'admin' } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.settings.security, {
    twoFactorEnabled: true,
    lastPasswordChange: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(stored.settings.security.twoFactorSecret, 'ACTIVE-TOTP-SEED');
  assert.equal(stored.settings.security.pendingTwoFactorSecret, 'PENDING-TOTP-SEED');
});

test('general settings updates cannot modify or return server-managed 2FA fields', async () => {
  const currentSettings = defaults.defaultSettings();
  currentSettings.security = {
    twoFactorEnabled: true,
    twoFactorSecret: 'ACTIVE-TOTP-SEED',
    pendingTwoFactorSecret: 'PENDING-TOTP-SEED',
    lastPasswordChange: '2026-01-01T00:00:00.000Z',
  };
  let savedSettings;
  const handlers = createRouteHarness({
    async updateUserFeature(_username, feature, revision, updater) {
      assert.equal(feature, 'settings');
      assert.equal(revision, 4);
      savedSettings = await updater(structuredClone(currentSettings));
      return { data: savedSettings, revision: 5 };
    },
  }, 'subm-data-routes-security-test');
  const incoming = defaults.defaultSettings();
  incoming.timezone = 'UTC';
  incoming.security = {
    twoFactorEnabled: false,
    twoFactorSecret: '',
    pendingTwoFactorSecret: '',
    lastPasswordChange: 'attacker-controlled',
  };
  const response = createResponse();

  await handlers.get('PUT /api/settings')(
    {
      body: incoming,
      user: { username: 'admin' },
      get: (name) => name.toLowerCase() === 'if-match' ? '"4"' : '',
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(savedSettings.timezone, 'UTC');
  assert.deepEqual(savedSettings.security, currentSettings.security);
  assert.deepEqual(response.body.data.security, {
    twoFactorEnabled: true,
    lastPasswordChange: '2026-01-01T00:00:00.000Z',
  });
});

test('general settings updates preserve server-managed exchange-rate state', async () => {
  const handlers = new Map();
  const app = {};
  for (const method of ['get', 'post', 'put', 'delete']) {
    app[method] = (route, ...callbacks) => {
      handlers.set(`${method.toUpperCase()} ${route}`, callbacks.at(-1));
    };
  }

  const currentSettings = defaults.defaultSettings();
  currentSettings.exchangeRateApi = {
    enabled: true,
    encryptedKey: 'aesgcm-v1.server-managed',
    lastTestedAt: 100,
    lastRunAt0: 200,
    lastRunAt12: 300,
  };
  currentSettings.exchangeRates = { USD: 1, CNY: 7.25 };
  currentSettings.lastRatesUpdate = 400;
  let savedSettings;
  const storage = {
    async updateUserFeature(_username, feature, revision, updater) {
      assert.equal(feature, 'settings');
      assert.equal(revision, 1);
      savedSettings = await updater(structuredClone(currentSettings));
      return { data: savedSettings, revision: 2 };
    },
  };
  registerDataRoutes({
    app,
    auth: { authMiddleware() {} },
    storage,
    uploadsDir: path.join(os.tmpdir(), 'subm-data-routes-test'),
    maxIconBytes: 1024,
  });

  const incoming = defaults.defaultSettings();
  incoming.theme = 'dark';
  incoming.exchangeRateApi = {
    enabled: false,
    encryptedKey: 'legacy-stale-client-value',
    lastTestedAt: 0,
    lastRunAt0: 0,
    lastRunAt12: 0,
  };
  incoming.exchangeRates = {
    USD: 1,
    as_of: '2025-12-12 (approximate, not real-time)',
  };
  incoming.lastRatesUpdate = 0;
  const response = createResponse();
  await handlers.get('PUT /api/settings')(
    {
      body: incoming,
      user: { username: 'admin' },
      get(name) {
        return name.toLowerCase() === 'if-match' ? '"1"' : '';
      },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(savedSettings.theme, currentSettings.theme);
  assert.deepEqual(savedSettings.exchangeRateApi, currentSettings.exchangeRateApi);
  assert.deepEqual(savedSettings.exchangeRates, currentSettings.exchangeRates);
  assert.equal(savedSettings.lastRatesUpdate, currentSettings.lastRatesUpdate);
});

test('settings updates discard the legacy notification scheduled task', async () => {
  const handlers = new Map();
  const app = {};
  for (const method of ['get', 'post', 'put', 'delete']) {
    app[method] = (route, ...callbacks) => {
      handlers.set(`${method.toUpperCase()} ${route}`, callbacks.at(-1));
    };
  }

  const currentSettings = defaults.defaultSettings();
  let savedSettings;
  const storage = {
    async updateUserFeature(_username, feature, revision, updater) {
      assert.equal(feature, 'settings');
      assert.equal(revision, 1);
      savedSettings = await updater(structuredClone(currentSettings));
      return { data: savedSettings, revision: 2 };
    },
  };
  registerDataRoutes({
    app,
    auth: { authMiddleware() {} },
    storage,
    uploadsDir: path.join(os.tmpdir(), 'subm-data-routes-legacy-settings-test'),
    maxIconBytes: 1024,
  });

  const incoming = defaults.defaultSettings();
  incoming.theme = 'system';
  incoming.notifications.scheduledTask = { enabled: true };
  const response = createResponse();
  await handlers.get('PUT /api/settings')(
    {
      body: incoming,
      user: { username: 'admin' },
      get(name) {
        return name.toLowerCase() === 'if-match' ? '"1"' : '';
      },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(savedSettings.theme, currentSettings.theme);
  assert.equal('scheduledTask' in savedSettings.notifications, false);
});
