import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
vi.mock('../components/RenewalRail', () => ({
  default: ({ monthlyTotal, events }: any) => <output data-testid="billing" data-paid={events.filter((event: any) => event.state === 'paid').length}>{monthlyTotal}</output>,
}));
import Dashboard from '../components/Dashboard';
import { getDefaultSettings } from '../services/storageService';
import { Frequency, Subscription } from '../types';

it('keeps an early renewed bill in the month total and classifies it as paid', () => {
  const sub: Subscription = {
    id: 'renewal', name: 'Example', price: 10, currency: 'USD', frequency: Frequency.MONTHLY,
    category: 'Other', paymentMethod: 'Credit Card', status: 'active', notificationsEnabled: true,
    startDate: '2026-09-12', nextBillingDate: '2026-10-12',
  };
  const settings = { ...getDefaultSettings(), timezone: 'UTC' };
  const serverClock = { serverTimeMs: Date.parse('2026-10-10T08:00:00Z'), receivedAtMs: Date.now() };
  const { rerender } = render(<Dashboard subscriptions={[sub]} settings={settings} serverClock={serverClock} lang="en" />);
  expect(screen.getByTestId('billing').textContent).toBe('10');
  expect(screen.getByTestId('billing').getAttribute('data-paid')).toBe('0');
  rerender(<Dashboard subscriptions={[{ ...sub, nextBillingDate: '2026-11-12' }]} settings={settings} serverClock={serverClock} lang="en" />);
  expect(screen.getByTestId('billing').textContent).toBe('10');
  expect(screen.getByTestId('billing').getAttribute('data-paid')).toBe('1');
});
