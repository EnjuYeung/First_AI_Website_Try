import React, { useMemo } from 'react';
import { Subscription, Frequency, AppSettings } from '../types';
import { DollarSign, TrendingUp, Activity, CheckCircle, Clock, BarChart2, LucideIcon } from 'lucide-react';
import { getT } from '../services/i18n';
import { CategoryGlyph } from './ui/glyphs';
import { displayCategoryLabel } from '../services/displayLabels';
import { formatLocalYMD, parseLocalYMD } from '../services/dateUtils';
import { formatCurrency } from '../services/currency';
import DashboardAnalytics from './DashboardAnalytics';

// --- Types ---

interface Props {
  subscriptions: Subscription[];
  settings: AppSettings;
  lang: 'en' | 'zh';
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
  lifetimeSpend: number;
  activeCount: number;
  cancelledCount: number;
  recentPayments: BillingEvent[];
  upcomingRenewals: BillingEvent[];
}

// --- Utils (Pure Functions) ---

const convertToUSD = (amount: number, currency: string, rates: Record<string, number> | undefined): number => {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  if (!currency || currency === 'USD') return amount;
  const rate = rates?.[currency] ?? 1;
  if (rate <= 0 || !Number.isFinite(rate)) return amount;
  return amount / rate;
};

const getDaysRemaining = (date: Date): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// --- Sub-Components (UI) ---

const StatCard: React.FC<{
  title: string;
  primaryValue: number;
  secondaryValue?: number;
  icon: LucideIcon;
  iconColorClass: string;
  progressColorClass: string;
  isCount?: boolean;
}> = ({ title, primaryValue, secondaryValue, icon: Icon, iconColorClass, progressColorClass, isCount }) => {
  const total = primaryValue + (secondaryValue || 0);
  // Prevent division by zero
  const percentage = total > 0 ? (primaryValue / total) * 100 : 0;

  return (
    <div className="mac-surface p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon size={80} className={iconColorClass} />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium z-10">{title}</p>

      <div className="flex items-baseline space-x-2 mt-2 z-10">
        <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
          {isCount ? primaryValue : formatCurrency(primaryValue, 'USD')}
        </h3>
        {secondaryValue !== undefined && (
          <>
            <span className="text-gray-400 text-lg">{isCount ? '|' : '/'}</span>
            <span className="text-xl font-semibold text-gray-400">
              {isCount ? secondaryValue : formatCurrency(secondaryValue, 'USD')}
            </span>
          </>
        )}
      </div>

      <div className="mt-4 w-full bg-gray-100 dark:bg-slate-700 h-1.5 rounded-full z-10 overflow-hidden">
        {secondaryValue !== undefined ? (
          <div
            className={`h-full ${progressColorClass} rounded-full`}
            style={{ width: `${percentage}%` }}
          />
        ) : (
          <div className="h-full opacity-0" />
        )}
      </div>
    </div>
  );
};

