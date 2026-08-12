import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSettings, validateSubscriptions } from '../../shared/dataSchema.js';
import { createDefaultSettings } from '../../shared/defaultSettings.js';

const validSubscription = {
  id: 'sub-1',
  name: 'Example',
  price: 9.99,
  currency: 'USD',
  frequency: 'Monthly',
  category: 'Other',
  paymentMethod: 'Credit Card',
  status: 'active',
  startDate: '2026-01-01',
  nextBillingDate: '2026-02-01',
  notificationsEnabled: true,
};

const validSettings = createDefaultSettings();

test('validateSubscriptions rejects duplicate IDs and impossible dates', () => {
  assert.equal(
    validateSubscriptions([validSubscription, { ...validSubscription }]),
    'invalid_subscription_id'
  );
  assert.equal(
    validateSubscriptions([{ ...validSubscription, startDate: '2026-02-31' }]),
    'invalid_subscription_date'
  );
  assert.equal(
    validateSubscriptions([{ ...validSubscription, unexpected: true }]),
    'unknown_subscription_field'
  );
  assert.equal(
    validateSubscriptions([{ ...validSubscription, notes: 'x'.repeat(5001) }]),
    'invalid_subscription_notes'
  );
});

test('validateSettings bounds reminder days', () => {
  assert.equal(
    validateSettings({
      ...validSettings,
      notifications: {
        ...validSettings.notifications,
        rules: { ...validSettings.notifications.rules, reminderDays: Number.NaN },
      },
    }),
    'invalid_reminder_days'
  );
  assert.equal(
    validateSettings({
      ...validSettings,
      notifications: {
        ...validSettings.notifications,
        rules: { ...validSettings.notifications.rules, reminderDays: 366 },
      },
    }),
    'invalid_reminder_days'
  );
  assert.equal(validateSettings({ ...validSettings, unexpected: true }), 'unknown_settings_field');
  assert.equal(
    validateSettings({ ...validSettings, timezone: 'Not/A-Timezone' }),
    'invalid_timezone'
  );
  assert.equal(
    validateSettings({
      ...validSettings,
      wallpaper: { ...validSettings.wallpaper, url: 'javascript:alert(1)' },
    }),
    'invalid_wallpaper_settings'
  );
  assert.equal(
    validateSettings({
      ...validSettings,
      wallpaper: { ...validSettings.wallpaper, blur: 31 },
    }),
    'invalid_wallpaper_settings'
  );
  assert.equal(
    validateSettings({
      ...validSettings,
      wallpaper: { ...validSettings.wallpaper, panelOpacity: 34 },
    }),
    'invalid_wallpaper_settings'
  );
});
