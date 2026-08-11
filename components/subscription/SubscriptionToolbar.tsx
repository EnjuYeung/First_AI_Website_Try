import React from 'react';
import { Search, X, Trash2, List, LayoutGrid } from 'lucide-react';
import { FilterMultiSelect } from '../ui/FilterMultiSelect';

interface Option {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

interface SubscriptionToolbarProps {
    // Search
    searchTerm: string;
    onSearchChange: (term: string) => void;

    // Filters State & Handlers
    selectedCategories: string[];
    onCategoryChange: (vals: string[]) => void;
    categoryOptions: Option[];

    selectedFrequencies: string[];
    onFrequencyChange: (vals: string[]) => void;
    frequencyOptions: Option[];

    selectedPayments: string[];
    onPaymentChange: (vals: string[]) => void;
    paymentOptions: Option[];

    selectedPriceRanges: string[];
    onPriceRangeChange: (vals: string[]) => void;
    priceRangeOptions: Option[];

    selectedStatuses: string[];
    onStatusChange: (vals: string[]) => void;
    statusOptions: Option[];

    onResetFilters: () => void;
    hasActiveFilters: boolean;

    // Actions
    selectedCount: number;
    onBatchDelete: () => void;

    // View Toggle
    viewMode: 'list' | 'grid';
    onViewModeChange: (mode: 'list' | 'grid') => void;

    // I18n
    t: (key: any) => string;
}

export const SubscriptionToolbar: React.FC<SubscriptionToolbarProps> = ({
    searchTerm,
    onSearchChange,

    selectedCategories,
    onCategoryChange,
    categoryOptions,

    selectedFrequencies,
    onFrequencyChange,
    frequencyOptions,

    selectedPayments,
    onPaymentChange,
    paymentOptions,

    selectedPriceRanges,
    onPriceRangeChange,
    priceRangeOptions,

    selectedStatuses,
    onStatusChange,
    statusOptions,

    onResetFilters,
    hasActiveFilters,

    selectedCount,
    onBatchDelete,

    viewMode,
    onViewModeChange,
    t
}) => {
    return (
        <div className="statement-card relative z-30 flex flex-col items-start justify-between gap-3 overflow-visible p-3 xl:flex-row xl:items-center">

            {/* Search */}
            <div className="relative w-full xl:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} />
                <input
                    type="text"
                    placeholder={t('search_placeholder')}
                    className="w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            {/* Filters Group */}
            <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
                <FilterMultiSelect
                    label={t('categories')}
                    options={categoryOptions}
                    selectedValues={selectedCategories}
                    onChange={onCategoryChange}
                    resetText={t('reset')}
                />
                <FilterMultiSelect
                    label={t('frequency')}
                    options={frequencyOptions}
                    selectedValues={selectedFrequencies}
                    onChange={onFrequencyChange}
                    resetText={t('reset')}
                />
                <FilterMultiSelect
                    label={t('payment')}
                    options={paymentMethodsOptionList(paymentOptions)} // Wait, props mismatch? No, passing standard options
                    selectedValues={selectedPayments}
                    onChange={onPaymentChange}
                    resetText={t('reset')}
                />
                <FilterMultiSelect
                    label={t('price_range')}
                    options={priceRangeOptions}
                    selectedValues={selectedPriceRanges}
                    onChange={onPriceRangeChange}
                    resetText={t('reset')}
                />
                <FilterMultiSelect
                    label={t('status')}
                    options={statusOptions}
                    selectedValues={selectedStatuses}
                    onChange={onStatusChange}
                    resetText={t('reset')}
                />

                {hasActiveFilters && (
                    <button
                        onClick={onResetFilters}
                        className="px-3 py-2 text-sm text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                        <X size={14} />
                        {t('reset')}
                    </button>
                )}
            </div>

            {/* Right Actions: View Toggle & Batch Actions */}
            <div className="flex items-center gap-2 ml-auto">
                {selectedCount > 0 && (
                    <button
                        onClick={onBatchDelete}
                        className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors text-sm font-medium animate-fade-in"
                    >
                        <Trash2 size={16} />
                        <span className="hidden sm:inline">{t('batch_delete')} ({selectedCount})</span>
                    </button>
                )}

                <div className="flex rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] p-1">
                    <button
                        onClick={() => onViewModeChange('list')}
                        className={`rounded-md p-1.5 transition-all ${viewMode === 'list' ? 'bg-[var(--surface-raised)] text-[var(--rail-teal)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                        title={t('view_list')}
                    >
                        <List size={18} />
                    </button>
                    <button
                        onClick={() => onViewModeChange('grid')}
                        className={`rounded-md p-1.5 transition-all ${viewMode === 'grid' ? 'bg-[var(--surface-raised)] text-[var(--rail-teal)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                        title={t('view_grid')}
                    >
                        <LayoutGrid size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// Helper to fix the TS error in the render above where I called function instead of passing prop
const paymentMethodsOptionList = (opts: Option[]) => opts; 
