import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SubscriptionCostStack } from '../components/subscription/SubscriptionCostStack';
import { Frequency, Subscription } from '../types';

const subscription: Subscription = {
  id: 'sub-1',
  name: 'Example',
  price: 9.99,
  currency: 'USD',
  frequency: Frequency.MONTHLY,
  category: 'Other',
  paymentMethod: 'Credit Card',
  status: 'active',
  startDate: '2024-01-15',
  nextBillingDate: '2026-09-15',
  notificationsEnabled: true,
};

describe('SubscriptionCostStack', () => {
  it('sets distinct typefaces on the current and lifetime amounts', () => {
    render(
      <SubscriptionCostStack
        subscription={subscription}
        timezone="UTC"
        size="table"
        periodsLabel="{count} periods"
      />
    );

    const current = screen.getByText('$9.99');
    const lifetime = screen.getByText((content, element) => (
      element?.classList.contains('cost-lifetime') && content.startsWith('$')
    ));

    expect(current.className).toContain('cost-current');
    expect(current.className).toContain('data-value');
    expect(lifetime.className).toContain('cost-lifetime');
    expect(lifetime.className).not.toContain('data-value');
  });
});
