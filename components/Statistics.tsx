
import React, { useMemo, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, PieChart, Pie, Cell, ComposedChart
} from 'recharts';
import { Subscription, Frequency, AppSettings } from '../types';
import { TrendingUp, X, BarChart2, ChevronLeft, ChevronRight, Maximize2, Minimize2, Calendar } from 'lucide-react';
import { getT } from '../services/i18n';

interface Props {
  subscriptions: Subscription[];
  settings: AppSettings;
  lang: 'en' | 'zh';
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#84cc16', '#64748b', '#0ea5e9'];

// --- Types ---
type ChartType = 'line' | 'bar';
type TimeRange = '12m' | '6m' | 'ytd' | 'all';
type HistoryMode = 'month' | 'quarter' | 'year';
type FullScreenChart = 'trend' | 'distribution' | 'category' | null;
type Translator = (key: any) => string;

interface PaymentRecord {
    subId: string;
    subName: string;
    category: string;
    date: Date;
    formattedDate: string;
    amount: number;
    amountUsd: number;
    currency: string;
    status: string;
}

interface HistoryGroup {
    title: string;
    total: number;
    count: number;
    days: number;
    records: PaymentRecord[];
}

const HistoryTableList: React.FC<{ records: PaymentRecord[], t: Translator }> = ({ records, t }) => (
  <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-700/50">
              <tr>
                  <th className="px-4 py-3">{t('service_name')}</th>
                  <th className="px-4 py-3">{t('payment_date')}</th>
                  <th className="px-4 py-3">{t('category')}</th>
                  <th className="px-4 py-3 text-right">{t('cost')}</th>
              </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {records.map((rec, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{rec.subName}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{rec.formattedDate}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{rec.category}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                          {rec.currency ? `${rec.currency} ${rec.amount.toFixed(2)}` : `$${rec.amount.toFixed(2)}`}
                      </td>
                  </tr>
              ))}
              {records.length === 0 && (
                  <tr><td colSpan={4} className="p-4 text-center text-gray-400">{t('no_records')}</td></tr>
              )}
          </tbody>
      </table>
  </div>
);

const FullScreenModal: React.FC<{ children: React.ReactNode, onClose: () => void, t: Translator }> = ({ children, onClose, t }) => (
  <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col animate-fade-in">
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-slate-800">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">{t('full_screen')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-gray-500 dark:text-gray-300">
              <Minimize2 size={24} />
          </button>
      </div>
      <div className="flex-1 p-6 bg-gray-50 dark:bg-slate-900 overflow-hidden">
          <div className="w-full h-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
             {children}
          </div>
      </div>
  </div>
);

const ModalWithPagination: React.FC<{ title: string, records: PaymentRecord[], onClose: () => void, t: Translator }> = ({ title, records, onClose, t }) => {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.ceil(records.length / pageSize);
  const paginated = records.slice((page-1)*pageSize, page*pageSize);

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
                  <div>
                      <h2 className="text-xl font-bold text-gray-800 dark:text-white">{t('payment_details')}</h2>
                      <p className="text-sm text-gray-500">{title}</p>
                  </div>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <X size={24} />
                  </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-0">
                   <HistoryTableList records={paginated} t={t} />
              </div>

              <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-slate-800">
                  <span className="text-sm text-gray-500">
                      {t('show_10_records').replace('{total}', records.length.toString())}
                  </span>
                  <div className="flex items-center gap-2">
                      <button 
                          disabled={page === 1}
                          onClick={() => setPage(p => p - 1)}
                          className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-white"
                      >
                          <ChevronLeft size={16}/>
                      </button>
                      <span className="text-sm font-medium dark:text-white">
                          {t('page').replace('{page}', page.toString()).replace('{total}', totalPages.toString())}
                      </span>
                      <button 
                           disabled={page === totalPages}
                           onClick={() => setPage(p => p + 1)}
                           className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-white"
                      >
                          <ChevronRight size={16}/>
                      </button>
                  </div>
              </div>
          </div>
      </div>
  );
};

const Statistics: React.FC<Props> = ({ subscriptions, lang, settings }) => {
    const t = getT(lang);

    const convertToUSD = (amount: number, currency: string) => {
        if (!amount) return 0;
        if (!currency || currency === 'USD') return amount;
        const rate = settings.exchangeRates?.[currency] || 1;
        return rate === 0 ? amount : amount / rate;
    };

    // --- State ---
    const [trendType, setTrendType] = useState<ChartType>('line');
    const [trendRange, setTrendRange] = useState<TimeRange>('12m');
    const [categoryRange, setCategoryRange] = useState<TimeRange>('12m');
    
    // Detailed History State
    const [historyMode, setHistoryMode] = useState<HistoryMode>('month');
    
    // Modals State
    const [showLifetimeModal, setShowLifetimeModal] = useState(false);
    const [detailModalGroup, setDetailModalGroup] = useState<HistoryGroup | null>(null);
    
    // --- Helper Functions ---

    // Generate billing events for a subscription up to today
    const getAllBillingEvents = (sub: Subscription): PaymentRecord[] => {
        const events: PaymentRecord[] = [];
        if (!sub.startDate) return events;
        
        let currentDate = new Date(sub.startDate);
        currentDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0,0,0,0);

        if (isNaN(currentDate.getTime())) return events;

        while (currentDate <= today) {
            events.push({
                subId: sub.id,
                subName: sub.name,
                category: sub.category,
                date: new Date(currentDate),
                formattedDate: currentDate.toISOString().split('T')[0],
                amount: sub.price,
                amountUsd: convertToUSD(sub.price, sub.currency),
                currency: sub.currency,
                status: sub.status || 'active'
            });

             switch (sub.frequency) {
                case Frequency.MONTHLY: currentDate.setMonth(currentDate.getMonth() + 1); break;
                case Frequency.QUARTERLY: currentDate.setMonth(currentDate.getMonth() + 3); break;
                case Frequency.SEMI_ANNUALLY: currentDate.setMonth(currentDate.getMonth() + 6); break;
                case Frequency.YEARLY: currentDate.setFullYear(currentDate.getFullYear() + 1); break;
                default: currentDate.setMonth(currentDate.getMonth() + 1);
            }
        }
        return events;
    };

