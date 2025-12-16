
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
import { Subscription, Frequency, AppSettings } from '../types';
import { DollarSign, TrendingUp, Activity, CheckCircle, Clock, CreditCard } from 'lucide-react';
import { getT } from '../services/i18n';
import { CategoryGlyph } from './ui/glyphs';
import { displayCategoryLabel } from '../services/displayLabels';

interface Props {
  subscriptions: Subscription[];
  settings: AppSettings;
  lang: 'en' | 'zh';
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

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

    let currentDate = new Date(sub.startDate);
    currentDate.setHours(0, 0, 0, 0);
    
    // Safety check to prevent infinite loops if start date is invalid
    if (isNaN(currentDate.getTime())) return events;

    while (currentDate <= endRange) {
      if (currentDate >= startRange) {
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
    
    // Last 12 Months Range (for Top Sub/Category)
    const last12MonthsStart = new Date(today);
    last12MonthsStart.setFullYear(today.getFullYear() - 1);

    // Stats
    let monthlyPaid = 0;
    let monthlyPending = 0;
    let yearlyPaid = 0;
    let yearlyPending = 0;
    let activeCount = 0;
    let cancelledCount = 0;

    // Collections
    const recentPayments: BillingEvent[] = [];
    const upcomingRenewals: BillingEvent[] = [];
    const yearlyPaidByCategory: Record<string, number> = {};
    
    // Maps for Top Sub/Category (Last 12 Months)
    const last12MSubTotal: Record<string, {name: string, value: number, currency: string}> = {};
    const last12MCategoryTotal: Record<string, number> = {};

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

      // 3. Yearly Logic & Breakdown
      const yearEvents = getBillingEventsInRange(sub, yearStart, yearEnd);
      yearEvents.forEach(date => {
        const usd = toUSD(sub.price, sub.currency);
        if (date <= today) {
            yearlyPaid += usd;
            {
              const cat = displayCategoryLabel(sub.category, lang);
              yearlyPaidByCategory[cat] = (yearlyPaidByCategory[cat] || 0) + usd;
            }
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
              const nextDate = new Date(sub.nextBillingDate);
              nextDate.setHours(0,0,0,0);
              if (nextDate > today && nextDate <= next7DaysEnd) {
                  upcomingRenewals.push({ sub, date: nextDate, cost: sub.price });
              }
          }
      }

      // 6. Last 12 Months Logic (For Highest Sub & Top Category)
      const last12MEvents = getBillingEventsInRange(sub, last12MonthsStart, today);
      last12MEvents.forEach(() => {
        // Sub Total
        if (!last12MSubTotal[sub.id]) {
            last12MSubTotal[sub.id] = { name: sub.name, value: 0, currency: sub.currency };
        }
        last12MSubTotal[sub.id].value += toUSD(sub.price, sub.currency);

        // Category Total
        {
          const cat = displayCategoryLabel(sub.category, lang);
          last12MCategoryTotal[cat] = (last12MCategoryTotal[cat] || 0) + toUSD(sub.price, sub.currency);
        }
      });
    });

    // Determine Highest Sub (by single billing amount, converted to USD)
    let highestSub = { name: 'None', value: 0, currency: 'USD' };
    subscriptions.forEach(sub => {
        const usd = toUSD(sub.price, sub.currency);
        if (usd > highestSub.value) {
            highestSub = { name: sub.name, value: usd, currency: 'USD' };
        }
    });

    // Determine Top Category (Last 12M)
    let topCategory = { name: 'None', value: 0 };
    Object.entries(last12MCategoryTotal).forEach(([cat, val]) => {
        if (val > topCategory.value) topCategory = { name: cat, value: val };
    });

    // Sorting Tables
    recentPayments.sort((a, b) => b.date.getTime() - a.date.getTime()); 
    upcomingRenewals.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Pie Chart Data (Monthly Budget)
    const getStandardMonthlyCost = (sub: Subscription) => {
        const usd = toUSD(sub.price, sub.currency);
        switch (sub.frequency) {
            case Frequency.MONTHLY: return usd;
            case Frequency.QUARTERLY: return usd / 3;
            case Frequency.SEMI_ANNUALLY: return usd / 6;
            case Frequency.YEARLY: return usd / 12;
            default: return usd;
        }
    };
    
    const categoryDataMap: Record<string, number> = {};
    let totalMonthlyBudget = 0;
    subscriptions.filter(s => s.status === 'active').forEach(sub => {
        const cost = getStandardMonthlyCost(sub);
        {
          const cat = displayCategoryLabel(sub.category, lang);
          categoryDataMap[cat] = (categoryDataMap[cat] || 0) + cost;
        }
        totalMonthlyBudget += cost;
    });
    
    const categoryData = Object.keys(categoryDataMap).map(key => ({ 
        name: key, 
        value: parseFloat(categoryDataMap[key].toFixed(2)),
        percentage: totalMonthlyBudget > 0 ? Math.round((categoryDataMap[key] / totalMonthlyBudget) * 100) : 0
    })).sort((a, b) => b.value - a.value);
    const categoryColorMap = categoryData.reduce<Record<string, string>>((acc, cur, idx) => {
      acc[cur.name] = COLORS[idx % COLORS.length];
      return acc;
    }, {});


    // Bar Chart Data (Yearly Paid Breakdown)
    const yearlyBreakdownData = Object.keys(yearlyPaidByCategory).map(key => ({
        name: key,
        value: parseFloat(yearlyPaidByCategory[key].toFixed(2)),
        percentage: yearlyPaid > 0 ? Math.round((yearlyPaidByCategory[key] / yearlyPaid) * 100) : 0
    })).sort((a, b) => b.value - a.value);


    return {
      monthlyPaid: monthlyPaid.toFixed(2),
      monthlyPending: monthlyPending.toFixed(2),
      yearlyPaid: yearlyPaid.toFixed(2),
      yearlyPending: yearlyPending.toFixed(2),
      activeCount,
      cancelledCount,
      recentPayments,
      upcomingRenewals,
      categoryData,
      yearlyBreakdownData,
      highestSub,
      topCategory,
      categoryColorMap,
      totalMonthlyBudget
    };
  }, [subscriptions, settings.exchangeRates, lang]);


  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
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

  const renderYearlyLabel = (props: any) => {
    const { x = 0, y = 0, width = 0, height = 0, value, payload } = props;
    const text = `$${value} (${payload?.percentage ?? 0}%)`;
    const labelX = x + width - 8; // keep inside the bar
    const labelY = y + height / 2 + 4;
    return (
      <text
        x={labelX}
        y={labelY}
        textAnchor="end"
        fill="#6b7280"
        fontSize={11}
        fontWeight={500}
      >
        {text}
      </text>
    );
  };

  const renderYearlyTooltip = ({ payload }: any) => {
    if (!payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;
    return (
      <div className="bg-white rounded-xl shadow-md px-4 py-3 text-sm text-gray-900 border border-gray-100">
        {`${data.name} (${data.percentage ?? 0}%)：$${Number(data.value || 0).toFixed(1)}`}
      </div>
    );
  };

  const yearlyVisibleRows = Math.min(dashboardData.yearlyBreakdownData.length || 6, 6);
  const yearlyChartHeight = Math.max(dashboardData.yearlyBreakdownData.length, 6) * 52;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Cards Row 1: Money & Counts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Monthly Card */}
        <div className="mac-surface p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <DollarSign size={80} className="text-primary-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium z-10">{t('monthly_paid_pending')}</p>
          <div className="flex items-baseline space-x-2 mt-2 z-10">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white">${dashboardData.monthlyPaid}</h3>
              <span className="text-gray-400 text-lg">/</span>
              <span className="text-xl font-semibold text-gray-400">${dashboardData.monthlyPending}</span>
          </div>
          <div className="mt-4 w-full bg-gray-100 dark:bg-slate-700 h-1.5 rounded-full z-10 overflow-hidden">
             <div 
                className="h-full bg-primary-500 rounded-full" 
                style={{ width: `${(parseFloat(dashboardData.monthlyPaid) / (parseFloat(dashboardData.monthlyPaid) + parseFloat(dashboardData.monthlyPending) || 1)) * 100}%` }}
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
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white">${dashboardData.yearlyPaid}</h3>
              <span className="text-gray-400 text-lg">/</span>
              <span className="text-xl font-semibold text-gray-400">${dashboardData.yearlyPending}</span>
          </div>
          <div className="mt-4 w-full bg-gray-100 dark:bg-slate-700 h-1.5 rounded-full z-10 overflow-hidden">
             <div 
                className="h-full bg-blue-500 rounded-full" 
                style={{ width: `${(parseFloat(dashboardData.yearlyPaid) / (parseFloat(dashboardData.yearlyPaid) + parseFloat(dashboardData.yearlyPending) || 1)) * 100}%` }}
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
        </div>
      </div>

       {/* Stats Cards Row 2: Highlights (Moved from Statistics) */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Highest Sub */}
	           <div className="mac-surface p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div>
                     <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">{t('highest_sub')}</p>
                     <h3 className="text-2xl font-bold text-gray-900 dark:text-white truncate max-w-[200px]" title={dashboardData.highestSub.name}>
                        {dashboardData.highestSub.name}
                     </h3>
                     <p className="text-xs text-gray-400 mt-1">
                        ${dashboardData.highestSub.value.toFixed(2)} / 12mo
                     </p>
                </div>
                <div className="p-3 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-xl">
                    <CreditCard size={24}/>
                </div>
           </div>

	           {/* Top Category */}
	           <div className="mac-surface p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
	                <div>
	                     <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">{t('top_category')}</p>
	                     <h3 className="text-2xl font-bold text-gray-900 dark:text-white truncate max-w-[200px]" title={dashboardData.topCategory.name}>
	                        {dashboardData.topCategory.name}
	                     </h3>
	                     <p className="text-xs text-gray-400 mt-1">
	                        ${dashboardData.topCategory.value.toFixed(2)} / 12mo
	                     </p>
	                </div>
	                <CategoryGlyph category={dashboardData.topCategory.name} containerSize={44} size={22} />
	           </div>
       </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Spend */}
	        <div className="mac-surface p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-96">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('monthly_spend_category')}</h3>
          {subscriptions.length > 0 ? (
            <div className="h-full flex items-center gap-6">
              <div className="flex-1 h-full min-h-[240px]">
                <div className="w-full h-full outline-none" tabIndex={-1}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                      <Pie
                        data={dashboardData.categoryData}
                        cx="50%"
                        cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={false}
                      labelLine={false}
                    >
                      {dashboardData.categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string, props: any) => [`$${value}`, `${name} (${props.payload.percentage}%)`]}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                  </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="w-48 space-y-2">
                {dashboardData.categoryData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="truncate" title={entry.name}>{entry.name}</span>
                    </div>
                    <span className="text-xs text-gray-400">{entry.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </div>

        {/* Yearly Breakdown Bar Chart */}
	        <div className="mac-surface p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-96 overflow-hidden">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('yearly_expenditure_breakdown')}</h3>
          {dashboardData.yearlyBreakdownData.length > 0 ? (
            <div className="h-full overflow-y-auto relative" style={{ maxHeight: 6 * 52 + 80 }}>
              <div style={{ height: Math.max(dashboardData.yearlyBreakdownData.length, 6) * 52, overflow: 'hidden' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.yearlyBreakdownData} layout="vertical" margin={{ top: 10, right: 24, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide domain={[0, 'dataMax']} />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12, fill: '#9ca3af'}} />
                    <Tooltip 
                      cursor={{fill: 'transparent'}}
                      content={renderYearlyTooltip}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={28}>
                        {/* Hide labels by default; hover shows tooltip already */}
                        {dashboardData.yearlyBreakdownData.map((entry, idx) => (
                          <Cell key={entry.name} fill={dashboardData.categoryColorMap[entry.name] || COLORS[idx % COLORS.length]} />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              {t('no_paid_data_year')}
            </div>
          )}
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
                                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{item.sub.name}</td>
	                                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
	                                      <div className="flex items-center gap-2">
	                                        <CategoryGlyph category={item.sub.category} containerSize={18} size={12} />
	                                        <span className="truncate">{displayCategoryLabel(item.sub.category, lang)}</span>
	                                      </div>
	                                    </td>
                                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                                        {item.sub.currency === 'USD' ? '$' : item.sub.currency} {item.cost.toFixed(2)}
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
                                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{item.sub.name}</td>
	                                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
	                                      <div className="flex items-center gap-2">
	                                        <CategoryGlyph category={item.sub.category} containerSize={18} size={12} />
	                                        <span className="truncate">{displayCategoryLabel(item.sub.category, lang)}</span>
	                                      </div>
	                                    </td>
                                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                                        {item.sub.currency === 'USD' ? '$' : item.sub.currency} {item.cost.toFixed(2)}
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
    </div>
  );
};

export default Dashboard;
