import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { ServerClock, Subscription } from '../types';
import { formatCurrency } from '../services/currency';
import { daysUntilYMD, formatLocalYMD } from '../services/dateUtils';
import { getT } from '../services/i18n';
import {
  assignRailLanes,
  getDaysInRailMonth,
  getZonedRailDateTimeParts,
  railPositionForDay,
  railPositionForInstant,
} from '../services/renewalRail';

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
  serverClock: ServerClock;
}

interface RailGroup {
  day: number;
  events: RenewalRailEvent[];
  amount: number;
  lane: number;
}

const extrapolateServerNow = (clock: ServerClock): number => (
  clock.serverTimeMs + Math.max(0, Date.now() - clock.receivedAtMs)
);

const RenewalRail: React.FC<Props> = ({ events, monthlyTotal, lang, timeZone, serverClock }) => {
  const t = getT(lang);
  const popoverId = useId();
  const activeEventRef = useRef<HTMLDivElement | null>(null);
  const activeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [serverNowMs, setServerNowMs] = useState(() => extrapolateServerNow(serverClock));
  const [openGroupDay, setOpenGroupDay] = useState<number | null>(null);
  const serverNow = new Date(serverNowMs);
  const zonedNow = getZonedRailDateTimeParts(serverNowMs, timeZone);
  const daysInMonth = getDaysInRailMonth(serverNowMs, timeZone);
  const monthLabel = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    timeZone,
  }).format(serverNow);
  const liveTimeLabel = new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(serverNow);

  useEffect(() => {
    const updateNow = () => setServerNowMs(extrapolateServerNow(serverClock));
    updateNow();
    const timer = window.setInterval(updateNow, 1_000);
    return () => window.clearInterval(timer);
  }, [serverClock]);

  useEffect(() => {
    if (openGroupDay === null) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!activeEventRef.current?.contains(event.target as Node)) {
        setOpenGroupDay(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpenGroupDay(null);
      activeTriggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openGroupDay]);

  const groups = useMemo(() => {
    const byDay = new Map<number, RenewalRailEvent[]>();
    events.forEach((event) => {
      const day = event.date.getDate();
      byDay.set(day, [...(byDay.get(day) || []), event]);
    });

    const sortedEntries = [...byDay.entries()].sort(([dayA], [dayB]) => dayA - dayB);
    const lanes = assignRailLanes(sortedEntries.map(([day]) => day));
    return sortedEntries
      .map(([day, groupedEvents], index): RailGroup => {
        return {
          day,
          events: groupedEvents,
          amount: groupedEvents.reduce((sum, event) => sum + event.cost, 0),
          lane: lanes[index],
        };
      });
  }, [events]);

  const tickDays = Array.from({ length: daysInMonth }, (_, index) => index + 1);

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
        <div className="rail-canvas" role="group" aria-label={`${monthLabel}: ${events.length} ${t('planned_charges')}`}>
          <div className="rail-legend">
            <span className="flex items-center gap-1.5 text-[var(--rail-teal)]"><i className="status-dot" />{t('paid')}</span>
            <span className="flex items-center gap-1.5 text-[var(--due-amber)]"><i className="status-dot" />{t('pending')}</span>
          </div>

          <div className="rail-track">
            {groups.map((group, index) => {
              const first = group.events[0];
              const hasMultipleEvents = group.events.length > 1;
              const isPopoverOpen = openGroupDay === group.day;
              const daysUntil = daysUntilYMD(formatLocalYMD(first.date), timeZone, serverNow);
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
                  data-lane={group.lane}
                  data-popover-open={isPopoverOpen || undefined}
                  title={title}
                  style={{
                    left: `${railPositionForDay(group.day, daysInMonth)}%`,
                    '--rail-delay': `${140 + index * 65}ms`,
                    '--rail-label-bottom': `${28 + group.lane * 72}px`,
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
                  {hasMultipleEvents ? (
                    <button
                      type="button"
                      className="rail-node rail-node-trigger"
                      aria-expanded={isPopoverOpen}
                      aria-controls={isPopoverOpen ? `${popoverId}-${group.day}` : undefined}
                      aria-label={`${serviceLabel} · ${formatCurrency(group.amount, 'USD')} · ${t('view_details')}`}
                      onClick={(event) => {
                        activeEventRef.current = event.currentTarget.closest('.rail-event');
                        activeTriggerRef.current = event.currentTarget;
                        setOpenGroupDay((currentDay) => currentDay === group.day ? null : group.day);
                      }}
                    />
                  ) : (
                    <span className="rail-node" />
                  )}

                  {isPopoverOpen && (
                    <div
                      id={`${popoverId}-${group.day}`}
                      className="rail-event-popover"
                      role="region"
                      aria-label={t('view_details')}
                      data-align={group.day <= 4 ? 'start' : group.day >= daysInMonth - 3 ? 'end' : 'center'}
                    >
                      {group.events.map((event) => (
                        <div className="rail-event-detail" key={event.sub.id}>
                          <span>{event.sub.name}</span>
                          <strong>{formatCurrency(event.cost, 'USD')}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div
              className="today-marker"
              data-edge={zonedNow.day === 1 ? 'start' : zonedNow.day === daysInMonth ? 'end' : undefined}
              style={{ left: `${railPositionForInstant(serverNowMs, timeZone)}%` }}
              title={`${t('today')} · ${liveTimeLabel}`}
            >
              <span>{t('today')} · {liveTimeLabel}</span>
            </div>

            <div className="rail-line">
              {tickDays.map((day) => {
                const position = railPositionForDay(day, daysInMonth);
                const showLabel = day === 1 || day === daysInMonth || day % 5 === 0 || day === zonedNow.day;
                return (
                  <React.Fragment key={day}>
                    <i className="rail-tick" style={{ left: `${position}%` }} />
                    {showLabel && <span className="rail-tick-label" style={{ left: `${position}%` }}>{String(day).padStart(2, '0')}</span>}
                  </React.Fragment>
                );
              })}
              <i className="rail-tick rail-month-end" style={{ left: '100%' }} />
            </div>
          </div>

          {events.length === 0 && (
            <div className="absolute inset-x-0 top-[185px] text-center text-sm text-[var(--muted)]">
              {t('rail_empty')}
            </div>
          )}

          <span className="absolute bottom-5 left-[48px] font-mono text-[11px] text-[var(--muted)]">{monthLabel}</span>
          <span className="absolute bottom-5 right-[48px] font-mono text-[11px] text-[var(--muted)]">
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
