import React from 'react';
import { ArrowUpRight, CalendarCheck2, CheckCircle2, Clock3 } from 'lucide-react';
import type { Subscription } from '../types';
import type { BillingEvent } from '../hooks/useDashboardStats';
import { displayFrequencyLabel } from '../services/displayLabels';
import { daysUntilYMD, formatLocalYMD } from '../services/dateUtils';
import { formatCurrency } from '../services/currency';
import { getT } from '../services/i18n';
import { ServiceAvatar } from './ui/ServiceAvatar';

interface Props {
  title: string;
  events: BillingEvent[];
  lang: 'zh' | 'en';
  timeZone: string;
  now: Date;
  upcoming?: boolean;
  onView?: (subscription: Subscription) => void;
}

export const BillingAgenda = ({ title, events, lang, timeZone, now, upcoming, onView }: Props) => {
  const t = getT(lang);
  return (
    <section className="statement-card agenda-card">
      <header className="section-heading">
        <div className="flex min-w-0 items-center gap-2.5">
          {upcoming ? (
            <Clock3 size={18} aria-hidden="true" className="text-[var(--due-amber)]" />
          ) : (
            <CalendarCheck2 size={18} aria-hidden="true" className="text-[var(--rail-teal)]" />
          )}
          <h2>{title}</h2>
        </div>
        <span className="count-badge">{events.length}</span>
      </header>
      {events.length ? (
        <ul className="agenda-list">
          {events.map(({ sub, date, cost }, i) => {
            const ymd = formatLocalYMD(date);
            const days = daysUntilYMD(ymd, timeZone, now);
            const timing =
              days < 0
                ? t('overdue')
                : days === 0
                  ? t('today')
                  : lang === 'zh'
                    ? `${days} 天后`
                    : `In ${days} days`;
            const content = (
              <>
                <ServiceAvatar sub={sub} />
                <span className="agenda-service">
                  <strong>{sub.name}</strong>
                  <span>
                    {displayFrequencyLabel(sub.frequency, lang)}
                    <span aria-hidden="true"> · </span>
                    {ymd}
                  </span>
                </span>
                <span className="agenda-amount">
                  <strong>{formatCurrency(cost, sub.currency)}</strong>
                  <span className={upcoming && days <= 3 ? 'text-[var(--due-amber)]' : ''}>
                    {upcoming ? timing : t('cycle_estimate')}
                  </span>
                </span>
                {onView && <ArrowUpRight size={16} className="agenda-chevron" aria-hidden="true" />}
              </>
            );
            return (
              <li key={`${sub.id}-${ymd}-${i}`}>
                {onView ? (
                  <button
                    type="button"
                    className="agenda-row"
                    onClick={() => onView(sub)}
                    aria-label={`${t('view_details')} ${sub.name}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="agenda-row">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty-panel">
          <CheckCircle2 size={24} aria-hidden="true" />
          <p>{upcoming ? t('no_upcoming_renewals') : t('no_recent_payments')}</p>
        </div>
      )}
    </section>
  );
};
