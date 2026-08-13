import React, { useEffect, useState, useMemo } from 'react';
import { Subscription, Frequency, NotificationRecord, ExchangeRates } from '../types';
import { getT } from '../services/i18n';
import { CategoryGlyph, PaymentGlyph } from './ui/glyphs';
import { canonicalRenewalFeedback, displayCategoryLabel, displayFrequencyLabel, displayPaymentMethodLabel } from '../services/displayLabels';
import { daysUntilYMD } from '../services/dateUtils';
import { useSubscriptionFilters } from '../hooks/useSubscriptionFilters';

// Sub Components
import { SubscriptionToolbar } from './subscription/SubscriptionToolbar';
import { SubscriptionTableView } from './subscription/SubscriptionTableView';
import { SubscriptionGridView } from './subscription/SubscriptionGridView';

interface Props {
  subscriptions: Subscription[];
  notifications: NotificationRecord[];
  onEdit: (sub: Subscription) => void;
  onDelete: (id: string) => void;
  onDuplicate: (sub: Subscription) => void;
  onBatchDelete: (ids: string[]) => void;
  lang: 'en' | 'zh';
  exchangeRates: ExchangeRates;
  timezone: string;
}

export const getVisibleSelectedIds = (
  visibleSubscriptions: Pick<Subscription, 'id'>[],
  selectedIds: ReadonlySet<string>
) => visibleSubscriptions
  .map((subscription) => subscription.id)
  .filter((id) => selectedIds.has(id));

