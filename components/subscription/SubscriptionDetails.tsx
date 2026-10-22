import React from 'react';
import { Bell, CalendarDays, ExternalLink, Pencil, Repeat2, X } from 'lucide-react';
import type { AppSettings, Subscription } from '../../types';
import { getT } from '../../services/i18n';
import {
  displayCategoryLabel,
  displayFrequencyLabel,
  displayPaymentMethodLabel,
} from '../../services/displayLabels';
import { formatCurrency } from '../../services/currency';
import { getSubscriptionLifetime } from '../../services/subscriptionLifetime';
import { getTodayYMD } from '../../services/dateUtils';
import { ModalDialog } from '../ui/ModalDialog';
import { ServiceAvatar } from '../ui/ServiceAvatar';

interface Props {
  subscription: Subscription;
  settings: AppSettings;
  onClose: () => void;
  onEdit: (sub: Subscription) => void;
}

export const SubscriptionDetails = ({ subscription: sub, settings, onClose, onEdit }: Props) => {
  const lang = settings.language;
  const t = getT(lang);
  const lifetime = getSubscriptionLifetime(sub, getTodayYMD(settings.timezone));
  const safeUrl = sub.url && /^https?:\/\//i.test(sub.url) ? sub.url : undefined;
  const fields = [
    [t('frequency'), displayFrequencyLabel(sub.frequency, lang)],
    [t('category'), displayCategoryLabel(sub.category, lang)],
    [t('payment'), displayPaymentMethodLabel(sub.paymentMethod || 'Credit Card', lang)],
    [t('start_date'), sub.startDate],
    ...(sub.cancelledAt ? [[t('cancelled_on'), sub.cancelledAt]] : []),
    [t('auto_renewal'), t('not_recorded')],
  ];
  return (
    <ModalDialog
      title={sub.name}
      onClose={onClose}
      wide
      presentation="details"
      describeContent={false}
      actions={
        <div className="detail-actions">
          <button type="button" onClick={onClose} className="secondary-action">
            {t('close')}
          </button>
          <button type="button" className="primary-action" onClick={() => onEdit(sub)}>
            <Pencil size={16} aria-hidden="true" />
            {t('edit_subscription')}
          </button>
        </div>
      }
    >
      <button
        type="button"
        className="icon-control detail-close"
        aria-label={t('close')}
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <div className="detail-identity">
        <ServiceAvatar sub={sub} large />
        <span
          className={`status-label ${sub.status === 'cancelled' ? 'status-cancelled' : 'status-active'}`}
        >
          {t(sub.status)}
        </span>
      </div>
      <div className="detail-cost">
        <span>{formatCurrency(sub.price, sub.currency)}</span>
        <span>{displayFrequencyLabel(sub.frequency, lang)}</span>
      </div>
      <div className="detail-highlights">
        <div>
          <CalendarDays size={18} aria-hidden="true" />
          <span>
            {t('next_billing_date')}
            <strong>{sub.status === 'cancelled' ? '—' : sub.nextBillingDate || '—'}</strong>
          </span>
        </div>
        <div>
          <Bell size={18} aria-hidden="true" />
          <span>
            {t('billing_reminder')}
            <strong>{t(sub.notificationsEnabled ? 'reminder_on' : 'reminder_off')}</strong>
          </span>
        </div>
      </div>
      {sub.notificationsEnabled && <p className="field-hint">{t('reminder_setup_note')}</p>}
      <dl className="detail-fields">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
      </dl>
      <p className="detail-explanation">
        <Repeat2 size={15} aria-hidden="true" />
        {t('auto_renewal_note')}
      </p>
      <div className="detail-lifetime">
        <span>{t('lifetime_estimate')}</span>
        <strong className="font-data">{formatCurrency(lifetime.spent, sub.currency)}</strong>
        <span>
          {t('lifetime_periods').replace('{count}', String(lifetime.periods))} ·{' '}
          {t('current_price_estimate')}
        </span>
      </div>
      {safeUrl && (
        <a className="detail-service-link" href={safeUrl} target="_blank" rel="noreferrer">
          {t('visit_service')}
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      )}
      {sub.notes && (
        <div className="detail-notes">
          <h4>{t('notes')}</h4>
          <p>{sub.notes}</p>
        </div>
      )}
    </ModalDialog>
  );
};
