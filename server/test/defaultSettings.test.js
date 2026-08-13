import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultSettings,
  normalizeExchangeRates,
} from '../../shared/defaultSettings.js';
import { defaultSettings } from '../lib/defaults.js';

test('server and shared code use the same default settings factory', () => {
  const shared = createDefaultSettings();
  const server = defaultSettings();
  shared.customCategories.push('Mutated');
  const freshServer = defaultSettings();
  assert.equal(server.security.lastPasswordChange, '1970-01-01T00:00:00.000Z');
  assert.deepEqual(server, freshServer);
  assert.notDeepEqual(shared.customCategories, server.customCategories);
});

test('legacy exchange-rate metadata is removed from settings', () => {
  assert.deepEqual(
    normalizeExchangeRates({
      USD: 1,
      CNY: 6.8,
      as_of: '2025-12-12 (approximate, not real-time)',
      INVALID: 0,
    }),
    { USD: 1, CNY: 6.8 }
  );
});
