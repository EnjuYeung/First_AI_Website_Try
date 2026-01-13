import React, { useState, useMemo } from 'react';
import { Subscription, Frequency, NotificationRecord } from '../types';
import { getT } from '../services/i18n';
import { CategoryGlyph, PaymentGlyph } from './ui/glyphs';
import { canonicalRenewalFeedback, displayCategoryLabel, displayFrequencyLabel, displayPaymentMethodLabel } from '../services/displayLabels';
import { parseLocalYMD } from '../services/dateUtils';
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
}

const SubscriptionList: React.FC<Props> = ({
  subscriptions,
  notifications,
  onEdit,
  onDelete,
  onDuplicate,
  onBatchDelete,
  lang
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
  } = useSubscriptionFilters(subscriptions);

  // --- UI State ---
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list';
    return window.innerWidth < 768 ? 'grid' : 'list';
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // --- Handlers ---
  const handleSelectAll = () => {
    if (selectedIds.size === filteredSubscriptions.length && filteredSubscriptions.length > 0) {
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

  const executeBatchDelete = () => {
    if (selectedIds.size > 0) {
      onBatchDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = parseLocalYMD(dateStr);
    if (Number.isNaN(target.getTime())) return Infinity;
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const renderDateBadge = (dateStr: string, sub: Subscription) => {
    const days = getDaysRemaining(dateStr);
    const feedback = getRenewalFeedback(sub, dateStr);
    const suppressBadge = sub.status === 'cancelled' || feedback === 'renewed' || feedback === 'deprecated';

    if (days <= 3 && !suppressBadge) {
      return (
        <div className="flex items-center">
          <span>{dateStr}</span>
          <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full whitespace-nowrap shadow-sm">
            {days < 0 ? t('overdue') : days === 0 ? t('today') : `${days} ${t('days_left')}`}
          </span>
        </div>
      );
    } else if (days <= 5) {
      return (
        <div className="flex items-center">
          <span>{dateStr}</span>
          <span className="ml-2 px-2 py-0.5 bg-yellow-400 text-gray-900 text-[10px] font-bold rounded-full whitespace-nowrap shadow-sm">
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
      <div className="mac-surface rounded-2xl p-10 text-center border border-dashed border-gray-300 dark:border-gray-600">
        <p className="text-gray-500 dark:text-gray-400">{t('manage_text')}</p>
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
    <div className="space-y-4">
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

        selectedCount={selectedIds.size}
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
          onDelete={onDelete}
          getRenewalFeedback={getRenewalFeedback}
          renderDateBadge={renderDateBadge}
          lang={lang}
          t={t}
        />
      ) : (
        <SubscriptionGridView
          subscriptions={filteredSubscriptions}
          selectedIds={selectedIds}
          onSelectOne={handleSelectOne}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          renderDateBadge={renderDateBadge}
          lang={lang}
          t={t}
        />
      )}
    </div>
  );
};

export default SubscriptionList;