    const allPayments = useMemo(() => {
        return subscriptions.flatMap(sub => getAllBillingEvents(sub)).sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [subscriptions, settings.exchangeRates]);

    // --- Data Processing ---

    // 1. Lifetime Spend
    const lifetimeSpend = useMemo(() => allPayments.reduce((acc, curr) => acc + curr.amountUsd, 0), [allPayments]);

    // 2. Trend Data (Line/Bar)
    const trendData = useMemo(() => {
        const today = new Date();
        const dataMap: Record<string, any> = {};
        const categories: string[] = Array.from(new Set(subscriptions.map(s => s.category)));

        // Determine Start Date based on Range
        let startDate = new Date(today);
        if (trendRange === '12m') startDate.setMonth(today.getMonth() - 11);
        else if (trendRange === '6m') startDate.setMonth(today.getMonth() - 5);
        else if (trendRange === 'ytd') startDate = new Date(today.getFullYear(), 0, 1);
        else if (trendRange === 'all') startDate = new Date(2020, 0, 1); // Arbitrary old date for "All"
        
        startDate.setDate(1); // Start of month

        // Initialize buckets
        const iterDate = new Date(startDate);
        while (iterDate <= today) {
            const key = iterDate.toLocaleString('default', { month: 'short', year: '2-digit' });
            dataMap[key] = { name: key, total: 0, count: 0 };
            categories.forEach((c: string) => dataMap[key][c] = 0);
            iterDate.setMonth(iterDate.getMonth() + 1);
        }

        // Fill Data
        allPayments.forEach(p => {
            if (p.date >= startDate) {
                const key = p.date.toLocaleString('default', { month: 'short', year: '2-digit' });
                if (dataMap[key]) {
                    dataMap[key].total += p.amountUsd;
                    dataMap[key].count += 1;
                    const catKey = p.category as string;
                    dataMap[key][catKey] = (dataMap[key][catKey] || 0) + p.amountUsd;
                }
            }
        });

        return Object.values(dataMap);
    }, [allPayments, trendRange, subscriptions]);


    // 3. Category Pie Chart Data
    const categoryPieData = useMemo(() => {
        const today = new Date();
        let startDate = new Date(today);
        if (categoryRange === '12m') startDate.setMonth(today.getMonth() - 11);
        else if (categoryRange === '6m') startDate.setMonth(today.getMonth() - 5);
        else if (categoryRange === 'ytd') startDate = new Date(today.getFullYear(), 0, 1);
        else if (categoryRange === 'all') startDate = new Date(2000, 0, 1);

        const totals: Record<string, { value: number, count: number }> = {};
        let grandTotal = 0;

        allPayments.forEach(p => {
             if (p.date >= startDate) {
                 if (!totals[p.category]) totals[p.category] = { value: 0, count: 0 };
                 totals[p.category].value += p.amountUsd;
                 totals[p.category].count += 1;
                 grandTotal += p.amountUsd;
             }
        });

        return Object.entries(totals).map(([name, stats]) => ({
            name,
            value: stats.value,
            count: stats.count,
            percentage: grandTotal > 0 ? (stats.value / grandTotal) * 100 : 0
        })).sort((a, b) => b.value - a.value);

    }, [allPayments, categoryRange]);


    // 4. Daily Distribution (Amount Only)
    const distributionData = useMemo(() => {
        const days = Array(31).fill(0).map((_, i) => ({ day: i + 1, amount: 0, count: 0 }));
        
        subscriptions.filter(s => s.status === 'active').forEach(sub => {
             const day = new Date(sub.startDate).getDate();
             if (day >= 1 && day <= 31) {
                 days[day - 1].amount += convertToUSD(sub.price, sub.currency);
                 days[day - 1].count += 1;
             }
        });
        return days;
    }, [subscriptions, settings.exchangeRates]);


    // 5. Historical Data Buckets (Month/Quarter/Year)
    const historyGroups = useMemo(() => {
        const groups: HistoryGroup[] = [];
        const today = new Date();

        const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

        if (historyMode === 'month') {
             // Last 3 Months
             for (let i = 0; i < 3; i++) {
                 const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                 const title = d.toLocaleString('default', { month: 'long', year: 'numeric' });
                 const records = allPayments.filter(p => 
                     p.date.getMonth() === d.getMonth() && p.date.getFullYear() === d.getFullYear()
                 );
                 const days = getDaysInMonth(d.getFullYear(), d.getMonth());
                 groups.push({ title, total: records.reduce((s, c) => s + c.amountUsd, 0), count: records.length, days, records });
             }
        } else if (historyMode === 'quarter') {
             // Last 3 Quarters
             const currMonth = today.getMonth();
             const currQStartMonth = currMonth - (currMonth % 3);
             
             for (let i = 0; i < 3; i++) {
                 const qStart = new Date(today.getFullYear(), currQStartMonth - (i * 3), 1);
                 const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 0);
                 
                 const qNum = Math.floor(qStart.getMonth() / 3) + 1;
                 const title = `Q${qNum} ${qStart.getFullYear()}`;
                 
                 const records = allPayments.filter(p => p.date >= qStart && p.date <= qEnd);
                 const days = Math.floor((qEnd.getTime() - qStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                 groups.push({ title, total: records.reduce((s, c) => s + c.amountUsd, 0), count: records.length, days, records });
             }
        } else if (historyMode === 'year') {
             // Last 3 Years
             for (let i = 0; i < 3; i++) {
                 const y = today.getFullYear() - i;
                 const title = y.toString();
                 const records = allPayments.filter(p => p.date.getFullYear() === y);
                 const days = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
                 groups.push({ title, total: records.reduce((s, c) => s + c.amountUsd, 0), count: records.length, days, records });
             }
        }
        return groups;
    }, [allPayments, historyMode]);


  // --- Render Components ---

  const renderTrendChart = () => (
     <ResponsiveContainer width="100%" height="100%">
        {trendType === 'line' ? (
            <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} tickFormatter={(val) => `$${val}`}/>
                <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                formatter={(value: number, name: string) => [
                    `$${value.toFixed(2)}`, 
                    t('total_amount')
                ]}
                />
                <Legend />
                <Area type="monotone" dataKey="total" stroke="#8b5cf6" fill="url(#colorTotal)" fillOpacity={0.2} strokeWidth={3} name="total" />
                <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
            </defs>
            </AreaChart>
        ) : (
            <BarChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} tickFormatter={(val) => `$${val}`}/>
                <Tooltip 
                cursor={{fill: 'transparent'}}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                formatter={(value: number, name: string, props: any) => [
                     `$${value.toFixed(2)}`,
                     `${name} (${props.payload.count} subs)`
                ]}
                />
                <Legend />
                {Array.from(new Set(subscriptions.map(s => s.category))).map((cat, index) => (
                    <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[index % COLORS.length]} radius={[0,0,0,0]} />
                ))}
            </BarChart>
        )}
    </ResponsiveContainer>
  );

  const renderDistributionChart = () => (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={distributionData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB"/>
            <XAxis dataKey="day" tick={{fontSize: 10, fill: '#9CA3AF'}} interval={0}/>
            <YAxis tick={{fontSize: 10, fill: '#9CA3AF'}} allowDecimals={false} tickFormatter={(val) => `$${val}`} />
            <Tooltip
                cursor={{fill: 'rgba(0,0,0,0.05)'}}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                formatter={(value: number, _name: string, props: any) => {
                    return [
                        `$${value.toFixed(2)}`,
                        `${t('sub_count')}: ${props?.payload?.count || 0}`
                    ];
                }}
                labelFormatter={(label) => `${label}日`}
                content={({ label, payload }) => {
                    if (!payload || !payload.length) return null;
                    const p = payload[0];
                    const amount = p.value as number;
                    const count = p.payload?.count ?? 0;
                    return (
                        <div className="p-3 rounded-xl bg-white shadow-md border border-gray-100 text-sm text-gray-700 space-y-1">
                            <div className="font-semibold text-gray-900">{`${label}日`}</div>
                            <div className="text-gray-600">{`${t('sub_count')}: ${count}`}</div>
                            <div className="text-gray-600">{`${t('total_amount')}: $${amount.toFixed(2)}`}</div>
                        </div>
                    );
                }}
            />
            <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} name="amount" />
        </BarChart>
    </ResponsiveContainer>
  );

  const renderCategoryChart = () => (
    <div className="h-full flex items-center gap-6">
      <div className="flex-1 h-full min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <Pie
                  data={categoryPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={false}
                  labelLine={false}
              >
                  {categoryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
              </Pie>
              <Tooltip 
                      formatter={(value: number, name: string, props: any) => [
                          `$${value.toFixed(2)} (${t('sub_count')}: ${props.payload.count})`, 
                          `${name}`
                      ]}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-48 space-y-2">
        {categoryPieData.map((entry, index) => (
          <div key={entry.name} className="flex items-center justify-between text-sm text-gray-700 dark:text-gray-200">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="truncate" title={entry.name}>{entry.name}</span>
              </div>
              <span className="text-xs text-gray-400">{entry.percentage.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Lifetime Modal */}
      {showLifetimeModal && (
          <ModalWithPagination 
            title={t('all_time')} 
            records={allPayments} 
            onClose={() => setShowLifetimeModal(false)}
            t={t} 
          />
      )}

      {/* Detail Modal for History Group */}
      {detailModalGroup && (
          <ModalWithPagination 
            title={detailModalGroup.title} 
            records={detailModalGroup.records} 
            onClose={() => setDetailModalGroup(null)}
            t={t} 
          />
      )}

      {/* 1. Lifetime Spend (Clickable Card) */}
      <div 
        onClick={() => setShowLifetimeModal(true)}
        className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:shadow-md transition-all group flex items-center justify-between"
      >
        <div>
             <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg group-hover:scale-110 transition-transform"><TrendingUp size={24}/></div>
                <span className="text-lg text-gray-500 dark:text-gray-400 font-medium">{t('lifetime_spend')}</span>
             </div>
             <h3 className="text-4xl font-bold text-gray-900 dark:text-white mt-2">${lifetimeSpend.toLocaleString()}</h3>
             <p className="text-sm text-gray-400 mt-2 flex items-center gap-1 group-hover:text-primary-500 transition-colors">
                 {t('view_details')} <ChevronRight size={14}/>
             </p>
        </div>
        <div className="hidden md:block opacity-10 group-hover:opacity-20 transition-opacity">
            <BarChart2 size={120} />
        </div>
      </div>

      {/* 2. Spending Trend */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-[500px] flex flex-col relative">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 pr-10">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('spending_trend')}</h3>
            
            <div className="flex flex-wrap items-center gap-3">
                 <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
                    <button onClick={() => setTrendType('line')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${trendType === 'line' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                        {t('line_chart')}
                    </button>
                    <button onClick={() => setTrendType('bar')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${trendType === 'bar' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                        {t('bar_chart')}
                    </button>
                 </div>

                 <select 
                    value={trendRange} 
                    onChange={(e) => setTrendRange(e.target.value as TimeRange)}
                    className="px-3 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none dark:text-white"
                 >
                     <option value="12m">{t('last_12_months')}</option>
                     <option value="6m">{t('last_6_months')}</option>
                     <option value="ytd">{t('ytd')}</option>
                     <option value="all">{t('all_time')}</option>
                 </select>
            </div>
         </div>
         <button onClick={() => setFullScreenChart('trend')} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title={t('full_screen')}>
             <Maximize2 size={18} />
         </button>
         
         <div className="flex-1 w-full min-h-0">
            {renderTrendChart()}
         </div>
      </div>

      {/* Row 3: Distribution & Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Payment Distribution */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-96 flex flex-col relative">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 pr-10">{t('payment_distribution')}</h3>
            <button onClick={() => setFullScreenChart('distribution')} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title={t('full_screen')}>
                <Maximize2 size={18} />
            </button>
            <div className="flex-1 w-full min-h-0">
                {renderDistributionChart()}
            </div>
          </div>

          {/* Category Pie Chart */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-96 flex flex-col relative">
             <div className="flex justify-between items-center mb-4 pr-10">
                 <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('category_balance')}</h3>
                 <select 
                    value={categoryRange} 
                    onChange={(e) => setCategoryRange(e.target.value as TimeRange)}
                    className="px-2 py-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs outline-none dark:text-white"
                 >
                     <option value="12m">{t('last_12_months')}</option>
                     <option value="ytd">{t('ytd')}</option>
                     <option value="all">{t('all_time')}</option>
                 </select>
             </div>
             <button onClick={() => setFullScreenChart('category')} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title={t('full_screen')}>
                <Maximize2 size={18} />
             </button>
             
             <div className="flex-1 w-full min-h-0 relative">
                {renderCategoryChart()}
            </div>
         </div>
      </div>

      {/* 4. Detailed History Section (Cards) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <div>
                   <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('payment_details')}</h3>
                   <p className="text-sm text-gray-500">{t(`history_3_${historyMode}s`)}</p>
               </div>
               
               <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
                   {(['month', 'quarter', 'year'] as const).map(mode => (
                       <button 
                         key={mode}
                         onClick={() => setHistoryMode(mode)}
                         className={`px-4 py-2 rounded-md text-xs font-medium capitalize transition-all ${historyMode === mode ? 'bg-white dark:bg-slate-600 shadow-sm text-primary-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                       >
                           {t(mode)}
                       </button>
                   ))}
               </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {historyGroups.map((group, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-slate-700/30 rounded-2xl p-6 border border-gray-100 dark:border-gray-700/50 flex flex-col hover:border-primary-200 dark:hover:border-primary-500/30 transition-colors">
                      <div className="flex items-center gap-2 mb-4 text-gray-500 dark:text-gray-400">
                          <Calendar size={18} />
                          <span className="font-semibold">{group.title}</span>
                      </div>
                      
                      <div className="space-y-4 mb-6">
                          <div>
                              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t('total_amount')}</p>
                              <p className="text-2xl font-bold text-gray-800 dark:text-white">${group.total.toFixed(2)}</p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t('avg_daily')}</p>
                                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                                        ${(group.total / (group.days || 1)).toFixed(2)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{t('count')}</p>
                                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{group.count}</p>
                                </div>
                          </div>
                      </div>

                      <button 
                        onClick={() => setDetailModalGroup(group)}
                        className="mt-auto w-full py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-primary-50 hover:text-primary-600 hover:border-primary-200 dark:hover:bg-slate-700 transition-all shadow-sm"
                      >
                          {t('view_details')}
                      </button>
                  </div>
              ))}
          </div>
      </div>

    </div>
  );
};

export default Statistics;
