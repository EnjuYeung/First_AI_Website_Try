import React from 'react';
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  CreditCard,
  TrendingUp,
} from 'lucide-react';
import type { AppSettings, ServerClock, Subscription } from '../types';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { getT } from '../services/i18n';
import { formatLocalYMD, getTodayYMD, parseLocalYMD } from '../services/dateUtils';
import { formatCurrency } from '../services/currency';
import RenewalRail from './RenewalRail';
import { BillingAgenda } from './BillingAgenda';
import { EstimateNote, MissingRatesNote } from './SpendingStats';

interface Props {
  subscriptions: Subscription[];
  settings: AppSettings;
  lang: 'en' | 'zh';
  serverClock: ServerClock;
  onView?: (sub: Subscription) => void;
  onNavigate?: (tab: 'list' | 'spending') => void;
}

const Dashboard: React.FC<Props> = ({
  subscriptions,
  lang,
  settings,
  serverClock,
  onView,
  onNavigate,
}) => {
  const t = getT(lang);
  const data = useDashboardStats(subscriptions, settings, serverClock);
  const now = new Date(
    serverClock.serverTimeMs + Math.max(0, Date.now() - serverClock.receivedAtMs)
  );
  const today = parseLocalYMD(getTodayYMD(settings.timezone, now));
  const monthLabel = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
  }).format(today);
  const total = data.monthlyPaid + data.monthlyPending;
  const paidShare = total > 0 ? (data.monthlyPaid / total) * 100 : 0;
  const metrics = [
    {
      label: t('monthly_estimate'),
      value: formatCurrency(total, 'USD'),
      hint: t('base_usd'),
      icon: CircleDollarSign,
    },
    {
      label: t('yearly_estimate'),
      value: formatCurrency(data.yearlyPaid + data.yearlyPending, 'USD'),
      hint: `${today.getFullYear()} · ${t('cycle_estimate')}`,
      icon: TrendingUp,
    },
    {
      label: t('upcoming_count'),
      value: String(data.upcomingRenewals.length),
      hint: t('upcoming_count_hint'),
      icon: Clock3,
    },
    {
      label: t('active_count'),
      value: String(data.activeCount),
      hint: `${t('cancelled')} ${data.cancelledCount}`,
      icon: CreditCard,
    },
  ];

  return (
    <div className="workspace-page dashboard-page page-stack">
      <header className="page-heading">
        <div>
          <h1 className="page-title">
            {lang === 'zh' ? '订阅概览' : 'Your subscriptions, at a glance'}
          </h1>
          <p className="page-copy">
            {lang === 'zh'
              ? '知道花了多少，也知道下一笔何时到来。'
              : 'Know what you spend, and what is coming next.'}
          </p>
        </div>
        <span className="date-chip">
          <CalendarDays size={15} aria-hidden="true" />
          {monthLabel}
        </span>
      </header>
      <MissingRatesNote count={data.unconvertedCount} lang={lang} />
      <section className="summary-grid" aria-label={t('monthly_statement')}>
        {metrics.map(({ label, value, hint, icon: Icon }, i) => (
          <div key={label} className={`summary-card ${i === 0 ? 'summary-primary' : ''}`}>
            <div className="summary-label">
              <span>{label}</span>
              <Icon size={17} aria-hidden="true" />
            </div>
            <div className="summary-value">{value}</div>
            <p className="summary-hint">{hint}</p>
          </div>
        ))}
      </section>
      <div className="overview-bento">
        <BillingAgenda
          title={t('attention_queue')}
          events={data.upcomingRenewals}
          lang={lang}
          timeZone={settings.timezone}
          now={now}
          upcoming
          onView={onView}
        />
        <section className="statement-card month-breakdown">
          <header className="section-heading">
            <h2>{t('monthly_breakdown')}</h2>
            <span className="unit-label">USD</span>
          </header>
          <div className="breakdown-body">
            <p className="chart-description">
              {lang === 'zh'
                ? '按本月账期估算，提前安排支出。'
                : 'Plan ahead with this month’s billing estimates.'}
            </p>
            <dl className="breakdown-values">
              <div>
                <dt>
                  <i className="status-dot" />
                  {t('paid_estimate')}
                </dt>
                <dd>{formatCurrency(data.monthlyPaid, 'USD')}</dd>
              </div>
              <div>
                <dt>
                  <i className="status-dot pending-dot" />
                  {t('pending_estimate')}
                </dt>
                <dd>{formatCurrency(data.monthlyPending, 'USD')}</dd>
              </div>
            </dl>
            <div className="month-progress" aria-hidden="true">
              <span style={{ width: `${paidShare}%` }} />
            </div>
            <div className="breakdown-caption">
              <span>{lang === 'zh' ? '本月费用已付占比（估算）' : 'Paid share · estimated'}</span>
              <span>{paidShare.toFixed(0)}%</span>
            </div>
            {onNavigate && (
              <button className="text-action" type="button" onClick={() => onNavigate('spending')}>
                {t('view_spending')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </section>
      </div>
      <div className="desktop-billing-rail">
        <RenewalRail
          events={data.monthlyEvents}
          monthlyTotal={total}
          lang={lang}
          timeZone={settings.timezone}
          serverClock={serverClock}
        />
      </div>
      <section className="statement-card mobile-billing-agenda">
        <header className="section-heading">
          <h2>{t('renewal_rail_title')}</h2>
          <span className="count-badge">{data.monthlyEvents.length}</span>
        </header>
        {data.monthlyEvents.length ? (
          <ul>
            {data.monthlyEvents.map((event) => (
              <li key={`${event.sub.id}-${formatLocalYMD(event.date)}`}>
                <span className="month-day">{formatLocalYMD(event.date).slice(5)}</span>
                <button
                  type="button"
                  className="month-service"
                  onClick={() => onView?.(event.sub)}
                  disabled={!onView}
                >
                  {event.sub.name}
                </button>
                <span className="month-bill">
                  <strong>{formatCurrency(event.sub.price, event.sub.currency)}</strong>
                  <span
                    className={
                      event.state === 'paid'
                        ? 'text-[var(--rail-teal-ink)]'
                        : 'text-[var(--due-amber)]'
                    }
                  >
                    {t(event.state)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-panel">{t('rail_empty')}</p>
        )}
      </section>
      <BillingAgenda
        title={t('recent_payments')}
        events={data.recentPayments}
        lang={lang}
        timeZone={settings.timezone}
        now={now}
        onView={onView}
      />
      <footer className="overview-footer">
        <EstimateNote lang={lang} />
        {onNavigate && (
          <button type="button" className="text-action" onClick={() => onNavigate('list')}>
            {t('view_subscriptions')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </footer>
    </div>
  );
};

export default Dashboard;
