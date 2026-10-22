import { useMemo } from 'react';
import type { AppSettings, ServerClock, Subscription } from '../types';
import type { RenewalRailEvent } from '../components/RenewalRail';
import { formatLocalYMD, getTodayYMD, parseLocalYMD } from '../services/dateUtils';
import { addBillingCycleYMD } from '../shared/billingDate.js';
import { convertToUSD } from '../services/currency';

export interface BillingEvent {
  sub: Subscription;
  date: Date;
  cost: number;
}

export interface DashboardStats {
  unconvertedCount: number;
  monthlyPaid: number;
  monthlyPending: number;
  yearlyPaid: number;
  yearlyPending: number;
  activeCount: number;
  cancelledCount: number;
  recentPayments: BillingEvent[];
  upcomingRenewals: BillingEvent[];
  monthlyEvents: RenewalRailEvent[];
}

export const useDashboardStats = (
  subscriptions: Subscription[],
  settings: AppSettings,
  serverClock: ServerClock
): DashboardStats => {
  const serverNow = new Date(
    serverClock.serverTimeMs + Math.max(0, Date.now() - serverClock.receivedAtMs)
  );
  const serverTodayYmd = getTodayYMD(settings.timezone, serverNow);

  return useMemo(() => {
    const today = parseLocalYMD(serverTodayYmd);
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);
    const last7DaysStart = new Date(today);
    last7DaysStart.setDate(today.getDate() - 7);
    const next7DaysEnd = new Date(today);
    next7DaysEnd.setDate(today.getDate() + 7);

    const stats: DashboardStats = {
      unconvertedCount: 0,
      monthlyPaid: 0,
      monthlyPending: 0,
      yearlyPaid: 0,
      yearlyPending: 0,
      activeCount: 0,
      cancelledCount: 0,
      recentPayments: [],
      upcomingRenewals: [],
      monthlyEvents: [],
    };

    const MAX_ITERATIONS = 5000;

    for (const sub of subscriptions) {
      const isCancelled = sub.status === 'cancelled';
      if (isCancelled) stats.cancelledCount += 1;
      else stats.activeCount += 1;
      if (!sub.startDate) continue;

      const usdCost = convertToUSD(sub.price, sub.currency, settings.exchangeRates);
      if (usdCost === null) stats.unconvertedCount += 1;
      const persistedNextBilling = parseLocalYMD(sub.nextBillingDate);
      const hasPersistedNextBilling = Number.isFinite(persistedNextBilling.getTime());
      const loopEnd = new Date(Math.max(yearEnd.getTime(), next7DaysEnd.getTime()));
      let actualEnd = loopEnd;

      if (isCancelled && sub.cancelledAt) {
        const cancelledDate = parseLocalYMD(sub.cancelledAt);
        if (!Number.isNaN(cancelledDate.getTime()) && cancelledDate < loopEnd)
          actualEnd = cancelledDate;
      }

      let currentDate = parseLocalYMD(sub.startDate);
      if (Number.isNaN(currentDate.getTime())) continue;
      let iterations = 0;

      while (currentDate <= actualEnd) {
        iterations += 1;
        if (iterations > MAX_ITERATIONS) {
          console.warn(`[Dashboard] Max iterations exceeded for sub: ${sub.name}`);
          break;
        }

        const date = new Date(currentDate);
        const isOverduePersistedDay =
          !isCancelled &&
          hasPersistedNextBilling &&
          currentDate.getTime() === persistedNextBilling.getTime() &&
          persistedNextBilling <= today;
        const isSupersededFutureCycle =
          !isCancelled &&
          currentDate > today &&
          hasPersistedNextBilling &&
          currentDate < persistedNextBilling;

        if (currentDate >= monthStart && currentDate <= monthEnd) {
          if (isOverduePersistedDay) {
            stats.monthlyPending += usdCost ?? 0;
            stats.monthlyEvents.push({ sub, date, cost: usdCost, state: 'pending' });
          } else if (currentDate <= today || isSupersededFutureCycle) {
            stats.monthlyPaid += usdCost ?? 0;
            stats.monthlyEvents.push({ sub, date, cost: usdCost, state: 'paid' });
          } else if (!isCancelled) {
            stats.monthlyPending += usdCost ?? 0;
            stats.monthlyEvents.push({ sub, date, cost: usdCost, state: 'pending' });
          }
        }

        if (currentDate >= yearStart && currentDate <= yearEnd) {
          if (isOverduePersistedDay) stats.yearlyPending += usdCost ?? 0;
          else if (currentDate <= today || isSupersededFutureCycle)
            stats.yearlyPaid += usdCost ?? 0;
          else if (!isCancelled) stats.yearlyPending += usdCost ?? 0;
        }

        if (currentDate >= last7DaysStart && currentDate <= today && !isOverduePersistedDay) {
          stats.recentPayments.push({ sub, date, cost: sub.price });
        }

        const nextYmd = addBillingCycleYMD(
          formatLocalYMD(currentDate),
          sub.frequency,
          sub.startDate
        );
        if (!nextYmd) break;
        currentDate = parseLocalYMD(nextYmd);
      }

      if (!isCancelled && hasPersistedNextBilling && persistedNextBilling <= next7DaysEnd) {
        stats.upcomingRenewals.push({ sub, date: persistedNextBilling, cost: sub.price });
      }
    }

    stats.recentPayments.sort((a, b) => b.date.getTime() - a.date.getTime());
    stats.upcomingRenewals.sort((a, b) => a.date.getTime() - b.date.getTime());
    stats.monthlyEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
    return stats;
  }, [serverTodayYmd, subscriptions, settings.exchangeRates]);
};
