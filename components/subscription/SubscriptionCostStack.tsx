import React from 'react';
import { formatCurrency } from '../../services/currency';
import { getSubscriptionLifetime } from '../../services/subscriptionLifetime';
import { getTodayYMD } from '../../services/dateUtils';
import type { Subscription } from '../../types';

interface Props {
  subscription: Subscription;
  timezone: string;
  size: 'table' | 'grid';
  frequencySuffix?: string;
  periodsLabel: string;
}

export const SubscriptionCostStack: React.FC<Props> = ({
  subscription,
  timezone,
  size,
  frequencySuffix,
  periodsLabel,
}) => {
  const { periods, spent } = getSubscriptionLifetime(subscription, getTodayYMD(timezone));
  const cancelled = subscription.status === 'cancelled';

  return (
    <div className={`min-w-0 ${cancelled && size === 'grid' ? 'opacity-45' : ''}`}>
      <div className="flex min-w-0 items-baseline gap-2">
        <span
          className={`cost-current data-value font-medium text-[var(--ink)] ${
            size === 'grid' ? 'text-2xl' : 'text-[15px]'
          }`}
        >
          {formatCurrency(subscription.price, subscription.currency)}
        </span>
        {frequencySuffix ? (
          <span className="text-xs text-[var(--muted)]">/ {frequencySuffix}</span>
        ) : null}
      </div>
      <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11px] leading-tight">
        <span className="font-sans text-[var(--muted)]">{periodsLabel.replace('{count}', String(periods))}</span>
        <span className="text-[var(--muted)]" aria-hidden="true">·</span>
        <span className="cost-lifetime text-[var(--ink-soft)]">
          {formatCurrency(spent, subscription.currency)}
        </span>
      </div>
    </div>
  );
};
