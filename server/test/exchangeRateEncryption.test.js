import test from 'node:test';
import assert from 'node:assert/strict';

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
