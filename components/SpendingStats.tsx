import React from 'react';
import { BarChart3, CalendarDays, CircleDollarSign, TrendingUp } from 'lucide-react';
import type { AppSettings, ServerClock, Subscription } from '../types';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { displayCategoryLabel } from '../services/displayLabels';
import { formatCurrency } from '../services/currency';
import { formatLocalYMD, getTodayYMD } from '../services/dateUtils';
import { getT } from '../services/i18n';

interface Props {
  subscriptions: Subscription[];
  settings: AppSettings;
  lang: 'zh' | 'en';
  serverClock: ServerClock;
}

export const EstimateNote = ({ lang }: { lang: 'zh' | 'en' }) => (
  <p className="estimate-note">{getT(lang)('estimate_note')}</p>
);

export const MissingRatesNote = ({ count, lang }: { count: number; lang: 'zh' | 'en' }) =>
  count > 0 ? (
    <p role="status" className="rate-notice">
      {lang === 'zh'
        ? `${count} 条订阅缺少汇率，未计入美元合计；原币金额仍保留。请在设置中刷新汇率。`
        : `${count} subscriptions lack exchange rates and are excluded from USD totals. Original amounts remain visible. Refresh rates in Settings.`}
    </p>
  ) : null;

const SpendingStats: React.FC<Props> = ({ subscriptions, settings, lang, serverClock }) => {
  const t = getT(lang);
  const data = useDashboardStats(subscriptions, settings, serverClock);
  const monthlyTotal = data.monthlyPaid + data.monthlyPending;
  const categories = new Map<string, number>();
  const dates = new Map<string, number>();
  data.monthlyEvents.forEach((event) => {
    if (event.cost === null) return;
    categories.set(event.sub.category, (categories.get(event.sub.category) || 0) + event.cost);
    const date = formatLocalYMD(event.date);
    dates.set(date, (dates.get(date) || 0) + event.cost);
  });
  const categoryRows = [...categories].sort((a, b) => b[1] - a[1]);
  const dateRows = [...dates].sort(([a], [b]) => a.localeCompare(b));
  const maxDay = Math.max(0, ...dateRows.map(([, cost]) => cost));
  const now = new Date(
    serverClock.serverTimeMs + Math.max(0, Date.now() - serverClock.receivedAtMs)
  );
  const month = getTodayYMD(settings.timezone, now).slice(0, 7);

  return (
    <div className="workspace-page spending-page page-stack">
      <header className="page-heading">
        <div>
          <h1 className="page-title">{t('spending')}</h1>
          <p className="page-copy">{t('spending_copy')}</p>
        </div>
        <span className="date-chip">
          <CalendarDays size={15} aria-hidden="true" />
          {month}
        </span>
      </header>
      <MissingRatesNote count={data.unconvertedCount} lang={lang} />
      <div className="summary-grid">
        {[
          { label: t('monthly_estimate'), value: monthlyTotal, icon: CircleDollarSign },
          {
            label: t('yearly_estimate'),
            value: data.yearlyPaid + data.yearlyPending,
            icon: TrendingUp,
          },
          { label: t('paid_estimate'), value: data.monthlyPaid, icon: CalendarDays },
          { label: t('pending_estimate'), value: data.monthlyPending, icon: BarChart3 },
        ].map(({ label, value, icon: Icon }, i) => (
          <section key={label} className={`summary-card ${i === 0 ? 'summary-primary' : ''}`}>
            <div className="summary-label">
              <span>{label}</span>
              <Icon size={17} aria-hidden="true" />
            </div>
            <div className="summary-value">{formatCurrency(value, 'USD')}</div>
            <p className="summary-hint">{t('base_usd')}</p>
          </section>
        ))}
      </div>
      <div className="spending-grid">
        <section className="statement-card chart-card">
          <header className="section-heading">
            <h2>{t('category_spending')}</h2>
            <span className="unit-label">USD</span>
          </header>
          <div className="chart-body">
            <p className="chart-description">{t('category_spending_copy')}</p>
            {categoryRows.length ? (
              <ul className="category-bars" aria-label={t('category_spending')}>
                {categoryRows.map(([category, value]) => (
                  <li key={category}>
                    <div className="bar-label">
                      <span>{displayCategoryLabel(category, lang)}</span>
                      <strong className="font-data">{formatCurrency(value, 'USD')}</strong>
                    </div>
                    <div className="bar-track" aria-hidden="true">
                      <div
                        style={{
                          width: `${monthlyTotal > 0 ? Math.max(0, (value / monthlyTotal) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <span className="bar-share">
                      {monthlyTotal > 0 ? ((value / monthlyTotal) * 100).toFixed(1) : '0'}%
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-panel">
                {t(data.monthlyEvents.length ? 'no_converted_cost' : 'rail_empty')}
              </p>
            )}
          </div>
        </section>
        <section className="statement-card chart-card">
          <header className="section-heading">
            <h2>{t('billing_distribution')}</h2>
            <span className="unit-label">USD</span>
          </header>
          <div className="chart-body">
            <p className="chart-description">{t('billing_distribution_copy')}</p>
            {dateRows.length ? (
              <table className="distribution-table">
                <caption className="sr-only">{t('billing_distribution')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('billing_day')}</th>
                    <th scope="col">{t('cost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dateRows.map(([date, value]) => (
                    <tr key={date}>
                      <th scope="row">{date}</th>
                      <td>
                        <span
                          className="distribution-fill"
                          aria-hidden="true"
                          style={{ width: `${maxDay > 0 ? (value / maxDay) * 100 : 0}%` }}
                        />
                        <strong>{formatCurrency(value, 'USD')}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-panel">
                {t(data.monthlyEvents.length ? 'no_converted_cost' : 'rail_empty')}
              </p>
            )}
          </div>
        </section>
      </div>
      <EstimateNote lang={lang} />
    </div>
  );
};

export default SpendingStats;
