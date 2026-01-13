
import React, { useMemo } from 'react';
import { Subscription, Frequency, AppSettings } from '../types';
import { DollarSign, TrendingUp, Activity, CheckCircle, Clock, BarChart2 } from 'lucide-react';
import { getT } from '../services/i18n';
import { CategoryGlyph } from './ui/glyphs';
import { displayCategoryLabel } from '../services/displayLabels';
import { formatLocalYMD, parseLocalYMD } from '../services/dateUtils';
import { formatCurrency } from '../services/currency';
import DashboardAnalytics from './DashboardAnalytics';

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

const Dashboard: React.FC<Props> = ({ subscriptions, lang, settings }) => {
  
  const t = getT(lang);
  const toUSD = (amount: number, currency: string) => {
    if (!amount) return 0;
    if (!currency || currency === 'USD') return amount;
    const rate = settings.exchangeRates?.[currency] || 1;
    return rate === 0 ? amount : amount / rate;
  };

  // Helper: Calculate all billing occurrences for a subscription within a date range
  const getBillingEventsInRange = (sub: Subscription, startRange: Date, endRange: Date): Date[] => {
    const events: Date[] = [];
    if (!sub.startDate) return events;

    const rangeStart = new Date(startRange);
    const rangeEnd = new Date(endRange);

    if (sub.status === 'cancelled' && sub.cancelledAt) {
      const cancelledDate = parseLocalYMD(sub.cancelledAt);
      if (!Number.isNaN(cancelledDate.getTime())) {
        cancelledDate.setHours(0, 0, 0, 0);
        if (cancelledDate < rangeStart) return events;
        if (cancelledDate < rangeEnd) rangeEnd.setTime(cancelledDate.getTime());
      }
    }

    let currentDate = parseLocalYMD(sub.startDate);
    
    // Safety check to prevent infinite loops if start date is invalid
    if (isNaN(currentDate.getTime())) return events;

    while (currentDate <= rangeEnd) {
      if (currentDate >= rangeStart) {
        events.push(new Date(currentDate));
      }

      // Increment based on frequency
      switch (sub.frequency) {
        case Frequency.MONTHLY:
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case Frequency.QUARTERLY:
          currentDate.setMonth(currentDate.getMonth() + 3);
          break;
        case Frequency.SEMI_ANNUALLY:
          currentDate.setMonth(currentDate.getMonth() + 6);
          break;
        case Frequency.YEARLY:
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
        default: 
          currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }
    return events;
  };

    const dashboardData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // Ranges
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0); 
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);
    const last7DaysStart = new Date(today);
    last7DaysStart.setDate(today.getDate() - 7);
    const next7DaysEnd = new Date(today);
    next7DaysEnd.setDate(today.getDate() + 7);
    
    // Stats
    let monthlyPaid = 0;
    let monthlyPending = 0;
    let yearlyPaid = 0;
    let yearlyPending = 0;
    let activeCount = 0;
    let cancelledCount = 0;
    let lifetimeSpend = 0;

    // Collections
    const recentPayments: BillingEvent[] = [];
    const upcomingRenewals: BillingEvent[] = [];

    subscriptions.forEach(sub => {
      // 1. Status Counts
      if (sub.status === 'cancelled') {
        cancelledCount++;
      } else {
        activeCount++;
      }

      // 2. Monthly Logic
      const monthEvents = getBillingEventsInRange(sub, monthStart, monthEnd);
      monthEvents.forEach(date => {
         if (date <= today) {
             monthlyPaid += toUSD(sub.price, sub.currency);
         } else if (sub.status !== 'cancelled') {
             monthlyPending += toUSD(sub.price, sub.currency);
         }
      });

      // 3. Yearly Logic
      const yearEvents = getBillingEventsInRange(sub, yearStart, yearEnd);
      yearEvents.forEach(date => {
        const usd = toUSD(sub.price, sub.currency);
        if (date <= today) {
            yearlyPaid += usd;
        } else if (sub.status !== 'cancelled') {
            yearlyPending += usd;
        }
      });

      // 4. Recent Payments (Last 7 Days)
      const recentEvents = getBillingEventsInRange(sub, last7DaysStart, today);
      recentEvents.forEach(date => {
        recentPayments.push({ sub, date, cost: sub.price });
      });

      // 5. Upcoming Renewals (Next 7 Days)
      if (sub.status !== 'cancelled') {
          if (sub.nextBillingDate) {
              const nextDate = parseLocalYMD(sub.nextBillingDate);
              if (nextDate > today && nextDate <= next7DaysEnd) {
                  upcomingRenewals.push({ sub, date: nextDate, cost: sub.price });
              }
          }
      }

      // 6. Lifetime Spend (All Past Events)
      const lifetimeEvents = getBillingEventsInRange(sub, new Date(1970, 0, 1), today);
      lifetimeEvents.forEach(() => {
        lifetimeSpend += toUSD(sub.price, sub.currency);
      });
    });

    // Sorting Tables
    recentPayments.sort((a, b) => b.date.getTime() - a.date.getTime()); 
    upcomingRenewals.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
      monthlyPaid,
      monthlyPending,
      yearlyPaid,
      yearlyPending,
      lifetimeSpend,
      activeCount,
      cancelledCount,
      recentPayments,
      upcomingRenewals
    };
  }, [subscriptions, settings.exchangeRates, lang]);


  const formatDate = (date: Date) => {
    return formatLocalYMD(date);
  };

  const getDaysRemaining = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Cards Row 1: Money & Counts */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* Monthly Card */}
        <div className="mac-surface p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <DollarSign size={80} className="text-primary-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium z-10">{t('monthly_paid_pending')}</p>
          <div className="flex items-baseline space-x-2 mt-2 z-10">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(dashboardData.monthlyPaid, 'USD')}
              </h3>
              <span className="text-gray-400 text-lg">/</span>
              <span className="text-xl font-semibold text-gray-400">
                {formatCurrency(dashboardData.monthlyPending, 'USD')}
              </span>
          </div>
          <div className="mt-4 w-full bg-gray-100 dark:bg-slate-700 h-1.5 rounded-full z-10 overflow-hidden">
             <div 
                className="h-full bg-primary-500 rounded-full" 
                style={{ width: `${(dashboardData.monthlyPaid / (dashboardData.monthlyPaid + dashboardData.monthlyPending || 1)) * 100}%` }}
             ></div>
          </div>
        </div>

        {/* Yearly Card */}
        <div className="mac-surface p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <TrendingUp size={80} className="text-blue-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium z-10">{t('yearly_paid_pending')}</p>
          <div className="flex items-baseline space-x-2 mt-2 z-10">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(dashboardData.yearlyPaid, 'USD')}
              </h3>
              <span className="text-gray-400 text-lg">/</span>
              <span className="text-xl font-semibold text-gray-400">
                {formatCurrency(dashboardData.yearlyPending, 'USD')}
              </span>
          </div>
          <div className="mt-4 w-full bg-gray-100 dark:bg-slate-700 h-1.5 rounded-full z-10 overflow-hidden">
             <div 
                className="h-full bg-blue-500 rounded-full" 
                style={{ width: `${(dashboardData.yearlyPaid / (dashboardData.yearlyPaid + dashboardData.yearlyPending || 1)) * 100}%` }}
             ></div>
          </div>
        </div>

        {/* Status Card */}
        <div className="mac-surface p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <Activity size={80} className="text-green-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium z-10">{t('active_cancelled_title')}</p>
          <div className="flex items-baseline space-x-3 mt-2 z-10">
              <div className="flex items-center gap-2">
                 <span className="w-3 h-3 rounded-full bg-green-500"></span>
                 <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{dashboardData.activeCount}</h3>
              </div>
              <span className="text-gray-300 dark:text-gray-600 text-2xl font-light">|</span>
              <div className="flex items-center gap-2">
                 <span className="w-3 h-3 rounded-full bg-red-400"></span>
                 <h3 className="text-3xl font-bold text-gray-400">{dashboardData.cancelledCount}</h3>
              </div>
          </div>
          <div className="mt-4 w-full h-1.5 opacity-0"></div>
        </div>

        {/* Lifetime Spend */}
        <div className="mac-surface p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <BarChart2 size={80} className="text-purple-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium z-10">{t('lifetime_spend')}</p>
          <div className="flex items-baseline space-x-2 mt-2 z-10">
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(dashboardData.lifetimeSpend, 'USD')}
            </h3>
          </div>
          <div className="mt-4 w-full h-1.5 opacity-0"></div>
          <p className="absolute bottom-5 left-6 text-xs text-gray-400">{t('all_time')}</p>
        </div>
      </div>

      {/* New Grids: Recent & Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Payments */}
	        <div className="mac-surface rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-700/30">
                <div className="flex items-center gap-2">
                    <CheckCircle className="text-green-500" size={18}/>
                    <h3 className="font-bold text-gray-800 dark:text-white">{t('recent_payments')}</h3>
                </div>
            </div>
            <div className="overflow-y-auto flex-1" style={{ maxHeight: 240 }}>
                {dashboardData.recentPayments.length > 0 ? (
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
                            {dashboardData.recentPayments.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
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
                                          <span className="truncate">{item.sub.name}</span>
                                        </div>
                                      </td>
	                                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
	                                      <div className="flex items-center gap-2">
	                                        <CategoryGlyph category={item.sub.category} containerSize={18} size={12} />
	                                        <span className="truncate">{displayCategoryLabel(item.sub.category, lang)}</span>
	                                      </div>
	                                    </td>
                                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(item.cost, item.sub.currency)}
                                    </td>
                                    <td className="px-5 py-3 text-right text-gray-500 dark:text-gray-400">{formatDate(item.date)}</td>
                                </tr>
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
                    <Clock className="text-orange-500" size={18}/>
                    <h3 className="font-bold text-gray-800 dark:text-white">{t('upcoming_renewals')}</h3>
                </div>
            </div>
            <div className="overflow-y-auto flex-1" style={{ maxHeight: 240 }}>
                 {dashboardData.upcomingRenewals.length > 0 ? (
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
                            {dashboardData.upcomingRenewals.map((item, idx) => {
                                const days = getDaysRemaining(item.date);
                                return (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
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
                                          <span className="truncate">{item.sub.name}</span>
                                        </div>
                                      </td>
	                                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
	                                      <div className="flex items-center gap-2">
	                                        <CategoryGlyph category={item.sub.category} containerSize={18} size={12} />
	                                        <span className="truncate">{displayCategoryLabel(item.sub.category, lang)}</span>
	                                      </div>
	                                    </td>
                                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(item.cost, item.sub.currency)}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        {days <= 3 ? (
                                            <span className="px-2 py-0.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold rounded-full">
                                                {days} {t('days_left')}
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs font-bold rounded-full">
                                                {days} {t('days_left')}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                                )
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-8 text-center text-gray-400 text-sm">{t('no_upcoming_renewals')}</div>
                )}
            </div>
        </div>

      </div>

      {/* Analytics Section */}
      <DashboardAnalytics subscriptions={subscriptions} settings={settings} lang={lang} />
    </div>
  );
};

export default Dashboard;
