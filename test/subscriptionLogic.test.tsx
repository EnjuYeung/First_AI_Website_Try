import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SubscriptionForm from '../components/SubscriptionForm';
import { getVisibleSelectedIds } from '../components/SubscriptionList';
import { matchesSubscriptionPriceRanges } from '../hooks/useSubscriptionFilters';
import { getDefaultSettings } from '../services/storageService';
import { daysUntilYMD, getTodayYMD } from '../services/dateUtils';
import { Frequency, Subscription } from '../types';

const subscription: Subscription = {
  id: 'sub-1',
  name: 'Example',
  price: 30,
  currency: 'CNY',
  frequency: Frequency.MONTHLY,
  category: 'Other',
  paymentMethod: 'Credit Card',
  status: 'active',
  startDate: '2020-01-15',
  nextBillingDate: '2026-12-15',
  notificationsEnabled: true,
};

describe('subscription UI logic', () => {
  it('uses converted USD values for price ranges', () => {
    expect(matchesSubscriptionPriceRanges(['low'], subscription, { USD: 1, CNY: 7.2 })).toBe(true);
    expect(matchesSubscriptionPriceRanges(['high'], subscription, { USD: 1, CNY: 7.2 })).toBe(false);
  });

  it('uses the configured timezone for calendar-day calculations', () => {
    const now = new Date('2026-07-11T16:30:00.000Z');
    expect(getTodayYMD('Asia/Shanghai', now)).toBe('2026-07-12');
    expect(daysUntilYMD('2026-07-12', 'Asia/Shanghai', now)).toBe(0);
    expect(daysUntilYMD('2026-07-12', 'America/Los_Angeles', now)).toBe(1);
  });

  it('limits batch deletion to selected subscriptions that are still visible', () => {
    const selected = new Set(['visible', 'hidden']);
    expect(getVisibleSelectedIds([{ id: 'visible' }], selected)).toEqual(['visible']);
  });

  it('preserves an authoritative next billing date when an existing record is only opened and saved', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <SubscriptionForm
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
        initialData={subscription}
        settings={getDefaultSettings()}
        lang="en"
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].nextBillingDate).toBe('2026-12-15');
  });

  it('does not reset an open draft when refreshed settings receive new array identities', async () => {
    const settings = getDefaultSettings();
    const props = {
      isOpen: true,
      onClose: vi.fn(),
      onSave: vi.fn().mockResolvedValue(true),
      initialData: subscription,
      lang: 'en' as const,
    };
    const { rerender } = render(<SubscriptionForm {...props} settings={settings} />);
    const name = await screen.findByDisplayValue('Example');
    fireEvent.change(name, { target: { value: 'Unsaved draft' } });

    rerender(
      <SubscriptionForm
        {...props}
        initialData={{ ...subscription }}
        settings={{
          ...settings,
          customCategories: [...settings.customCategories],
          customPaymentMethods: [...settings.customPaymentMethods],
        }}
      />
    );

    expect(screen.getByDisplayValue('Unsaved draft')).toBeTruthy();
  });

  it('keeps the form open and reports an error when persistence fails', async () => {
    const onClose = vi.fn();
    render(
      <SubscriptionForm
        isOpen
        onClose={onClose}
        onSave={vi.fn().mockResolvedValue(false)}
        initialData={subscription}
        settings={getDefaultSettings()}
        lang="en"
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Save failed');
    expect(onClose).not.toHaveBeenCalled();
  });
});
