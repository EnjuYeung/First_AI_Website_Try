import { describe, expect, it } from 'vitest';
import {
  advanceOverdueNextBillingDateYMD,
  rollForwardActiveSubscriptions,
} from '../shared/billingDate.js';

describe('overdue billing roll-forward', () => {
  it('keeps the billing day and advances only after it has passed', () => {
    expect(advanceOverdueNextBillingDateYMD('2026-01-01', 'Monthly', '2026-01-01', '2026-01-01'))
      .toBe('2026-01-01');
    expect(advanceOverdueNextBillingDateYMD('2026-01-01', 'Monthly', '2026-01-01', '2026-01-02'))
      .toBe('2026-02-01');
  });

  it('rolls only active overdue subscriptions', () => {
    const rolled = rollForwardActiveSubscriptions([
      {
        id: 'active',
        status: 'active',
        frequency: 'Monthly',
        startDate: '2026-01-01',
        nextBillingDate: '2026-01-01',
      },
      {
        id: 'cancelled',
        status: 'cancelled',
        frequency: 'Monthly',
        startDate: '2026-01-01',
        nextBillingDate: '2026-01-01',
      },
    ], '2026-01-02');

    expect(rolled[0].nextBillingDate).toBe('2026-02-01');
    expect(rolled[1].nextBillingDate).toBe('2026-01-01');
  });
});
