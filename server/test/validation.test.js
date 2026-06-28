import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateDataPatch,
  validateSettings,
  validateSubscriptions,
} from '../../shared/dataSchema.js';

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

const validSettings = {
  language: 'zh',
  timezone: 'Asia/Shanghai',
  theme: 'system',
  notifications: { rules: { reminderDays: 3 } },
};

test('validateDataPatch accepts a valid partial update', () => {
  assert.equal(validateDataPatch({ subscriptions: [validSubscription] }), null);
  assert.equal(validateDataPatch({ settings: validSettings }), null);
});

test('validateDataPatch rejects unknown fields and full malformed data', () => {
  assert.equal(validateDataPatch({ unknown: true }), 'invalid_patch_fields');
  assert.equal(validateDataPatch([]), 'invalid_payload');
});

test('validateSubscriptions rejects duplicate IDs and impossible dates', () => {
  assert.equal(
    validateSubscriptions([validSubscription, { ...validSubscription }]),
    'invalid_subscription_id'
  );
  assert.equal(
    validateSubscriptions([{ ...validSubscription, startDate: '2026-02-31' }]),
    'invalid_subscription_date'
  );
});

test('validateSettings bounds reminder days', () => {
  assert.equal(
    validateSettings({
      ...validSettings,
      notifications: { rules: { reminderDays: Number.NaN } },
    }),
    'invalid_reminder_days'
  );
  assert.equal(
    validateSettings({
      ...validSettings,
      notifications: { rules: { reminderDays: 366 } },
    }),
    'invalid_reminder_days'
  );
});
