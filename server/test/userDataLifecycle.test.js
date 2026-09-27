import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileUserData } from '../lib/userDataLifecycle.js';
import { defaultSettings } from '../lib/defaults.js';

test('one clock snapshot advances billing before feedback and applies retention without mutating input', () => {
  const now = new Date('2026-10-01T00:00:00Z');
  const incoming = {
    settings: defaultSettings(),
    subscriptions: [{ id: 'one', name: 'One', status: 'active', startDate: '2026-08-30', nextBillingDate: '2026-09-30', frequency: 'Monthly' }],
    notifications: [
      { id: 'pending', type: 'renewal_reminder', timestamp: now.getTime(), details: { date: '2026-09-30', subscriptionId: 'one', renewalFeedback: 'pending' } },
      { id: 'expired', type: 'monthly_summary', timestamp: now.getTime() - 91 * 86400000, details: {} },
    ],
  };
  const before = structuredClone(incoming);
  const result = reconcileUserData(incoming, 'UTC', now);
  assert.equal(result.subscriptions[0].nextBillingDate, '2026-10-30');
  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0].details.renewalFeedback, 'renewed');
  assert.equal(result.notifications[0].details.autoRenewed, true);
  assert.deepEqual(incoming, before);
  assert.deepEqual(reconcileUserData(result, 'UTC', now), result);
});
