import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_REMINDER_TEMPLATE_STRING,
  normalizeReminderTemplateString,
  renderReminderTemplate,
} from '../../shared/reminderTemplate.js';

test('normalizeReminderTemplateString falls back on invalid JSON', () => {
  assert.equal(normalizeReminderTemplateString('not-json'), DEFAULT_REMINDER_TEMPLATE_STRING);
});

test('renderReminderTemplate replaces tokens', () => {
  const msg = renderReminderTemplate(DEFAULT_REMINDER_TEMPLATE_STRING, {
    name: 'Netflix',
    nextBillingDate: '2099-01-01',
    price: 9.99,
    currency: 'USD',
    paymentMethod: 'Credit Card',
  });
  assert.match(msg, /Netflix/);
  assert.match(msg, /2099-01-01/);
  assert.match(msg, /9\.99/);
  assert.match(msg, /USD/);
});

