import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AppSettings, Subscription } from '../types';
import { formatCurrency } from '../services/currency';
import { formatLocalYMD, parseLocalYMD } from '../services/dateUtils';
import { getT } from '../services/i18n';
import { calculateNextBillingDateYMD } from '../shared/billingDate.js';

interface Props {
  subscriptions: Subscription[];
  settings: AppSettings;
  lang: 'en' | 'zh';
}

interface DistributionPoint {
  day: number;
  amount: number;
  count: number;
}

const DISTRIBUTION_CHART_BASE_MIN_WIDTH = 900;
const DISTRIBUTION_CHART_FIXED_WIDTH = 120;
const DISTRIBUTION_LABEL_CHARACTER_WIDTH = 7;
const DISTRIBUTION_LABEL_GAP = 12;

const convertToUSD = (
  amount: number,
  currency: string,
  rates: Record<string, number> | undefined,
): number => {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  if (!currency || currency === 'USD') return amount;
  const rate = rates?.[currency] ?? 1;
  return Number.isFinite(rate) && rate > 0 ? amount / rate : amount;
};

const formatDistributionLabel = (value: number) => formatCurrency(value, 'USD', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const DistributionLabel = ({
  x = 0,
  y = 0,
  width = 0,
  value = 0,
}: {
  x?: number;
  y?: number;
  width?: number;
  value?: number;
}) => {
  if (!Number.isFinite(value) || value <= 0) return null;

  const label = formatDistributionLabel(value);
  const centerX = x + width / 2;
  const labelY = Math.max(y - 8, 84);

  return (
    <text
      x={centerX}
      y={labelY}
      fill="#6b7280"
      fontSize={11}
      fontWeight={600}
      textAnchor="middle"
    >
      {label}
    </text>
  );
};

const DashboardAnalytics: React.FC<Props> = ({ subscriptions, lang, settings }) => {
  const t = getT(lang);

  const { distributionData, distributionChartMinWidth, monthLabel } = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const dayBeforeMonth = new Date(year, month, 0);
    const points: DistributionPoint[] = Array.from(
      { length: monthEnd.getDate() },
      (_, index) => ({ day: index + 1, amount: 0, count: 0 }),
    );

    subscriptions
      .filter((subscription) => subscription.status === 'active' && subscription.startDate)
      .forEach((subscription) => {
        const billingYmd = calculateNextBillingDateYMD(
          subscription.startDate,
          subscription.frequency,
          formatLocalYMD(dayBeforeMonth),
        );
        if (!billingYmd) return;

        const billingDate = parseLocalYMD(billingYmd);
        if (
          Number.isNaN(billingDate.getTime())
          || billingDate < monthStart
          || billingDate > monthEnd
        ) {
          return;
        }

        const point = points[billingDate.getDate() - 1];
        point.amount += convertToUSD(
          subscription.price,
          subscription.currency,
          settings.exchangeRates,
        );
        point.count += 1;
      });

    return {
      distributionData: points,
      distributionChartMinWidth: Math.max(
        DISTRIBUTION_CHART_BASE_MIN_WIDTH,
        points.length * (
          Math.max(
            ...points.map((point) => (
              point.amount > 0 ? formatDistributionLabel(point.amount).length : 0
            )),
          ) * DISTRIBUTION_LABEL_CHARACTER_WIDTH
          + DISTRIBUTION_LABEL_GAP
        ) + DISTRIBUTION_CHART_FIXED_WIDTH,
      ),
      monthLabel: new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: 'long',
      }).format(monthStart),
    };
  }, [lang, settings.exchangeRates, subscriptions]);

  return (
    <div className="animate-fade-in pb-10">
      <div className="mac-surface p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-[460px] flex flex-col">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">
            {t('payment_distribution')}
          </h3>
          <p className="text-xs text-gray-400 mt-1">{monthLabel}</p>
        </div>

        <div className="flex-1 w-full min-h-0 overflow-x-auto">
          <div className="h-full" style={{ minWidth: distributionChartMinWidth }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distributionData}
                margin={{ top: 90, right: 24, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  tickFormatter={(value) => formatCurrency(value as number, 'USD', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
                  content={({ label, payload }) => {
                    if (!payload?.length) return null;
                    const point = payload[0]?.payload as DistributionPoint | undefined;
                    if (!point || point.count === 0) return null;
                    return (
                      <div className="chart-tooltip p-3 rounded-xl text-sm text-gray-700 dark:text-gray-200 space-y-1">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {lang === 'zh' ? `${label}日` : `Day ${label}`}
                        </div>
                        <div>{`${t('sub_count')}: ${point.count}`}</div>
                        <div>{`${t('total_amount')}: ${formatCurrency(point.amount, 'USD')}`}</div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="amount"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                >
                  <LabelList dataKey="amount" content={<DistributionLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardAnalytics;
