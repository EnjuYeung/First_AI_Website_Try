import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addBillingCycleYMD,
  advanceOverdueNextBillingDateYMD,
  calculateNextBillingDateYMD,
  rollForwardActiveSubscriptions,
} from '../../shared/billingDate.js';

test('billing cycles preserve the corresponding day', () => {
  assert.equal(addBillingCycleYMD('2026-01-01', 'Monthly'), '2026-02-01');
  assert.equal(addBillingCycleYMD('2026-01-01', 'Quarterly'), '2026-04-01');
  assert.equal(addBillingCycleYMD('2026-01-01', 'Semi-Annually'), '2026-07-01');
  assert.equal(addBillingCycleYMD('2026-01-01', 'Yearly'), '2027-01-01');
});

test('short February clamps to month end without losing the original day anchor', () => {
  assert.equal(addBillingCycleYMD('2026-01-31', 'Monthly', '2026-01-31'), '2026-02-28');
  assert.equal(addBillingCycleYMD('2026-02-28', 'Monthly', '2026-01-31'), '2026-03-31');
  assert.equal(addBillingCycleYMD('2024-01-31', 'Monthly', '2024-01-31'), '2024-02-29');
  assert.equal(addBillingCycleYMD('2025-11-30', 'Quarterly', '2025-11-30'), '2026-02-28');
  assert.equal(addBillingCycleYMD('2026-02-28', 'Quarterly', '2025-11-30'), '2026-05-30');
  assert.equal(addBillingCycleYMD('2025-08-31', 'Semi-Annually', '2025-08-31'), '2026-02-28');
  assert.equal(addBillingCycleYMD('2026-02-28', 'Semi-Annually', '2025-08-31'), '2026-08-31');
});

test('leap-day yearly subscriptions recover February 29 in leap years', () => {
  assert.equal(addBillingCycleYMD('2024-02-29', 'Yearly', '2024-02-29'), '2025-02-28');
  assert.equal(addBillingCycleYMD('2027-02-28', 'Yearly', '2024-02-29'), '2028-02-29');
});

test('next billing date does not drift after a short month', () => {
  assert.equal(
    calculateNextBillingDateYMD('2025-06-30', 'Monthly', '2026-07-03'),
    '2026-07-30'
  );
});

test('overdue next billing dates roll forward while the billing day itself is kept', () => {
  assert.equal(
    advanceOverdueNextBillingDateYMD('2026-01-01', 'Monthly', '2026-01-01', '2026-01-01'),
    '2026-01-01'
  );
  assert.equal(
    advanceOverdueNextBillingDateYMD('2026-01-01', 'Monthly', '2026-01-01', '2026-01-02'),
    '2026-02-01'
  );
  assert.equal(
    advanceOverdueNextBillingDateYMD('2026-01-01', 'Monthly', '2026-01-01', '2026-04-02'),
    '2026-05-01'
  );
  assert.equal(
    advanceOverdueNextBillingDateYMD('2026-01-01', 'Yearly', '2026-01-01', '2026-01-02'),
    '2027-01-01'
  );
});

test('active overdue subscriptions roll forward and cancelled ones stay put', () => {
  const active = {
    id: 'active',
    status: 'active',
    frequency: 'Monthly',
    startDate: '2026-01-01',
    nextBillingDate: '2026-01-01',
  };
  const cancelled = {
    id: 'cancelled',
    status: 'cancelled',
    frequency: 'Monthly',
    startDate: '2026-01-01',
    nextBillingDate: '2026-01-01',
  };
  const future = {
    id: 'future',
    status: 'active',
    frequency: 'Monthly',
    startDate: '2026-01-01',
    nextBillingDate: '2026-08-01',
  };
  const rolled = rollForwardActiveSubscriptions([active, cancelled, future], '2026-01-02');
  assert.equal(rolled[0].nextBillingDate, '2026-02-01');
  assert.equal(rolled[1].nextBillingDate, '2026-01-01');
  assert.equal(rolled[2].nextBillingDate, '2026-08-01');
});
