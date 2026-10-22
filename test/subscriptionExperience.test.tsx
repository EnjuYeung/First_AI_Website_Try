import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SubscriptionDetails } from '../components/subscription/SubscriptionDetails';
import SpendingStats from '../components/SpendingStats';
import SubscriptionList from '../components/SubscriptionList';
import SubscriptionForm from '../components/SubscriptionForm';
import { getDefaultSettings } from '../services/storageService';
import { Frequency, Subscription } from '../types';
import { FilterMultiSelect } from '../components/ui/FilterMultiSelect';

const settings = { ...getDefaultSettings(), language: 'en' as const, timezone: 'UTC' };
const sub: Subscription = {
  id: 'music',
  name: 'Music',
  price: 10,
  currency: 'USD',
  frequency: Frequency.MONTHLY,
  category: 'Entertainment',
  paymentMethod: 'Credit Card',
  status: 'active',
  startDate: '2026-10-01',
  nextBillingDate: '2026-11-01',
  notificationsEnabled: false,
  url: 'https://example.com',
  notes: 'Keep my existing note.',
};

it('shows provider auto-renewal as unrecorded independently of status and reminder', () => {
  const onEdit = vi.fn();
  render(
    <SubscriptionDetails subscription={sub} settings={settings} onClose={vi.fn()} onEdit={onEdit} />
  );
  const dialog = screen.getByRole('dialog', { name: 'Music' });
  expect(within(dialog).getByText('Active')).toBeTruthy();
  expect(within(dialog).getByText('Off')).toBeTruthy();
  expect(within(dialog).getByText('Not recorded')).toBeTruthy();
  expect(within(dialog).queryByRole('switch')).toBeNull();
  expect(within(dialog).getByRole('link', { name: 'Visit service' }).getAttribute('href')).toBe(
    sub.url
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Edit Subscription' }));
  expect(onEdit).toHaveBeenCalledWith(sub);
});

it('uses calendar billing estimates and excludes unknown currency from chart totals', () => {
  const year: Subscription = {
    ...sub,
    id: 'year',
    name: 'Annual',
    price: 120,
    frequency: Frequency.YEARLY,
    startDate: '2025-10-19',
    nextBillingDate: '2026-10-19',
  };
  const quarter: Subscription = {
    ...sub,
    id: 'quarter',
    name: 'Quarterly',
    price: 5,
    currency: 'EUR',
    frequency: Frequency.QUARTERLY,
    startDate: '2026-10-05',
    nextBillingDate: '2027-01-05',
    category: 'Software',
  };
  const unknown: Subscription = {
    ...sub,
    id: 'unknown',
    name: 'Unknown currency',
    currency: 'GBP',
    price: 999,
  };
  render(
    <SpendingStats
      subscriptions={[sub, year, quarter, unknown]}
      settings={{ ...settings, exchangeRates: { USD: 1, EUR: 0.5 } }}
      lang="en"
      serverClock={{ serverTimeMs: Date.parse('2026-10-17T12:00:00Z'), receivedAtMs: Date.now() }}
    />
  );
  expect(screen.getByText('This month · estimated').closest('section')?.textContent).toContain(
    '$140.00'
  );
  expect(screen.getByText('This year · estimated').closest('section')?.textContent).toContain(
    '$160.00'
  );
  expect(screen.getByRole('status').textContent).toContain('1 subscriptions lack exchange rates');
  const categories = screen.getByRole('list', { name: 'Where your money goes' });
  expect(within(categories).getByText('$130.00')).toBeTruthy();
  expect(within(categories).getByText('$10.00')).toBeTruthy();
  expect(screen.getByText(/not a payment history/)).toBeTruthy();
});

it('opens a read-only detail action and confirms batch deletion of only the visible selection', async () => {
  const onView = vi.fn();
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onBatchDelete = vi.fn();
  render(
    <SubscriptionList
      subscriptions={[sub, { ...sub, id: 'cloud', name: 'Cloud' }]}
      notifications={[]}
      onView={onView}
      onEdit={onEdit}
      onDelete={onDelete}
      onDuplicate={vi.fn()}
      onBatchDelete={onBatchDelete}
      lang="en"
      exchangeRates={{ USD: 1 }}
      timezone="UTC"
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'View Details Music' }));
  expect(onView).toHaveBeenCalledWith(sub);
  expect(onEdit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search subscriptions...' }), {
    target: { value: 'Music' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Batch Delete (1)' }));
  expect(onBatchDelete).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));
  await waitFor(() => expect(onBatchDelete).toHaveBeenCalledWith(['music']));
  expect(onDelete).not.toHaveBeenCalled();
});

it('preserves optional fields and authoritative billing date when saving from the fixed action area', async () => {
  const onSave = vi.fn().mockResolvedValue(true);
  render(
    <SubscriptionForm
      isOpen
      onClose={vi.fn()}
      onSave={onSave}
      initialData={sub}
      settings={settings}
      lang="en"
    />
  );
  const optional = screen.getByText('Icon, link & notes').closest('details');
  expect(optional?.hasAttribute('open')).toBe(false);
  fireEvent.change(screen.getByLabelText('Service Name'), { target: { value: 'Updated Music' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0]).toMatchObject({
    name: 'Updated Music',
    notes: sub.notes,
    url: sub.url,
    nextBillingDate: sub.nextBillingDate,
    notificationsEnabled: false,
  });
});

it('keeps other selected records after removing one subscription', async () => {
  const Page = () => {
    const [subscriptions, setSubscriptions] = React.useState([
      sub,
      { ...sub, id: 'cloud', name: 'Cloud' },
    ]);
    return (
      <SubscriptionList
        subscriptions={subscriptions}
        notifications={[]}
        onEdit={vi.fn()}
        onDelete={(id) => setSubscriptions((current) => current.filter((item) => item.id !== id))}
        onDuplicate={vi.fn()}
        onBatchDelete={vi.fn()}
        lang="en"
        exchangeRates={{ USD: 1 }}
        timezone="UTC"
      />
    );
  };
  render(<Page />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
  const musicRow = screen.getByRole('button', { name: 'View Details Music' }).closest('tr')!;
  fireEvent.click(within(musicRow).getByRole('button', { name: 'Remove' }));
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'View Details Music' })).toBeNull()
  );
  expect((screen.getByRole('checkbox', { name: 'Select Cloud' }) as HTMLInputElement).checked).toBe(
    true
  );
});

it('supports arrow-key filter selection and returns focus on Escape', () => {
  const onChange = vi.fn();
  render(
    <FilterMultiSelect
      label="Category filter"
      options={[
        { value: 'music', label: 'Music' },
        { value: 'cloud', label: 'Cloud' },
      ]}
      selectedValues={[]}
      onChange={onChange}
      resetText="Reset"
    />
  );
  const trigger = screen.getByRole('button', { name: 'Category filter' });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(screen.getByRole('option', { name: 'Music' }));
  fireEvent.keyDown(document.activeElement!, { key: 'End' });
  expect(document.activeElement).toBe(screen.getByRole('option', { name: 'Cloud' }));
  fireEvent.click(document.activeElement!);
  expect(onChange).toHaveBeenCalledWith(['cloud']);
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
