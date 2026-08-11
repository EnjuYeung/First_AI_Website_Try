import React, { useMemo } from 'react';
import { CalendarRange } from 'lucide-react';
import { Subscription } from '../types';
import { formatCurrency } from '../services/currency';
import { formatLocalYMD, getTodayYMD, parseLocalYMD } from '../services/dateUtils';
import { getT } from '../services/i18n';

export interface RenewalRailEvent {
  sub: Subscription;
  date: Date;
  cost: number;
  state: 'paid' | 'pending';
}

interface Props {
  events: RenewalRailEvent[];
  monthlyTotal: number;
  lang: 'en' | 'zh';
  timeZone: string;
}

interface RailGroup {
  day: number;
  events: RenewalRailEvent[];
  amount: number;
  lane: number;
}

const RenewalRail: React.FC<Props> = ({ events, monthlyTotal, lang, timeZone }) => {
  const t = getT(lang);
  const today = parseLocalYMD(getTodayYMD(timeZone));
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
  }).format(today);

  const groups = useMemo(() => {
    const byDay = new Map<number, RenewalRailEvent[]>();
    events.forEach((event) => {
      const day = event.date.getDate();
      byDay.set(day, [...(byDay.get(day) || []), event]);
    });

    let previousDay = -10;
    let previousLane = 0;
    return [...byDay.entries()]
      .sort(([dayA], [dayB]) => dayA - dayB)
      .map(([day, groupedEvents]): RailGroup => {
        const lane = day - previousDay < 4 ? (previousLane === 0 ? 1 : 0) : 0;
        previousDay = day;
        previousLane = lane;
        return {
          day,
          events: groupedEvents,
          amount: groupedEvents.reduce((sum, event) => sum + event.cost, 0),
          lane,
        };
      });
  }, [events]);

  const tickDays = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const positionForDay = (day: number) => {
    const ratio = daysInMonth <= 1 ? 0 : (day - 1) / (daysInMonth - 1);
    return 3.8 + ratio * 92.4;
  };

  return (
    <section className="renewal-rail-card" aria-labelledby="renewal-rail-title">
      <div className="flex flex-col gap-5 border-b px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7" style={{ borderColor: 'var(--line)' }}>
        <div>
          <div className="eyebrow mb-2 flex items-center gap-2">
            <CalendarRange size={14} aria-hidden="true" />
            {t('renewal_rail')}
          </div>
          <h2 id="renewal-rail-title" className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)] sm:text-3xl">
            {t('renewal_rail_title')}
          </h2>
          <p className="page-copy mt-2 text-sm">{t('renewal_rail_copy')}</p>
        </div>

        <div className="sm:text-right">
          <div className="text-xs font-medium text-[var(--muted)]">{t('expected_this_month')}</div>
          <div className="data-value mt-1 text-2xl font-medium sm:text-3xl">
            {formatCurrency(monthlyTotal, 'USD')}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="rail-canvas" role="img" aria-label={`${monthLabel}: ${events.length} ${t('planned_charges')}`}>
          <div className="absolute left-[34px] top-5 flex items-center gap-4 text-[11px] text-[var(--muted)]">
            <span className="flex items-center gap-1.5 text-[var(--rail-teal)]"><i className="status-dot" />{t('paid')}</span>
            <span className="flex items-center gap-1.5 text-[var(--due-amber)]"><i className="status-dot" />{t('pending')}</span>
          </div>

          {groups.map((group, index) => {
            const first = group.events[0];
            const daysUntil = Math.round((first.date.getTime() - today.getTime()) / 86400000);
            const state = group.events.every((event) => event.state === 'paid')
              ? 'paid'
              : daysUntil <= 3
                ? 'urgent'
                : 'upcoming';
            const serviceLabel = group.events.length > 1
              ? `${first.sub.name} +${group.events.length - 1}`
              : first.sub.name;
            const title = group.events
              .map((event) => `${event.sub.name} · ${formatCurrency(event.cost, 'USD')}`)
              .join('\n');

            return (
              <div
                key={group.day}
                className="rail-event"
                data-state={state}
                title={title}
                style={{
                  left: `${positionForDay(group.day)}%`,
                  '--rail-delay': `${140 + index * 65}ms`,
                  '--rail-label-bottom': group.lane === 1 ? '72px' : '28px',
                } as React.CSSProperties}
              >
                <div className="rail-event-label">
                  <div className="rail-service-icon" aria-hidden="true">
                    {first.sub.iconUrl ? (
                      <img src={first.sub.iconUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    ) : (
                      <span>{first.sub.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <strong>{serviceLabel}</strong>
                  <span>{formatCurrency(group.amount, 'USD')}</span>
                </div>
                <span className="rail-node">
                  {group.events.length > 1 && <span className="rail-count">{group.events.length}</span>}
                </span>
              </div>
            );
          })}

          <div className="today-marker" style={{ left: `${positionForDay(today.getDate())}%` }}>
            <span>{t('today')}</span>
          </div>

          <div className="rail-line">
            {tickDays.map((day) => {
              const position = ((day - 1) / Math.max(daysInMonth - 1, 1)) * 100;
              const showLabel = day === 1 || day === daysInMonth || day % 5 === 0 || day === today.getDate();
              return (
                <React.Fragment key={day}>
                  <i className="rail-tick" style={{ left: `${position}%` }} />
                  {showLabel && <span className="rail-tick-label" style={{ left: `${position}%` }}>{String(day).padStart(2, '0')}</span>}
                </React.Fragment>
              );
            })}
          </div>

          {events.length === 0 && (
            <div className="absolute inset-x-0 top-[92px] text-center text-sm text-[var(--muted)]">
              {t('rail_empty')}
            </div>
          )}

          <span className="absolute bottom-5 left-[34px] font-mono text-[11px] text-[var(--muted)]">{monthLabel}</span>
          <span className="absolute bottom-5 right-[34px] font-mono text-[11px] text-[var(--muted)]">
            {events.length} {t('planned_charges')}
          </span>
        </div>
      </div>

      <ul className="sr-only">
        {events.map((event) => (
          <li key={`${event.sub.id}-${formatLocalYMD(event.date)}`}>
            {event.sub.name}, {formatLocalYMD(event.date)}, {formatCurrency(event.cost, 'USD')}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default RenewalRail;
