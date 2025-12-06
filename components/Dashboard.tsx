import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Subscription, Frequency } from '../types';
import { DollarSign, Calendar, TrendingUp } from 'lucide-react';

interface Props {
  subscriptions: Subscription[];
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

const Dashboard: React.FC<Props> = ({ subscriptions }) => {
  
  const getMonthlyCost = (sub: Subscription) => {
    switch (sub.frequency) {
      case Frequency.MONTHLY: return sub.price;
      case Frequency.QUARTERLY: return sub.price / 3;
      case Frequency.SEMI_ANNUALLY: return sub.price / 6;
      case Frequency.YEARLY: return sub.price / 12;
      default: return sub.price;
    }
  };

  const stats = useMemo(() => {
    let monthlyTotal = 0;
    
    subscriptions.forEach(sub => {
      monthlyTotal += getMonthlyCost(sub);
    });

    return {
      monthly: monthlyTotal.toFixed(2),
      yearly: (monthlyTotal * 12).toFixed(2),
      count: subscriptions.length
    };
  }, [subscriptions]);

  const categoryData = useMemo(() => {
    const data: Record<string, number> = {};
    subscriptions.forEach(sub => {
      const cost = getMonthlyCost(sub);
      data[sub.category] = (data[sub.category] || 0) + cost;
    });
    return Object.keys(data).map(key => ({ name: key, value: parseFloat(data[key].toFixed(2)) }));
  }, [subscriptions]);

  // Sort categories by value for better visual
  const sortedCategoryData = categoryData.sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-primary-100 text-primary-600 rounded-xl">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Monthly Cost</p>
            <h3 className="text-2xl font-bold text-gray-900">${stats.monthly}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Yearly Projected</p>
            <h3 className="text-2xl font-bold text-gray-900">${stats.yearly}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-xl">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Active Subs</p>
            <h3 className="text-2xl font-bold text-gray-900">{stats.count}</h3>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Spend */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-96">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Monthly Spend by Category</h3>
          {subscriptions.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sortedCategoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sortedCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `$${value}`}
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

        {/* Cost Bar Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-96">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Cost Breakdown</h3>
          {subscriptions.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedCategoryData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                <Tooltip 
                  formatter={(value: number) => `$${value}`}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;