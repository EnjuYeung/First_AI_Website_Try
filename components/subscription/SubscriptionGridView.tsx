import React from 'react';
import { ArrowUpRight, Bell, BellOff, Copy, Edit2, Trash2 } from 'lucide-react';
import { Subscription } from '../../types';
import {
  displayCategoryLabel,
  displayFrequencyLabel,
  displayPaymentMethodLabel,
} from '../../services/displayLabels';
import { SubscriptionCostStack } from './SubscriptionCostStack';
import { ServiceAvatar } from '../ui/ServiceAvatar';

interface SubscriptionGridViewProps {
  subscriptions: Subscription[];
  selectedIds: Set<string>;
  onSelectOne: (id: string) => void;
  onEdit: (sub: Subscription) => void;
  onView?: (sub: Subscription) => void;
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
  onView,
  onDuplicate,
  onDelete,
  renderDateBadge,
  lang,
  timezone,
  t,
}) => (
  <div className="subscription-grid">
    {subscriptions.map((sub) => (
      <article
        key={sub.id}
        className={`subscription-card subscription-tile ${selectedIds.has(sub.id) ? 'is-selected' : ''}`}
      >
        <header className="tile-heading">
          <ServiceAvatar sub={sub} />
          <div className="tile-identity">
            <h2>
              <button
                type="button"
                className="service-name-button"
                onClick={() => (onView || onEdit)(sub)}
                aria-label={`${t('view_details')} ${sub.name}`}
              >
                {sub.name}
              </button>
            </h2>
            <span>{displayCategoryLabel(sub.category, lang)}</span>
          </div>
          <label className="selection-target">
            <input
              type="checkbox"
              aria-label={`${lang === 'zh' ? '选择' : 'Select'} ${sub.name}`}
              checked={selectedIds.has(sub.id)}
              onChange={() => onSelectOne(sub.id)}
            />
          </label>
        </header>
        <div className="tile-price">
          <SubscriptionCostStack
            subscription={sub}
            timezone={timezone}
            size="grid"
            frequencySuffix={displayFrequencyLabel(sub.frequency, lang)}
            periodsLabel={t('lifetime_periods')}
            estimateLabel={t('lifetime_estimate')}
          />
        </div>
        <dl className="tile-billing">
          <div>
            <dt>{t('next_bill')}</dt>
            <dd>{renderDateBadge(sub.nextBillingDate, sub)}</dd>
          </div>
          <div>
            <dt>{t('payment')}</dt>
            <dd>{displayPaymentMethodLabel(sub.paymentMethod || 'Credit Card', lang)}</dd>
          </div>
        </dl>
        <div className="tile-status">
          <span
            className={`status-label ${sub.status === 'cancelled' ? 'status-cancelled' : 'status-active'}`}
          >
            {t(sub.status)}
          </span>
          <span className="reminder-label">
            {sub.notificationsEnabled ? (
              <Bell size={13} aria-hidden="true" />
            ) : (
              <BellOff size={13} aria-hidden="true" />
            )}
            {t(sub.notificationsEnabled ? 'reminder_on' : 'reminder_off')}
          </span>
        </div>
        <footer className="tile-actions">
          <button type="button" className="text-action" onClick={() => (onView || onEdit)(sub)}>
            {t('view_details')}
            <ArrowUpRight size={15} aria-hidden="true" />
          </button>
          <div>
            <button
              type="button"
              className="icon-control"
              aria-label={t('edit_subscription')}
              onClick={() => onEdit(sub)}
            >
              <Edit2 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-control"
              aria-label={t('duplicate')}
              onClick={() => onDuplicate(sub)}
            >
              <Copy size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-control danger-control"
              aria-label={t('remove')}
              onClick={() => onDelete(sub.id)}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        </footer>
      </article>
    ))}
  </div>
);
