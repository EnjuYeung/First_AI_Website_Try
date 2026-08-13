import { addBillingCycleYMD, type BillingFrequency } from '../shared/billingDate.js';
import { Frequency, type Subscription } from '../types';

const MAX_BILLED_PERIODS = 12_000;

const isBillingFrequency = (value: string): value is BillingFrequency =>
  value === Frequency.MONTHLY ||
  value === Frequency.QUARTERLY ||
  value === Frequency.SEMI_ANNUALLY ||
  value === Frequency.YEARLY;

export const countBilledPeriods = (
  subscription: Pick<Subscription, 'startDate' | 'frequency' | 'status' | 'cancelledAt'>,
  todayYmd: string
): number => {
  const startDate = String(subscription.startDate || '').trim();
  const frequency = String(subscription.frequency || '');
  if (!startDate || !todayYmd || !isBillingFrequency(frequency) || startDate > todayYmd) {
    return 0;
  }

  let endDate = todayYmd;
  if (subscription.status === 'cancelled') {
    const cancelledAt = String(subscription.cancelledAt || '').trim();
    if (cancelledAt && cancelledAt < endDate) endDate = cancelledAt;
  }
  if (startDate > endDate) return 0;

  let billingDate = startDate;
  let periods = 0;
  while (billingDate <= endDate && periods < MAX_BILLED_PERIODS) {
    periods += 1;
    const next = addBillingCycleYMD(billingDate, frequency, startDate);
    if (!next || next <= billingDate) break;
    billingDate = next;
  }
  return periods;
};

export const getSubscriptionLifetime = (
  subscription: Pick<Subscription, 'price' | 'startDate' | 'frequency' | 'status' | 'cancelledAt'>,
  todayYmd: string
) => {
  const periods = countBilledPeriods(subscription, todayYmd);
  const unitPrice = Number.isFinite(subscription.price) ? subscription.price : 0;
  return {
    periods,
    spent: periods * unitPrice,
  };
};
