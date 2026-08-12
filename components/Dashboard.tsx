import React, { useMemo } from 'react';
import {
  Activity,
  CalendarCheck2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  TrendingUp,
} from 'lucide-react';
import { AppSettings, ServerClock, Subscription } from '../types';
import { getT } from '../services/i18n';
import { displayCategoryLabel } from '../services/displayLabels';
import { daysUntilYMD, formatLocalYMD, getTodayYMD, parseLocalYMD } from '../services/dateUtils';
import { addBillingCycleYMD } from '../shared/billingDate.js';
import { formatCurrency } from '../services/currency';
import RenewalRail, { RenewalRailEvent } from './RenewalRail';

interface Props {
  subscriptions: Subscription[];
  settings: AppSettings;
  lang: 'en' | 'zh';
  serverClock: ServerClock;
}

interface BillingEvent {
  sub: Subscription;
  date: Date;
  cost: number;
}

interface DashboardStats {
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

const convertToUSD = (amount: number, currency: string, rates: Record<string, number> | undefined): number => {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  if (!currency || currency === 'USD') return amount;
  const rate = rates?.[currency] ?? 1;
  if (rate <= 0 || !Number.isFinite(rate)) return amount;
  return amount / rate;
};

const useDashboardStats = (
  subscriptions: Subscription[],
  settings: AppSettings,
  serverClock: ServerClock,
): DashboardStats => {
  const serverNow = new Date(
    serverClock.serverTimeMs + Math.max(0, Date.now() - serverClock.receivedAtMs),
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
      const persistedNextBilling = parseLocalYMD(sub.nextBillingDate);
      const hasPersistedNextBilling = Number.isFinite(persistedNextBilling.getTime());
      const loopEnd = new Date(Math.max(yearEnd.getTime(), next7DaysEnd.getTime()));
      let actualEnd = loopEnd;

      if (isCancelled && sub.cancelledAt) {
        const cancelledDate = parseLocalYMD(sub.cancelledAt);
        if (!Number.isNaN(cancelledDate.getTime()) && cancelledDate < loopEnd) actualEnd = cancelledDate;
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
        const isSupersededFutureCycle =
          !isCancelled &&
          currentDate > today &&
          hasPersistedNextBilling &&
          currentDate < persistedNextBilling;

        if (currentDate >= monthStart && currentDate <= monthEnd) {
          if (currentDate <= today) {
            stats.monthlyPaid += usdCost;
            stats.monthlyEvents.push({ sub, date, cost: usdCost, state: 'paid' });
          } else if (!isCancelled && !isSupersededFutureCycle) {
            stats.monthlyPending += usdCost;
            stats.monthlyEvents.push({ sub, date, cost: usdCost, state: 'pending' });
          }
        }

        if (currentDate >= yearStart && currentDate <= yearEnd) {
          if (currentDate <= today) stats.yearlyPaid += usdCost;
          else if (!isCancelled && !isSupersededFutureCycle) stats.yearlyPending += usdCost;
        }

        if (currentDate >= last7DaysStart && currentDate <= today) {
          stats.recentPayments.push({ sub, date, cost: sub.price });
        }

        const nextYmd = addBillingCycleYMD(formatLocalYMD(currentDate), sub.frequency, sub.startDate);
        if (!nextYmd) break;
        currentDate = parseLocalYMD(nextYmd);
      }

      if (
        !isCancelled &&
        hasPersistedNextBilling &&
        persistedNextBilling > today &&
        persistedNextBilling <= next7DaysEnd
      ) {
        stats.upcomingRenewals.push({ sub, date: persistedNextBilling, cost: sub.price });
      }
    }

    stats.recentPayments.sort((a, b) => b.date.getTime() - a.date.getTime());
    stats.upcomingRenewals.sort((a, b) => a.date.getTime() - b.date.getTime());
    stats.monthlyEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
    return stats;
  }, [serverTodayYmd, subscriptions, settings.exchangeRates]);
};

const ServiceAvatar = ({ sub }: { sub: Subscription }) => (
  <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--surface-raised)] text-sm font-semibold text-[var(--rail-teal)]">
    {sub.iconUrl ? (
      <img src={sub.iconUrl} alt="" className="h-full w-full object-contain" loading="lazy" referrerPolicy="no-referrer" />
    ) : (
      sub.name.charAt(0).toUpperCase()
    )}
  </div>
);

