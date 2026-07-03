import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

import { createExchangeRate } from '../lib/exchangeRate.js';
import * as defaults from '../lib/defaults.js';

const createService = (dataEncryptionKey) =>
  createExchangeRate({ storage: {}, defaults, dataEncryptionKey });

test('exchange-rate API keys use authenticated encryption', async () => {
  const service = createService('test-encryption-key');
  const first = service.encryptApiKey('secret-api-key');
  const second = service.encryptApiKey('secret-api-key');

  assert.match(first, /^aesgcm-v1\./);
  assert.notEqual(first, second);
  assert.equal(await service.decryptApiKey(first), 'secret-api-key');
});

test('exchange-rate API key ciphertext rejects the wrong master key', async () => {
  const encrypted = createService('first-key').encryptApiKey('secret-api-key');
  await assert.rejects(() => createService('different-key').decryptApiKey(encrypted));
});

test('missing legacy keypair disables the legacy exchange-rate configuration without blocking startup', async () => {
  let userData = {
    subscriptions: [],
    notifications: [],
    settings: defaults.defaultSettings(),
  };
  userData.settings.exchangeRateApi = {
    enabled: true,
    encryptedKey: 'legacy-rsa-ciphertext',
    lastTestedAt: 123,
    lastRunAt0: 456,
    lastRunAt12: 789,
  };
  const storage = {
    loadUserData: async () => structuredClone(userData),
    updateUserData: async (_username, updater) => {
      userData = await updater(structuredClone(userData));
      return structuredClone(userData);
    },
  };
  const missingKeypair = path.join(
    os.tmpdir(),
    `subm-missing-keypair-${crypto.randomUUID()}.json`
  );
  const service = createExchangeRate({
    storage,
    defaults,
    dataEncryptionKey: 'test-encryption-key',
    legacyKeypairFile: missingKeypair,
  });

  await service.migrateLegacyKeyForUser('admin');

  assert.equal(userData.settings.exchangeRateApi.enabled, false);
  assert.equal(userData.settings.exchangeRateApi.encryptedKey, '');
  assert.equal(userData.settings.exchangeRateApi.lastTestedAt, 0);
  assert.equal(userData.settings.exchangeRateApi.lastRunAt0, 0);
  assert.equal(userData.settings.exchangeRateApi.lastRunAt12, 0);
});