const SubscriptionList: React.FC<Props> = ({
  subscriptions,
  notifications,
  onEdit,
  onDelete,
  onDuplicate,
  onBatchDelete,
  lang,
  exchangeRates,
  timezone
}) => {
  const t = getT(lang);

  // --- Logic & State (Custom Hook) ---
  const {
    searchTerm, setSearchTerm,
    selectedCategories, setSelectedCategories,
    selectedFrequencies, setSelectedFrequencies,
    selectedPayments, setSelectedPayments,
    selectedPriceRanges, setSelectedPriceRanges,
    selectedStatuses, setSelectedStatuses,
    sortConfig, handleSort,
    resetFilters,
    filteredSubscriptions
  } = useSubscriptionFilters(subscriptions, exchangeRates);

  // --- UI State ---
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list';
    return window.innerWidth < 768 ? 'grid' : 'list';
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const visibleIds = useMemo(
    () => new Set(filteredSubscriptions.map((subscription) => subscription.id)),
    [filteredSubscriptions]
  );
  const visibleSelectedCount = useMemo(
    () => getVisibleSelectedIds(filteredSubscriptions, selectedIds).length,
    [filteredSubscriptions, selectedIds]
  );

  useEffect(() => {
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visibleIds]);

  // --- Handlers ---
  const handleSelectAll = () => {
    if (visibleSelectedCount === filteredSubscriptions.length && filteredSubscriptions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSubscriptions.map(s => s.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm(t('confirm_delete'))) return;
    onDelete(id);
  };

  const executeBatchDelete = () => {
    const visibleSelection = getVisibleSelectedIds(filteredSubscriptions, selectedIds);
    if (visibleSelection.length === 0) return;
    const message = t('confirm_batch_delete').replace('{count}', visibleSelection.length.toString());
    if (!window.confirm(message)) return;
    onBatchDelete(visibleSelection);
    setSelectedIds(new Set());
  };

  // --- Options Construction ---
  const categoriesOptionList = useMemo(() => {
    const cats = new Set<string>(subscriptions.map((s) => s.category));
    return Array.from(cats).map(c => ({
      value: c,
      label: displayCategoryLabel(c, lang),
      icon: <CategoryGlyph category={c} containerSize={18} size={12} />,
    }));
  }, [subscriptions, lang]);

  const frequenciesOptionList = useMemo(() => {
    return Object.values(Frequency).map(f => ({ value: f, label: displayFrequencyLabel(f, lang) }));
  }, [lang]);

  const paymentMethodsOptionList = useMemo(() => {
    const methods = new Set<string>(subscriptions.map((s) => s.paymentMethod || 'Credit Card'));
    return Array.from(methods).map(m => ({
      value: m,
      label: displayPaymentMethodLabel(m, lang),
      icon: <PaymentGlyph method={m} containerSize={18} size={12} />,
    }));
  }, [subscriptions, lang]);

  const priceRangeOptionList = useMemo(() => [
    { value: 'low', label: t('price_low') },
    { value: 'mid', label: t('price_mid') },
    { value: 'high', label: t('price_high') },
  ], [t]);

  const statusOptionList = useMemo(() => [
    { value: 'active', label: t('active') },
    { value: 'cancelled', label: t('cancelled') }
  ], [t]);


  // --- Helper Logic (Badges) ---
  const renewalFeedbackMap = useMemo(() => {
    const bySub = new Map<string, Map<string, { feedback: string; timestamp: number }>>();
    (notifications || []).forEach((notif) => {
      if (notif.type !== 'renewal_reminder') return;
      const feedback = notif.details?.renewalFeedback;
      const date = notif.details?.date;
      if (!feedback || !date) return;
      const key = notif.details?.subscriptionId || notif.subscriptionName;
      if (!key) return;
      const subMap = bySub.get(key) || new Map<string, { feedback: string; timestamp: number }>();
      const timestamp = typeof notif.timestamp === 'number' ? notif.timestamp : 0;
      const existing = subMap.get(date);
      if (!existing || timestamp >= existing.timestamp) {
        subMap.set(date, { feedback, timestamp });
      }
      bySub.set(key, subMap);
    });
    return bySub;
  }, [notifications]);

  const getRenewalFeedback = (sub: Subscription, dateStr: string) => {
    if (!dateStr) return '';
    const byId = sub.id ? renewalFeedbackMap.get(sub.id) : undefined;
    const byName = renewalFeedbackMap.get(sub.name);
    const entry = byId?.get(dateStr) || byName?.get(dateStr);
    return canonicalRenewalFeedback(entry?.feedback);
  };

  const getDaysRemaining = (dateStr: string) => {
    if (!dateStr) return Infinity;
    return daysUntilYMD(dateStr, timezone);
  };

  const renderDateBadge = (dateStr: string, sub: Subscription) => {
    if (sub.status === 'cancelled') return <span className="text-gray-300 dark:text-gray-600">-</span>;

    const days = getDaysRemaining(dateStr);
    const feedback = getRenewalFeedback(sub, dateStr);
    const suppressBadge = feedback === 'renewed' || feedback === 'deprecated';

    if (days <= 3 && !suppressBadge) {
      return (
        <div className="flex items-center">
          <span>{dateStr}</span>
          <span className="ml-2 whitespace-nowrap rounded-md bg-[var(--alert-coral-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--alert-coral)]">
            {days < 0 ? t('overdue') : days === 0 ? t('today') : `${days} ${t('days_left')}`}
          </span>
        </div>
      );
    } else if (days <= 5 && !suppressBadge) {
      return (
        <div className="flex items-center">
          <span>{dateStr}</span>
          <span className="ml-2 whitespace-nowrap rounded-md bg-[var(--due-amber-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--due-amber)]">
            {days} {t('days_left')}
          </span>
        </div>
      );
    }
    return <span>{dateStr}</span>;
  };

  // --- Render ---

  if (subscriptions.length === 0 && !searchTerm && selectedCategories.length === 0) {
    return (
      <div className="animate-fade-in space-y-6">
        <header>
          <div className="eyebrow mb-3">{t('subscriptions_library')}</div>
          <h1 className="page-title">{t('subscriptions')}</h1>
          <p className="page-copy mt-3 text-sm">{t('manage_text')}</p>
        </header>
        <div className="statement-card border-dashed p-12 text-center">
          <p className="text-sm text-[var(--muted)]">{t('manage_text')}</p>
        </div>
      </div>
    );
  }

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedCategories.length > 0 ||
    selectedFrequencies.length > 0 ||
    selectedPayments.length > 0 ||
    selectedPriceRanges.length > 0 ||
    selectedStatuses.length > 0;

  return (
    <div className="animate-fade-in space-y-5">
      <header className="flex flex-col gap-3 pb-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-3">{t('subscriptions_library')}</div>
          <h1 className="page-title">{t('subscriptions')}</h1>
          <p className="page-copy mt-3 text-sm">{t('manage_text')}</p>
        </div>
        <div className="font-data text-sm text-[var(--muted)]">
          {String(filteredSubscriptions.length).padStart(2, '0')} / {String(subscriptions.length).padStart(2, '0')}
        </div>
      </header>
      <SubscriptionToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}

        selectedCategories={selectedCategories}
        onCategoryChange={setSelectedCategories}
        categoryOptions={categoriesOptionList}

        selectedFrequencies={selectedFrequencies}
        onFrequencyChange={setSelectedFrequencies}
        frequencyOptions={frequenciesOptionList}

        selectedPayments={selectedPayments}
        onPaymentChange={setSelectedPayments}
        paymentOptions={paymentMethodsOptionList}

        selectedPriceRanges={selectedPriceRanges}
        onPriceRangeChange={setSelectedPriceRanges}
        priceRangeOptions={priceRangeOptionList}

        selectedStatuses={selectedStatuses}
        onStatusChange={setSelectedStatuses}
        statusOptions={statusOptionList}

        onResetFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}

        selectedCount={visibleSelectedCount}
        onBatchDelete={executeBatchDelete}

        viewMode={viewMode}
        onViewModeChange={setViewMode}
        t={t}
      />

      {viewMode === 'list' ? (
        <SubscriptionTableView
          subscriptions={filteredSubscriptions}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectOne={handleSelectOne}
          sortConfig={{ key: sortConfig.key, direction: sortConfig.direction }}
          onSort={handleSort}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={handleDelete}
          renderDateBadge={renderDateBadge}
          lang={lang}
          timezone={timezone}
          t={t}
        />
      ) : (
        <SubscriptionGridView
          subscriptions={filteredSubscriptions}
          selectedIds={selectedIds}
          onSelectOne={handleSelectOne}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={handleDelete}
          renderDateBadge={renderDateBadge}
          lang={lang}
          timezone={timezone}
          t={t}
        />
      )}
    </div>
  );
};

export default SubscriptionList;
