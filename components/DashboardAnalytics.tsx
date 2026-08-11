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
import { BarChart3 } from 'lucide-react';
import { AppSettings, Subscription } from '../types';
import { formatCurrency } from '../services/currency';
import { formatLocalYMD, getTodayYMD, parseLocalYMD } from '../services/dateUtils';
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
      fill="var(--muted)"
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
    const today = parseLocalYMD(getTodayYMD(settings.timezone));
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const dayBeforeMonth = new Date(year, month, 0);
    today.setHours(0, 0, 0, 0);
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

        let billingDate = parseLocalYMD(billingYmd);
        const persistedNextBilling = parseLocalYMD(subscription.nextBillingDate);
        if (
          billingDate > today
          && Number.isFinite(persistedNextBilling.getTime())
        ) {
          billingDate = persistedNextBilling;
        }
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
  }, [lang, settings.exchangeRates, settings.timezone, subscriptions]);

  return (
    <div className="animate-fade-in pb-4">
      <section className="statement-card flex h-[430px] flex-col overflow-hidden">
        <div className="flex items-end justify-between border-b px-5 py-4 sm:px-6" style={{ borderColor: 'var(--line)' }}>
          <div>
            <div className="eyebrow mb-2 flex items-center gap-2">
              <BarChart3 size={14} aria-hidden="true" />
              {t('monthly_statement')}
            </div>
            <h3 className="font-display text-lg font-semibold tracking-[-0.025em] text-[var(--ink)]">
            {t('payment_distribution')}
            </h3>
          </div>
          <p className="font-data text-xs text-[var(--muted)]">{monthLabel}</p>
        </div>

        <div className="min-h-0 w-full flex-1 overflow-x-auto px-2 pb-3 pt-1 sm:px-4">
          <div className="h-full" style={{ minWidth: distributionChartMinWidth }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distributionData}
                margin={{ top: 72, right: 24, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tick={{ fontSize: 11, fill: 'var(--muted)', fontFamily: 'IBM Plex Mono' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: 'IBM Plex Mono' }}
                  tickFormatter={(value) => formatCurrency(value as number, 'USD', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                />
                <Tooltip
                  cursor={{ fill: 'color-mix(in srgb, var(--rail-teal) 8%, transparent)' }}
                  content={({ label, payload }) => {
                    if (!payload?.length) return null;
                    const point = payload[0]?.payload as DistributionPoint | undefined;
                    if (!point || point.count === 0) return null;
                    return (
                      <div className="chart-tooltip space-y-1 rounded-xl p-3 text-sm">
                        <div className="font-semibold text-[var(--ink)]">
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
                  fill="var(--rail-teal)"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={20}
                >
                  <LabelList dataKey="amount" content={<DistributionLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardAnalytics;
