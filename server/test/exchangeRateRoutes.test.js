import test from 'node:test';
import assert from 'node:assert/strict';

import { registerExchangeRateRoutes } from '../lib/routes/exchangeRateRoutes.js';
import * as defaults from '../lib/defaults.js';

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test('testing an exchange-rate key validates first and commits the key and rates once', async () => {
  const handlers = new Map();
  const app = {
    post(path, _middleware, handler) {
      handlers.set(path, handler);
    },
  };
  let userData = {
    subscriptions: [],
    notifications: [],
    settings: defaults.defaultSettings(),
  };
  userData.settings.customCurrencies = [
    { code: 'USD', name: 'United States Dollar' },
    { code: 'CNY', name: 'Chinese Yuan' },
  ];
  let updateCount = 0;
  const storage = {
    async updateUserData(_username, updater) {
      updateCount += 1;
      userData = await updater(structuredClone(userData));
      return structuredClone(userData);
    },
  };
  const exchangeRate = {
    encryptApiKey(apiKey) {
      assert.equal(apiKey, 'valid-api-key');
      return 'aesgcm-v1.encrypted';
    },
    async fetchUsdRatesFromExchangeRateApi(apiKey) {
      assert.equal(apiKey, 'valid-api-key');
      return { USD: 1, CNY: 7.25 };
    },
  };
  registerExchangeRateRoutes({
    app,
    auth: { authMiddleware() {} },
    storage,
    exchangeRate,
  });

  const response = createResponse();
  await handlers.get('/api/exchange-rate/config')(
    {
      body: { apiKey: 'valid-api-key', test: true },
      user: { username: 'admin' },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(updateCount, 1);
  assert.equal(userData.settings.exchangeRateApi.encryptedKey, 'aesgcm-v1.encrypted');
  assert.equal(userData.settings.exchangeRateApi.enabled, true);
  assert.ok(userData.settings.exchangeRateApi.lastTestedAt > 0);
  assert.equal(userData.settings.exchangeRates.CNY, 7.25);
  assert.ok(userData.settings.lastRatesUpdate > 0);
});