const PaymentRow: React.FC<{
  item: BillingEvent;
  lang: 'en' | 'zh';
  showDaysRemaining?: boolean;
}> = ({ item, lang, showDaysRemaining }) => {
  const t = getT(lang);
  const days = showDaysRemaining ? getDaysRemaining(item.date) : 0;

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
        <div className="flex items-center gap-2 min-w-0">
          {item.sub.iconUrl ? (
            <img
              src={item.sub.iconUrl}
              alt={item.sub.name}
              className="w-5 h-5 object-contain flex-shrink-0"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="w-5 h-5 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {String(item.sub.name || 'S').charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate max-w-[120px]">{item.sub.name}</span>
        </div>
      </td>
      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <CategoryGlyph category={item.sub.category} containerSize={18} size={12} />
          <span className="truncate max-w-[100px]">{displayCategoryLabel(item.sub.category, lang)}</span>
        </div>
      </td>
      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
        {formatCurrency(item.cost, item.sub.currency)}
      </td>
      <td className="px-5 py-3 text-right text-gray-500 dark:text-gray-400">
        {showDaysRemaining ? (
          days <= 3 ? (
            <span className="px-2 py-0.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold rounded-full">
              {days} {t('days_left')}
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs font-bold rounded-full">
              {days} {t('days_left')}
            </span>
          )
        ) : (
          formatLocalYMD(item.date)
        )}
      </td>
    </tr>
  );
};

// --- Custom Hook (Logic Extraction) ---

const useDashboardStats = (subscriptions: Subscription[], settings: AppSettings): DashboardStats => {
  return useMemo(() => {
    // 1. Initialize Dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);

    // Recent & Upcoming windows
    const last7DaysStart = new Date(today);
    last7DaysStart.setDate(today.getDate() - 7);
    const next7DaysEnd = new Date(today);
    next7DaysEnd.setDate(today.getDate() + 7);

    // 2. Initialize Accumulator
    const stats: DashboardStats = {
      monthlyPaid: 0,
      monthlyPending: 0,
      yearlyPaid: 0,
      yearlyPending: 0,
      lifetimeSpend: 0,
      activeCount: 0,
      cancelledCount: 0,
      recentPayments: [],
      upcomingRenewals: []
    };

    const MAX_ITERATIONS = 5000; // Security: DoS Protection

    // 3. Single Pass Loop over Subscriptions
    for (const sub of subscriptions) {
      const isCancelled = sub.status === 'cancelled';

      // Status Counts
      if (isCancelled) stats.cancelledCount++;
      else stats.activeCount++;

      if (!sub.startDate) continue;

      const usdCost = convertToUSD(sub.price, sub.currency, settings.exchangeRates);

      // Determine Iteration Range
      // We iterate from startDate until we cover all relevant future ranges (upto year end or next 7 days)
      const loopEndData = new Date(Math.max(yearEnd.getTime(), next7DaysEnd.getTime()));

      // If cancelled, stop at cancellation date
      let actualEnd = loopEndData;
      if (isCancelled && sub.cancelledAt) {
        const cDate = parseLocalYMD(sub.cancelledAt);
        if (!isNaN(cDate.getTime()) && cDate < loopEndData) {
          actualEnd = cDate;
        }
      }

      let currentDate = parseLocalYMD(sub.startDate);
      if (isNaN(currentDate.getTime())) continue;

      let iterations = 0;

      // 4. Date Iteration (Bucket Strategy)
      while (currentDate <= actualEnd) {
        iterations++;
        // Safety Break
        if (iterations > MAX_ITERATIONS) {
          console.warn(`[Dashboard] Max iterations exceeded for sub: ${sub.name}`);
          break;
        }

        const tTime = currentDate.getTime();
        const dateObj = new Date(currentDate); // Copy for storage

        // A. Lifetime (Before or on today)
        if (currentDate <= today) {
          stats.lifetimeSpend += usdCost;
        }

        // B. Monthly
        if (currentDate >= monthStart && currentDate <= monthEnd) {
          if (currentDate <= today) stats.monthlyPaid += usdCost;
          else if (!isCancelled) stats.monthlyPending += usdCost;
        }

        // C. Yearly
        if (currentDate >= yearStart && currentDate <= yearEnd) {
          if (currentDate <= today) stats.yearlyPaid += usdCost;
          else if (!isCancelled) stats.yearlyPending += usdCost;
        }

        // D. Recent Payments (Last 7 Days)
        if (currentDate >= last7DaysStart && currentDate <= today) {
          stats.recentPayments.push({ sub, date: dateObj, cost: sub.price });
        }

        // E. Upcoming Renewals (Next 7 Days, exclude today, include future)
        // Only if active
        if (!isCancelled && currentDate > today && currentDate <= next7DaysEnd) {
          stats.upcomingRenewals.push({ sub, date: dateObj, cost: sub.price });
        }

        // Advance Date
        switch (sub.frequency) {
          case Frequency.MONTHLY: currentDate.setMonth(currentDate.getMonth() + 1); break;
          case Frequency.QUARTERLY: currentDate.setMonth(currentDate.getMonth() + 3); break;
          case Frequency.SEMI_ANNUALLY: currentDate.setMonth(currentDate.getMonth() + 6); break;
          case Frequency.YEARLY: currentDate.setFullYear(currentDate.getFullYear() + 1); break;
          default: currentDate.setMonth(currentDate.getMonth() + 1);
        }
      }
    }

    // 5. Final Sorts
    stats.recentPayments.sort((a, b) => b.date.getTime() - a.date.getTime());
    stats.upcomingRenewals.sort((a, b) => a.date.getTime() - b.date.getTime());

    return stats;
  }, [subscriptions, settings.exchangeRates]);
};

// --- Main Layout ---

const Dashboard: React.FC<Props> = ({ subscriptions, lang, settings }) => {
  const t = getT(lang);
  const data = useDashboardStats(subscriptions, settings);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          title={t('monthly_paid_pending')}
          primaryValue={data.monthlyPaid}
          secondaryValue={data.monthlyPending}
          icon={DollarSign}
          iconColorClass="text-primary-500"
          progressColorClass="bg-primary-500"
        />
        <StatCard
          title={t('yearly_paid_pending')}
          primaryValue={data.yearlyPaid}
          secondaryValue={data.yearlyPending}
          icon={TrendingUp}
          iconColorClass="text-blue-500"
          progressColorClass="bg-blue-500"
        />
        <StatCard
          title={t('active_cancelled_title')}
          primaryValue={data.activeCount}
          secondaryValue={data.cancelledCount}
          icon={Activity}
          iconColorClass="text-green-500"
          progressColorClass="bg-green-500"
          isCount
        />
        <StatCard
          title={t('lifetime_spend')}
          primaryValue={data.lifetimeSpend}
          icon={BarChart2}
          iconColorClass="text-purple-500"
          progressColorClass="bg-purple-500"
        />
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Payments */}
        <div className="mac-surface rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-700/30">
            <div className="flex items-center gap-2">
              <CheckCircle className="text-green-500" size={18} />
              <h3 className="font-bold text-gray-800 dark:text-white">{t('recent_payments')}</h3>
            </div>
          </div>
          <div className="overflow-y-auto flex-1" style={{ maxHeight: 240 }}>
            {data.recentPayments.length > 0 ? (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-5 py-3 font-medium">{t('service')}</th>
                    <th className="px-5 py-3 font-medium">{t('category')}</th>
                    <th className="px-5 py-3 font-medium">{t('cost')}</th>
                    <th className="px-5 py-3 font-medium text-right">{t('payment_date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.recentPayments.map((item, idx) => (
                    <PaymentRow key={`${item.sub.id}-${idx}`} item={item} lang={lang} />
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">{t('no_recent_payments')}</div>
            )}
          </div>
        </div>

        {/* Upcoming Renewals */}
        <div className="mac-surface rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-700/30">
            <div className="flex items-center gap-2">
              <Clock className="text-orange-500" size={18} />
              <h3 className="font-bold text-gray-800 dark:text-white">{t('upcoming_renewals')}</h3>
            </div>
          </div>
          <div className="overflow-y-auto flex-1" style={{ maxHeight: 240 }}>
            {data.upcomingRenewals.length > 0 ? (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-5 py-3 font-medium">{t('service')}</th>
                    <th className="px-5 py-3 font-medium">{t('category')}</th>
                    <th className="px-5 py-3 font-medium">{t('cost')}</th>
                    <th className="px-5 py-3 font-medium text-right">{t('days_remaining')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data.upcomingRenewals.map((item, idx) => (
                    <PaymentRow key={`${item.sub.id}-${idx}`} item={item} lang={lang} showDaysRemaining />
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm">{t('no_upcoming_renewals')}</div>
            )}
          </div>
        </div>

      </div>

      <DashboardAnalytics subscriptions={subscriptions} settings={settings} lang={lang} />
    </div>
  );
};

export default Dashboard;
