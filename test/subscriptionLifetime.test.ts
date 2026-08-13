import { describe, expect, it } from 'vitest';
import { countBilledPeriods, getSubscriptionLifetime } from '../services/subscriptionLifetime';
import { Frequency } from '../types';

const base = {
  startDate: '2024-01-15',
  frequency: Frequency.MONTHLY,
  status: 'active' as const,
  price: 10,
};

describe('subscription lifetime', () => {
  it('counts inclusive billed cycles up to today and excludes the next bill', () => {
    expect(countBilledPeriods(base, '2024-01-14')).toBe(0);
    expect(countBilledPeriods(base, '2024-01-15')).toBe(1);
    expect(countBilledPeriods(base, '2024-02-14')).toBe(1);
    expect(countBilledPeriods(base, '2024-02-15')).toBe(2);
    expect(countBilledPeriods(base, '2025-01-15')).toBe(13);
  });

  it('stops at the cancellation date for cancelled subscriptions', () => {
    expect(countBilledPeriods({
      ...base,
      status: 'cancelled',
      cancelledAt: '2024-03-10',
    }, '2024-08-13')).toBe(2);
  });

  it('multiplies the current unit price by billed periods', () => {
    expect(getSubscriptionLifetime(base, '2024-03-15')).toEqual({
      periods: 3,
      spent: 30,
    });
  });

  it('walks yearly subscriptions by calendar anniversary', () => {
    expect(countBilledPeriods({
      ...base,
      frequency: Frequency.YEARLY,
    }, '2026-08-13')).toBe(3);
  });
});
