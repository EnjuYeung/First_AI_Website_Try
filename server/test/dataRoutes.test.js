import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

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
  assert.equal(savedSettings.theme, 'dark');
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
  assert.equal(savedSettings.theme, 'system');
  assert.equal('scheduledTask' in savedSettings.notifications, false);
});
