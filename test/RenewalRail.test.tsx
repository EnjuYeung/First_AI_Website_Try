import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RenewalRail, { RenewalRailEvent } from '../components/RenewalRail';
import { Frequency, Subscription } from '../types';

const makeSubscription = (id: string, name: string, price: number): Subscription => ({
  id,
  name,
  price,
  currency: 'USD',
  frequency: Frequency.MONTHLY,
  category: 'Other',
  paymentMethod: 'Credit Card',
  status: 'active',
  startDate: '2026-08-14',
  nextBillingDate: '2026-08-14',
  notificationsEnabled: true,
});

describe('RenewalRail grouped event details', () => {
  it('opens grouped subscription details from the rail node without a count badge', () => {
    const events: RenewalRailEvent[] = [
      { sub: makeSubscription('one', 'Netflix', 15.49), date: new Date('2026-08-14T00:00:00Z'), cost: 15.49, state: 'pending' },
      { sub: makeSubscription('two', 'Claude Pro', 20), date: new Date('2026-08-14T00:00:00Z'), cost: 20, state: 'pending' },
    ];
    const { container } = render(
      <RenewalRail
        events={events}
        monthlyTotal={35.49}
        lang="en"
        timeZone="UTC"
        serverClock={{
          serverTimeMs: Date.parse('2026-08-12T00:00:00Z'),
          receivedAtMs: Date.now(),
        }}
      />,
    );

    expect(container.querySelector('.rail-count')).toBeNull();
    expect(screen.queryByRole('region', { name: 'View Details' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Netflix \+1.*View Details/ }));

    const details = screen.getByRole('region', { name: 'View Details' });
    expect(details.textContent).toContain('Netflix');
    expect(details.textContent).toContain('$15.49');
    expect(details.textContent).toContain('Claude Pro');
    expect(details.textContent).toContain('$20.00');

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('region', { name: 'View Details' })).toBeNull();
  });
});
