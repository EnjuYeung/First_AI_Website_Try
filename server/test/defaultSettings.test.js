import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultSettings } from '../../shared/defaultSettings.js';
import { defaultSettings } from '../lib/defaults.js';

test('server and shared code use the same default settings factory', () => {
  const shared = createDefaultSettings();
  const server = defaultSettings();
  shared.customCategories.push('Mutated');
  assert.deepEqual(server, defaultSettings());
  assert.notDeepEqual(shared.customCategories, server.customCategories);
});
