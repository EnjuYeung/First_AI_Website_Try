import React from 'react';
import { Copy, Edit2, Trash2 } from 'lucide-react';
import { Frequency, Subscription } from '../../types';
import { CategoryGlyph, PaymentGlyph } from '../ui/glyphs';
import { displayCategoryLabel, displayPaymentMethodLabel } from '../../services/displayLabels';
import { SubscriptionCostStack } from './SubscriptionCostStack';

interface SubscriptionGridViewProps {
  subscriptions: Subscription[];
  selectedIds: Set<string>;
  onSelectOne: (id: string) => void;
  onEdit: (sub: Subscription) => void;
  onDuplicate: (sub: Subscription) => void;
  onDelete: (id: string) => void;
  renderDateBadge: (dateStr: string, sub: Subscription) => React.ReactNode;
  lang: 'en' | 'zh';
  timezone: string;
  t: (key: any) => string;
}

export const SubscriptionGridView: React.FC<SubscriptionGridViewProps> = ({
  subscriptions,
  selectedIds,
  onSelectOne,
  onEdit,
  onDuplicate,
  onDelete,
  renderDateBadge,
  lang,
  timezone,
  t,
}) => {
  if (subscriptions.length === 0) {
    return <div className="statement-card border-dashed py-12 text-center text-[var(--muted)]">{t('no_subscriptions')}</div>;
  }

  const frequencySuffix = (frequency: Frequency) => {
    if (lang === 'zh') {
      if (frequency === Frequency.MONTHLY) return '月';
      if (frequency === Frequency.YEARLY) return '年';
      return '周期';
    }
    if (frequency === Frequency.MONTHLY) return 'mo';
    if (frequency === Frequency.YEARLY) return 'yr';
    return 'cycle';
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {subscriptions.map((sub) => (
        <article
          key={sub.id}
          className={`subscription-card group relative overflow-hidden p-5 ${selectedIds.has(sub.id) ? 'ring-2 ring-[var(--rail-teal)] ring-offset-2 ring-offset-[var(--canvas)]' : ''}`}
          style={{ borderTopColor: sub.status === 'cancelled' ? 'var(--alert-coral)' : 'var(--rail-teal)', borderTopWidth: 3 }}
        >
          <div className="mb-5 flex items-center justify-between">
            <input
              type="checkbox"
              aria-label={`${lang === 'zh' ? '选择' : 'Select'} ${sub.name}`}
              className="h-4 w-4 cursor-pointer rounded border-[var(--line-strong)] text-primary-600 focus:ring-primary-500"
              checked={selectedIds.has(sub.id)}
              onChange={() => onSelectOne(sub.id)}
            />
            <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <button aria-label={t('edit_subscription')} title={t('edit_subscription')} onClick={() => onEdit(sub)} className="icon-control rounded-lg p-1.5"><Edit2 size={14} /></button>
              <button aria-label={t('duplicate')} title={t('duplicate')} onClick={() => onDuplicate(sub)} className="icon-control rounded-lg p-1.5"><Copy size={14} /></button>
              <button aria-label={t('remove')} title={t('remove')} onClick={() => onDelete(sub.id)} className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--alert-coral-soft)] hover:text-[var(--alert-coral)]"><Trash2 size={14} /></button>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] text-lg font-semibold text-[var(--rail-teal)]">
              {sub.iconUrl ? <img src={sub.iconUrl} alt="" className="h-full w-full object-contain" loading="lazy" referrerPolicy="no-referrer" /> : sub.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-display text-lg font-semibold tracking-[-0.025em] text-[var(--ink)]">{sub.name}</h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                <CategoryGlyph category={sub.category} containerSize={18} size={12} />
                <span className="truncate">{displayCategoryLabel(sub.category, lang)}</span>
              </div>
            </div>
            {sub.status === 'cancelled' && <span className="rounded-md bg-[var(--alert-coral-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--alert-coral)]">{t('cancelled')}</span>}
          </div>

          <div className="mt-6">
            <SubscriptionCostStack
              subscription={sub}
              timezone={timezone}
              size="grid"
              frequencySuffix={frequencySuffix(sub.frequency)}
              periodsLabel={t('lifetime_periods')}
            />
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 text-xs">
            <div className="min-w-0">
              <dt className="mb-1.5 text-[var(--muted)]">{t('payment')}</dt>
              <dd className="flex items-center gap-2 truncate font-medium text-[var(--ink-soft)]">
                <PaymentGlyph method={sub.paymentMethod || 'Credit Card'} containerSize={18} size={12} />
                <span className="truncate">{displayPaymentMethodLabel(sub.paymentMethod || 'Credit Card', lang)}</span>
              </dd>
            </div>
            <div className="min-w-0 text-right">
              <dt className="mb-1.5 text-[var(--muted)]">{t('next_bill')}</dt>
              <dd className="font-data truncate text-[var(--ink-soft)]">{renderDateBadge(sub.nextBillingDate, sub)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
};
