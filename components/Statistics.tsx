import React, { useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend 
} from 'recharts';
import { Subscription, Frequency } from '../types';
import { TrendingUp, Calendar, CreditCard, PieChart } from 'lucide-react';

interface Props {
  subscriptions: Subscription[];
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#84cc16'];

const Statistics: React.FC<Props> = ({ subscriptions }) => {

  // --- Helper Functions ---

  const getMonthlyCost = (sub: Subscription) => {
    switch (sub.frequency) {
      case Frequency.MONTHLY: return sub.price;
      case Frequency.QUARTERLY: return sub.price / 3;
      case Frequency.SEMI_ANNUALLY: return sub.price / 6;
      case Frequency.YEARLY: return sub.price / 12;
      default: return sub.price;
    }
  };

  const isPaymentDueInMonth = (sub: Subscription, year: number, month: number) => {
    const startDate = new Date(sub.startDate);
    // If subscription hasn't started yet
    if (startDate.getFullYear() > year || (startDate.getFullYear() === year && startDate.getMonth() > month)) {
      return false;
    }

    const monthDiff = (year - startDate.getFullYear()) * 12 + (month - startDate.getMonth());

    switch (sub.frequency) {
      case Frequency.MONTHLY: return true;
      case Frequency.QUARTERLY: return monthDiff % 3 === 0;
      case Frequency.SEMI_ANNUALLY: return monthDiff % 6 === 0;
      case Frequency.YEARLY: return monthDiff % 12 === 0;
      default: return false;
    }
  };

  // --- Data Calculations ---

  const overview = useMemo(() => {
    let lifetimeSpend = 0;
    let avgMonthly = 0;
    let highestSub = { name: 'None', price: 0 };
    const categoryTotals: Record<string, number> = {};

    const today = new Date();
    
    // Calculate Monthly Avg & Highest Sub
    subscriptions.forEach(sub => {
      const monthly = getMonthlyCost(sub);
      avgMonthly += monthly;
      
      if (sub.price > highestSub.price) {
        highestSub = { name: sub.name, price: sub.price };
      }

      // Lifetime Calculation (Simplified: From start date to now)
      const start = new Date(sub.startDate);
      const monthsActive = Math.max(0, (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth()));
      
      let paymentsCount = 0;
      if (sub.frequency === Frequency.MONTHLY) paymentsCount = monthsActive;
      if (sub.frequency === Frequency.QUARTERLY) paymentsCount = Math.floor(monthsActive / 3);
      if (sub.frequency === Frequency.SEMI_ANNUALLY) paymentsCount = Math.floor(monthsActive / 6);
      if (sub.frequency === Frequency.YEARLY) paymentsCount = Math.floor(monthsActive / 12);
      
      // Add initial payment
      if (start <= today) paymentsCount += 1;

      lifetimeSpend += paymentsCount * sub.price;

      // Category Totals for Top Category
      categoryTotals[sub.category] = (categoryTotals[sub.category] || 0) + monthly;
    });

    // Find top category
    let topCategory = { name: 'None', value: 0 };
    Object.entries(categoryTotals).forEach(([name, val]) => {
      if (val > topCategory.value) topCategory = { name, value: val };
    });

    return {
      lifetimeSpend,
      avgMonthly,
      highestSub,
      topCategory
    };
  }, [subscriptions]);


  // History Trend Data (Last 12 Months)
  const historyData = useMemo(() => {
    const data: any[] = [];
    const today = new Date();
    const categories = Array.from(new Set(subscriptions.map(s => s.category)));

    // Generate last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      
      const monthPoint: any = {
        name: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
      };

      categories.forEach(cat => monthPoint[cat] = 0);

      subscriptions.forEach(sub => {
        if (isPaymentDueInMonth(sub, year, month)) {
          monthPoint[sub.category] += sub.price;
        }
      });

      data.push(monthPoint);
    }
    return { data, categories };
  }, [subscriptions]);


  // Daily Distribution Data (1-31)
  const billingCycleData = useMemo(() => {
    const days = Array(31).fill(0).map((_, i) => ({ day: i + 1, value: 0 }));
    
    subscriptions.forEach(sub => {
        // Approximate: assume payment on start date's day of month
        const day = new Date(sub.startDate).getDate();
        if (day >= 1 && day <= 31) {
            days[day - 1].value += sub.price; // Stacking price to show load
        }
    });
    
    return days;
  }, [subscriptions]);

  
  // Category Radar Data
  const categoryRadarData = useMemo(() => {
      const cats: Record<string, number> = {};
      subscriptions.forEach(sub => {
          cats[sub.category] = (cats[sub.category] || 0) + getMonthlyCost(sub);
      });
      return Object.keys(cats).map(key => ({ subject: key, A: cats[key], fullMark: Math.max(...Object.values(cats)) * 1.2 }));
  }, [subscriptions]);


  if (subscriptions.length === 0) {
      return (
        <div className="flex items-center justify-center h-96 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-gray-700">
             <div className="text-center text-gray-500 dark:text-gray-400">
                 <PieChart size={48} className="mx-auto mb-4 opacity-50"/>
                 <p className="text-lg font-medium">Not enough data for analysis</p>
                 <p className="text-sm">Add subscriptions to see trends and insights.</p>
             </div>
        </div>
      )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><TrendingUp size={20}/></div>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Lifetime Spend</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">${overview.lifetimeSpend.toLocaleString()}</h3>
            <p className="text-xs text-gray-400 mt-1">Total calculated from start dates</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Calendar size={20}/></div>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Avg. Monthly</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">${overview.avgMonthly.toFixed(2)}</h3>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-pink-100 text-pink-600 rounded-lg"><CreditCard size={20}/></div>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Highest Sub</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white truncate" title={overview.highestSub.name}>{overview.highestSub.name}</h3>
            <p className="text-xs text-gray-400 mt-1">${overview.highestSub.price.toFixed(2)} / cycle</p>
        </div>

         <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><PieChart size={20}/></div>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Top Category</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{overview.topCategory.name}</h3>
            <p className="text-xs text-gray-400 mt-1">${overview.topCategory.value.toFixed(2)} / mo</p>
        </div>
      </div>

      {/* Row 2: Trend History */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-96">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Spending Trend (Last 12 Months)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={historyData.data} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
            <defs>
              {historyData.categories.map((cat, index) => (
                <linearGradient key={cat} id={`color${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
            <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            />
            <Legend verticalAlign="top" height={36}/>
            {historyData.categories.map((cat, index) => (
              <Area 
                key={cat}
                type="monotone" 
                dataKey={cat} 
                stackId="1" 
                stroke={COLORS[index % COLORS.length]} 
                fill={`url(#color${index})`} 
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Row 3: Detail Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Calendar Distribution */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-80">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Payment Distribution (Day of Month)</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={billingCycleData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB"/>
                    <XAxis dataKey="day" tick={{fontSize: 10, fill: '#9CA3AF'}} interval={2}/>
                    <Tooltip
                        cursor={{fill: 'transparent'}}
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Radar */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-80">
             <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Category Balance</h3>
             <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={categoryRadarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#6B7280', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                    <Radar
                        name="Spend"
                        dataKey="A"
                        stroke="#8b5cf6"
                        fill="#8b5cf6"
                        fillOpacity={0.4}
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                    />
                </RadarChart>
             </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};

export default Statistics;
