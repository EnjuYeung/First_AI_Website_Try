
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
import { Subscription, Frequency } from '../types';
import { DollarSign, Calendar, TrendingUp, CreditCard, Activity, CheckCircle, Clock } from 'lucide-react';
import { translations } from '../services/i18n';

interface Props {
  subscriptions: Subscription[];
  lang: 'en' | 'zh';
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

interface BillingEvent {
  sub: Subscription;
  date: Date;
  cost: number;
}

const Dashboard: React.FC<Props> = ({ subscriptions, lang }) => {
  
  const t = (key: keyof typeof translations['en']) => {
    const value = translations[lang][key];
    return value !== undefined ? value : key;
  };

  // Helper: Calculate all billing occurrences for a subscription within a date range
  const getBillingEventsInRange = (sub: Subscription, startRange: Date, endRange: Date): Date[] => {
    const events: Date[] = [];
    if (!sub.startDate) return events;

    let currentDate = new Date(sub.startDate);
    currentDate.setHours(0, 0, 0, 0);
    
    // Safety check to prevent infinite loops if start date is invalid
    if (isNaN(currentDate.getTime())) return events;

    // Advance to start of range if needed, or just iterate from start
    // Simple iteration is safer for accuracy with variable month lengths
    
    // Optimization: If start date is far in past, jump closer (logic simplified here for robustness)
    
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
        default: // Should not happen, prevent infinite loop
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
    const monthEnd = new Date(currentYear, currentMonth + 1, 0); // Last day of month
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

    // Collections
    const recentPayments: BillingEvent[] = [];
    const upcomingRenewals: BillingEvent[] = [];
    const yearlyPaidByCategory: Record<string, number> = {};

    subscriptions.forEach(sub => {
      // 1. Status Counts
      if (sub.status === 'cancelled') {
        cancelledCount++;
      } else {
        activeCount++;
      }

      // Only process Active subs for financial projections? 
      // Requirement isn't specific, but usually "Pending" implies active. 
      // "Paid" should account for everything that was paid, even if now cancelled.
      // Assuming: Paid calculation includes all. Pending includes only Active.

      // 2. Monthly Logic
      const monthEvents = getBillingEventsInRange(sub, monthStart, monthEnd);
      monthEvents.forEach(date => {
         if (date <= today) {
             monthlyPaid += sub.price;
         } else if (sub.status !== 'cancelled') {
             monthlyPending += sub.price;
         }
      });

      // 3. Yearly Logic & Breakdown
      const yearEvents = getBillingEventsInRange(sub, yearStart, yearEnd);
      yearEvents.forEach(date => {
        if (date <= today) {
            yearlyPaid += sub.price;
            // Accumulate for Breakdown Chart
            yearlyPaidByCategory[sub.category] = (yearlyPaidByCategory[sub.category] || 0) + sub.price;
        } else if (sub.status !== 'cancelled') {
            yearlyPending += sub.price;
        }
      });

      // 4. Recent Payments (Last 7 Days, including today)
      // Range: [Today - 7, Today]
      const recentEvents = getBillingEventsInRange(sub, last7DaysStart, today);
      recentEvents.forEach(date => {
        recentPayments.push({ sub, date, cost: sub.price });
      });

      // 5. Upcoming Renewals (Next 7 Days, excluding today for strict future, or from tomorrow)
      // Usually "Upcoming" implies future. Let's say (Today < date <= Today+7)
      if (sub.status !== 'cancelled') {
          // We can use nextBillingDate directly if available and valid, or calculate
          // Using nextBillingDate from prop is safer if user manually set it
          if (sub.nextBillingDate) {
              const nextDate = new Date(sub.nextBillingDate);
              nextDate.setHours(0,0,0,0);
              if (nextDate > today && nextDate <= next7DaysEnd) {
                  upcomingRenewals.push({ sub, date: nextDate, cost: sub.price });
              }
          }
      }
    });

    // Sorting
    recentPayments.sort((a, b) => b.date.getTime() - a.date.getTime()); // Newest first
    upcomingRenewals.sort((a, b) => a.date.getTime() - b.date.getTime()); // Soonest first

    // Pie Chart Data (Monthly Spend by Category - using Monthly Paid + Monthly Pending or just Monthly Cost?)
    // Requirement says "Monthly Spend by Category". Usually implies total monthly obligation.
    // Let's use the standard monthly cost for the Pie Chart to show "Budget Distribution".
    const getStandardMonthlyCost = (sub: Subscription) => {
        switch (sub.frequency) {
            case Frequency.MONTHLY: return sub.price;
            case Frequency.QUARTERLY: return sub.price / 3;
            case Frequency.SEMI_ANNUALLY: return sub.price / 6;
            case Frequency.YEARLY: return sub.price / 12;
            default: return sub.price;
        }
    };
    
    const categoryDataMap: Record<string, number> = {};
    let totalMonthlyBudget = 0;
    subscriptions.filter(s => s.status === 'active').forEach(sub => {
        const cost = getStandardMonthlyCost(sub);
        categoryDataMap[sub.category] = (categoryDataMap[sub.category] || 0) + cost;
        totalMonthlyBudget += cost;
    });
    
    const categoryData = Object.keys(categoryDataMap).map(key => ({ 
        name: key, 
        value: parseFloat(categoryDataMap[key].toFixed(2)),
        percentage: totalMonthlyBudget > 0 ? Math.round((categoryDataMap[key] / totalMonthlyBudget) * 100) : 0
    })).sort((a, b) => b.value - a.value);


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
      yearlyBreakdownData
    };
  }, [subscriptions]);


  // Helper for Date Display
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Monthly Card */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between relative overflow-hidden group">
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
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between relative overflow-hidden group">
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
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between relative overflow-hidden group">
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

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Spend */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-96">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('monthly_spend_category')}</h3>
          {subscriptions.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dashboardData.categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percentage }) => `${name} (${percentage}%)`} 
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
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </div>

        {/* Yearly Breakdown Bar Chart */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-96">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('yearly_expenditure_breakdown')}</h3>
          {dashboardData.yearlyBreakdownData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardData.yearlyBreakdownData} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 12, fill: '#9ca3af'}} />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24}>
                    <LabelList 
                        dataKey="value" 
                        position="right" 
                        formatter={(val: number, index: number) => {
                             // Access payload via dashboardData
                             const item = dashboardData.yearlyBreakdownData.find(d => d.value === val);
                             return item ? `$${val} (${item.percentage}%)` : `$${val}`;
                        }}
                        style={{ fontSize: '11px', fill: '#6b7280', fontWeight: 500 }}
                    />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              No paid data this year
            </div>
          )}
        </div>
      </div>

      {/* New Grids: Recent & Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Payments */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-700/30">
                <div className="flex items-center gap-2">
                    <CheckCircle className="text-green-500" size={18}/>
                    <h3 className="font-bold text-gray-800 dark:text-white">{t('recent_payments')}</h3>
                </div>
            </div>
            <div className="overflow-x-auto flex-1">
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
                                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{item.sub.category}</td>
                                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                                        {item.sub.currency === 'USD' ? '$' : item.sub.currency} {item.cost.toFixed(2)}
                                    </td>
                                    <td className="px-5 py-3 text-right text-gray-500 dark:text-gray-400">{formatDate(item.date)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-8 text-center text-gray-400 text-sm">No recent payments</div>
                )}
            </div>
        </div>

        {/* Upcoming Renewals */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-slate-700/30">
                <div className="flex items-center gap-2">
                    <Clock className="text-orange-500" size={18}/>
                    <h3 className="font-bold text-gray-800 dark:text-white">{t('upcoming_renewals')}</h3>
                </div>
            </div>
            <div className="overflow-x-auto flex-1">
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
                                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{item.sub.category}</td>
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
                    <div className="p-8 text-center text-gray-400 text-sm">No upcoming renewals in 7 days</div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
