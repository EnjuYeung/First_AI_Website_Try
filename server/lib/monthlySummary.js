import { addBillingCycleYMD } from '../../shared/billingDate.js';
import { formatDateInTimeZone } from './dates.js';

const FREQUENCY_LABELS = {
  Monthly: '月付',
  Quarterly: '季付',
  'Semi-Annually': '半年付',
  Yearly: '年付',
};

const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

export const previousMonthPeriod = (timeZone, now = new Date()) => {
  const current = formatDateInTimeZone(timeZone, now);
  const [currentYear, currentMonth] = current.split('-').map(Number);
  const monthIndex = currentYear * 12 + currentMonth - 2;
  const year = Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12 + 1;
  const monthText = String(month).padStart(2, '0');
  return {
    key: `${year}-${monthText}`,
    label: `${year}年${month}月`,
    start: `${year}-${monthText}-01`,
    end: `${year}-${monthText}-${String(daysInMonth(year, month)).padStart(2, '0')}`,
  };
};

const inPeriod = (ymd, period) => Boolean(ymd && ymd >= period.start && ymd <= period.end);

const toUsd = (amount, currency, rates) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) return 0;
  if (!currency || currency === 'USD') return value;
  const rate = Number(rates?.[currency]);
  return Number.isFinite(rate) && rate > 0 ? value / rate : value;
};

const billedAmountInPeriod = (subscription, period, rates) => {
  if (!subscription?.startDate) return 0;
  const cancellationEnd = subscription.cancelledAt || period.end;
  const effectiveEnd = cancellationEnd < period.end ? cancellationEnd : period.end;
  let billingDate = subscription.startDate;
  let total = 0;
  for (let iteration = 0; iteration < 5000 && billingDate <= effectiveEnd; iteration += 1) {
    if (billingDate >= period.start) {
      total += toUsd(subscription.price, subscription.currency, rates);
    }
    const next = addBillingCycleYMD(billingDate, subscription.frequency, subscription.startDate);
    if (!next || next <= billingDate) break;
    billingDate = next;
  }
  return total;
};

export const buildMonthlySummary = (subscriptions, settings, period) => {
  const list = Array.isArray(subscriptions) ? subscriptions : [];
  const additions = new Map();
  let cancelledSubscriptions = 0;
  let activeSubscriptions = 0;
  let totalPaidUsd = 0;

  for (const subscription of list) {
    totalPaidUsd += billedAmountInPeriod(subscription, period, settings?.exchangeRates);
    const activeAtPeriodEnd = subscription.cancelledAt
      ? subscription.cancelledAt > period.end
      : subscription.status !== 'cancelled';
    if (subscription.startDate <= period.end && activeAtPeriodEnd) {
      activeSubscriptions += 1;
    }
    if (inPeriod(subscription.createdAt, period)) {
      additions.set(subscription.frequency, (additions.get(subscription.frequency) || 0) + 1);
    }
    if (inPeriod(subscription.cancelledAt, period)) cancelledSubscriptions += 1;
  }

  const newSubscriptions = Object.keys(FREQUENCY_LABELS)
    .filter((frequency) => additions.get(frequency))
    .map((frequency) => `${FREQUENCY_LABELS[frequency]} ${additions.get(frequency)} 个`)
    .join('、');

  return {
    periodKey: period.key,
    month: period.label,
    totalPaidUsd: Math.round(totalPaidUsd * 100) / 100,
    activeSubscriptions,
    newSubscriptions,
    cancelledSubscriptions,
  };
};
