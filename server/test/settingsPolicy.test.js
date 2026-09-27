import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings } from '../lib/defaults.js';
import { applySettingsUpdate, clientSettings, settingsStateResult } from '../lib/settingsPolicy.js';
import { normalizeSettings } from '../../shared/settingsNormalization.js';

test('partial settings writes preserve sibling rules, credentials and server-owned state', () => {
  const current = defaultSettings();
  current.security.twoFactorSecret = 'private-totp';
  current.exchangeRateApi.encryptedKey = 'private-key';
  const next = applySettingsUpdate(current, {
    notifications: { rules: { monthlySummary: true, channels: { monthlySummary: ['email'] } } },
    security: { twoFactorEnabled: true }, exchangeRates: { USD: 999 }, language: 'en',
  }, 'UTC');
  assert.equal(next.notifications.rules.monthlySummary, true);
  assert.deepEqual(next.notifications.rules.channels.monthlySummary, ['email']);
  assert.deepEqual(next.notifications.rules.channels.renewalReminder, current.notifications.rules.channels.renewalReminder);
  assert.deepEqual(next.notifications.telegram, current.notifications.telegram);
  assert.equal(next.notifications.rules.template, current.notifications.rules.template);
  assert.equal(next.security.twoFactorEnabled, false);
  assert.equal(next.security.twoFactorSecret, 'private-totp');
  assert.equal(next.exchangeRateApi.encryptedKey, 'private-key');
  assert.equal(next.exchangeRates.USD, 1);
  assert.equal(next.language, current.language);
  assert.equal(next.timezone, 'UTC');
  assert.equal(current.notifications.rules.monthlySummary, false);
});

test('invalid nested patches and unknown top-level fields fail before persistence', () => {
  for (const patch of [null, [], { unknown: true }, { notifications: null }, { wallpaper: [] }, { notifications: { rules: { reminderDays: -1 } } }]) {
    assert.throws(() => applySettingsUpdate(defaultSettings(), patch, 'UTC'), error => error.statusCode === 400);
  }
});

test('all public settings projections strip private server material and carry committed revision', () => {
  const stored = defaultSettings();
  stored.security.twoFactorSecret = 'private-totp';
  stored.security.pendingTwoFactorSecret = 'pending-totp';
  stored.exchangeRateApi.encryptedKey = 'private-key';
  const result = settingsStateResult({ settings: stored, revisions: { settings: 17 } });
  assert.equal(result.revision, 17);
  assert.equal(result.settingsState.notifications, undefined);
  for (const projection of [result.settingsState, clientSettings(stored, 'UTC')]) {
    assert.equal(projection.security.twoFactorSecret, undefined);
    assert.equal(projection.security.pendingTwoFactorSecret, undefined);
    assert.equal(projection.exchangeRateApi.encryptedKey, undefined);
  }
});

test('shared normalization is immutable and keeps explicit empty user lists', () => {
  const incoming = { aiConfig: {}, currencyApi: {}, customCategories: [], customPaymentMethods: [], notifications: { rules: { channels: ['email'] } } };
  const before = structuredClone(incoming);
  const normalized = normalizeSettings(incoming, 'UTC');
  assert.deepEqual(incoming, before);
  assert.deepEqual(normalized.customCategories, []);
  assert.deepEqual(normalized.customPaymentMethods, []);
  assert.equal(normalized.aiConfig, undefined);
  assert.equal(normalized.currencyApi, undefined);
  assert.deepEqual(normalized.notifications.rules.channels, { renewalReminder: ['email'], monthlySummary: ['email'] });
});