const PaymentList: React.FC<{
  title: string;
  emptyText: string;
  events: BillingEvent[];
  lang: 'en' | 'zh';
  timeZone: string;
  upcoming?: boolean;
}> = ({ title, emptyText, events, lang, timeZone, upcoming }) => {
  const t = getT(lang);

  return (
    <section className="statement-card overflow-hidden">
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-center gap-2.5">
          {upcoming ? <Clock3 size={17} className="text-[var(--due-amber)]" /> : <CheckCircle2 size={17} className="text-[var(--rail-teal)]" />}
          <h3 className="font-display text-base font-semibold tracking-[-0.02em] text-[var(--ink)]">{title}</h3>
        </div>
        <span className="font-data text-xs text-[var(--muted)]">{String(events.length).padStart(2, '0')}</span>
      </div>

      {events.length > 0 ? (
        <div className="divide-y divide-[var(--line)]">
          {events.map((item, index) => {
            const days = daysUntilYMD(formatLocalYMD(item.date), timeZone);
            return (
              <div key={`${item.sub.id}-${formatLocalYMD(item.date)}-${index}`} className="statement-row flex items-center gap-3 px-5 py-3.5">
                <ServiceAvatar sub={item.sub} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[var(--ink)]">{item.sub.name}</div>
                  <div className="mt-0.5 truncate text-xs text-[var(--muted)]">{displayCategoryLabel(item.sub.category, lang)}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-data text-sm font-medium text-[var(--ink)]">{formatCurrency(item.cost, item.sub.currency)}</div>
                  <div className={`mt-0.5 text-[11px] ${upcoming && days <= 3 ? 'text-[var(--alert-coral)]' : 'text-[var(--muted)]'}`}>
                    {upcoming
                      ? days === 0
                        ? t('today')
                        : `${days} ${t('days_left')}`
                      : formatLocalYMD(item.date)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-5 py-12 text-center text-sm text-[var(--muted)]">{emptyText}</div>
      )}
    </section>
  );
};

const Dashboard: React.FC<Props> = ({ subscriptions, lang, settings, serverClock }) => {
  const t = getT(lang);
  const data = useDashboardStats(subscriptions, settings, serverClock);
  const serverNow = new Date(
    serverClock.serverTimeMs + Math.max(0, Date.now() - serverClock.receivedAtMs),
  );
  const today = parseLocalYMD(getTodayYMD(settings.timezone, serverNow));
  const monthLabel = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
  }).format(today);

  const metrics = [
    { label: t('paid'), value: formatCurrency(data.monthlyPaid, 'USD'), icon: CircleDollarSign },
    { label: t('pending'), value: formatCurrency(data.monthlyPending, 'USD'), icon: CalendarCheck2 },
    { label: t('yearly_paid_pending'), value: formatCurrency(data.yearlyPaid + data.yearlyPending, 'USD'), icon: TrendingUp },
    { label: t('active_cancelled_title'), value: `${data.activeCount} / ${data.cancelledCount}`, icon: Activity },
  ];

  return (
    <div className="animate-fade-in space-y-6 pb-8">
      <header className="flex flex-col gap-3 pb-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-3">{t('schedule_overview')}</div>
          <h1 className="page-title">{monthLabel}</h1>
        </div>
        <p className="page-copy max-w-md text-sm sm:text-right">{t('overview_text')}</p>
      </header>

      <RenewalRail
        events={data.monthlyEvents}
        monthlyTotal={data.monthlyPaid + data.monthlyPending}
        lang={lang}
        timeZone={settings.timezone}
        serverClock={serverClock}
      />

      <section className="statement-card grid grid-cols-2 overflow-hidden md:grid-cols-4" aria-label={t('monthly_statement')}>
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="metric-cell p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
              <Icon size={15} aria-hidden="true" />
              <span className="truncate">{label}</span>
            </div>
            <div className="data-value mt-3 truncate text-lg font-medium sm:text-xl">{value}</div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PaymentList
          title={t('recent_payments')}
          emptyText={t('no_recent_payments')}
          events={data.recentPayments}
          lang={lang}
          timeZone={settings.timezone}
        />
        <PaymentList
          title={t('attention_queue')}
          emptyText={t('no_upcoming_renewals')}
          events={data.upcomingRenewals}
          lang={lang}
          timeZone={settings.timezone}
          upcoming
        />
      </div>
    </div>
  );
};

export default Dashboard;
