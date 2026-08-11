import React from 'react';
import { Subscription, Frequency } from '../../types';
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Edit2, Copy, Trash2 } from 'lucide-react';
import { CategoryGlyph, PaymentGlyph } from '../ui/glyphs';
import { displayCategoryLabel, displayFrequencyLabel, displayPaymentMethodLabel } from '../../services/displayLabels';
import { formatCurrency } from '../../services/currency';

interface SortConfig {
    key: string | null;
    direction: 'asc' | 'desc';
}

interface SubscriptionTableViewProps {
    subscriptions: Subscription[];
    selectedIds: Set<string>;
    onSelectAll: () => void;
    onSelectOne: (id: string) => void;

    sortConfig: SortConfig;
    onSort: (key: string) => void; // Using string to allow flexible keys

    onEdit: (sub: Subscription) => void;
    onDuplicate: (sub: Subscription) => void;
    onDelete: (id: string) => void;

    renderDateBadge: (dateStr: string, sub: Subscription) => React.ReactNode;

    lang: 'en' | 'zh';
    t: (key: any) => string;
}

export const SubscriptionTableView: React.FC<SubscriptionTableViewProps> = ({
    subscriptions,
    selectedIds,
    onSelectAll,
    onSelectOne,
    sortConfig,
    onSort,
    onEdit,
    onDuplicate,
    onDelete,
    renderDateBadge,
    lang,
    t
}) => {
    const renderStatusBadge = (status: 'active' | 'cancelled') => {
        if (status === 'cancelled') {
            return <span className="rounded-md bg-[var(--alert-coral-soft)] px-2 py-1 text-xs font-medium text-[var(--alert-coral)]">{t('cancelled')}</span>
        }
        return <span className="rounded-md bg-[var(--rail-teal-soft)] px-2 py-1 text-xs font-medium text-[var(--rail-teal)]">{t('active')}</span>
    };

    const renderSortHeader = (key: string, label: string) => (
        <th
            aria-sort={sortConfig.key === key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
            className="p-0 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap"
        >
            <button type="button" onClick={() => onSort(key)} className="group flex w-full items-center gap-1 px-5 py-4 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors select-none">
                {label}
                {sortConfig.key === key ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary-600" /> : <ArrowDown size={14} className="text-primary-600" />
                ) : (
                    <ArrowUpDown size={14} className="text-gray-300 group-hover:text-gray-500" />
                )}
            </button>
        </th>
    );

    return (
        <div className="statement-card relative z-0 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="ledger-table w-full text-left align-middle">
                    <thead>
                        <tr className="border-b border-[var(--line)] bg-[var(--surface-soft)]">
                            <th className="px-5 py-4 w-12">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        aria-label={lang === 'zh' ? '全选' : 'Select all'}
                                        className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 dark:bg-slate-800 dark:border-gray-600 cursor-pointer"
                                        checked={selectedIds.size === subscriptions.length && subscriptions.length > 0}
                                        onChange={onSelectAll}
                                    />
                                </div>
                            </th>
                            {renderSortHeader('name', t('service'))}
                            {renderSortHeader('category', t('category'))}
                            <th className="px-5 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">{t('status')}</th>
                            {renderSortHeader('price', t('cost'))}
                            <th className="px-5 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">{t('frequency')}</th>
                            {renderSortHeader('paymentMethod', t('payment'))}
                            {renderSortHeader('nextBillingDate', t('next_bill'))}
                            <th className="px-5 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider text-left whitespace-nowrap">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {subscriptions.map((sub) => (
                            <tr
                                key={sub.id}
                                data-status={sub.status}
                                className={`transition-colors hover:bg-[var(--surface-soft)] ${selectedIds.has(sub.id) ? 'bg-[var(--rail-teal-soft)]' : ''}`}
                            >
                                <td className="px-5 py-4">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            aria-label={`${lang === 'zh' ? '选择' : 'Select'} ${sub.name}`}
                                            className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 dark:bg-slate-800 dark:border-gray-600 cursor-pointer"
                                            checked={selectedIds.has(sub.id)}
                                            onChange={() => onSelectOne(sub.id)}
                                        />
                                    </div>
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap">
                                    <div className="flex items-center space-x-3">
                                        {sub.iconUrl ? (
                                            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                                                <img src={sub.iconUrl} alt={sub.name} className="w-full h-full object-contain" loading="lazy" referrerPolicy="no-referrer" />
                                            </div>
                                        ) : (
                                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] border border-[var(--line)] bg-[var(--surface-soft)] text-lg font-bold text-[var(--rail-teal)]">
                                                {sub.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}

                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-white">{sub.name}</p>
                                            {sub.url && (
                                                <div className="flex items-center space-x-1 text-xs text-primary-500 hover:underline">
                                                    <a href={sub.url} target="_blank" rel="noreferrer" className="flex items-center">
                                                        {t('view_details')}
                                                        <ExternalLink size={10} className="ml-1" />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <CategoryGlyph category={sub.category || '-'} containerSize={20} size={12} />
                                        <span className="truncate">{displayCategoryLabel(sub.category || '-', lang)}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap">
                                    {renderStatusBadge(sub.status)}
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap">
                                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(sub.price, sub.currency)}</span>
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ${sub.frequency === Frequency.MONTHLY ? 'bg-[var(--rail-teal-soft)] text-[var(--rail-teal)]' :
                                            sub.frequency === Frequency.YEARLY ? 'bg-[var(--due-amber-soft)] text-[var(--due-amber)]' :
                                                'bg-[var(--surface-soft)] text-[var(--ink-soft)]'
                                        }`}>
                                        {displayFrequencyLabel(sub.frequency, lang)}
                                    </span>
                                </td>
                                <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <PaymentGlyph method={sub.paymentMethod || 'Credit Card'} containerSize={20} size={12} />
                                        <span className="truncate">{displayPaymentMethodLabel(sub.paymentMethod || 'Credit Card', lang)}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    {renderDateBadge(sub.nextBillingDate, sub)}
                                </td>
                                <td className="px-5 py-4 text-left whitespace-nowrap">
                                    <div className="flex items-center justify-start space-x-1">
                                        <button
                                            aria-label={t('edit_subscription')}
                                            onClick={(e) => { e.stopPropagation(); onEdit(sub); }}
                                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-600 rounded-lg transition"
                                            title={t('edit_subscription')}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            aria-label={t('duplicate')}
                                            onClick={(e) => { e.stopPropagation(); onDuplicate(sub); }}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-600 rounded-lg transition"
                                            title={t('duplicate')}
                                        >
                                            <Copy size={16} />
                                        </button>
                                        <button
                                            aria-label={t('remove')}
                                            onClick={(e) => { e.stopPropagation(); onDelete(sub.id); }}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                            title={t('remove')}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {subscriptions.length === 0 && (
                            <tr>
                                <td colSpan={9} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                                    {t('no_subscriptions')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
