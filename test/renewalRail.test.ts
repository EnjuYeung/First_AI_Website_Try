import { describe, expect, it } from 'vitest';
import {
  assignRailLanes,
  getDaysInRailMonth,
  railPositionForDay,
  railPositionForInstant,
} from '../services/renewalRail';

describe('renewal rail positioning', () => {
  it('places midnight on the day tick and 08:00 one third toward the next tick', () => {
    const midnight = Date.parse('2026-08-01T00:00:00.000Z');
    const eightAm = Date.parse('2026-08-01T08:00:00.000Z');
    const daysInMonth = getDaysInRailMonth(midnight, 'UTC');
    const dayOne = railPositionForDay(1, daysInMonth);
    const dayTwo = railPositionForDay(2, daysInMonth);

    expect(railPositionForInstant(midnight, 'UTC')).toBe(dayOne);
    expect(
      (railPositionForInstant(eightAm, 'UTC') - dayOne) / (dayTwo - dayOne),
    ).toBeCloseTo(1 / 3, 8);
  });

  it('uses the configured timezone rather than the browser timezone', () => {
    const shanghaiMidnight = Date.parse('2026-07-31T16:00:00.000Z');
    const shanghaiEightAm = Date.parse('2026-08-01T00:00:00.000Z');
    const dayTwo = railPositionForDay(2, 31);

    expect(railPositionForInstant(shanghaiMidnight, 'Asia/Shanghai')).toBe(0);
    expect(railPositionForInstant(shanghaiEightAm, 'Asia/Shanghai')).toBeCloseTo(dayTwo / 3, 8);
  });

  it('cycles dense consecutive dates through three non-overlapping lanes', () => {
    expect(assignRailLanes([1, 2, 3, 4, 5, 6])).toEqual([0, 1, 2, 0, 1, 2]);
  });
});
