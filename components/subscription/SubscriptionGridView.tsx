import React from 'react';
import { Subscription, Frequency } from '../../types';
import { Edit2, Copy, Trash2 } from 'lucide-react';
import { CategoryGlyph, PaymentGlyph } from '../ui/glyphs';
import { displayCategoryLabel, displayPaymentMethodLabel } from '../../services/displayLabels';
import { formatCurrency } from '../../services/currency';

interface SubscriptionGridViewProps {
    subscriptions: Subscription[];
    selectedIds: Set<string>;
    onSelectOne: (id: string) => void;

    onEdit: (sub: Subscription) => void;
    onDuplicate: (sub: Subscription) => void;
    onDelete: (id: string) => void;

    renderDateBadge: (dateStr: string, sub: Subscription) => React.ReactNode;

    lang: 'en' | 'zh';
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
    t
}) => {
    if (subscriptions.length === 0) {
        return (
            <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400 mac-surface rounded-2xl border border-dashed border-gray-200">
                {t('no_subscriptions')}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {subscriptions.map(sub => (
                <div
                    key={sub.id}
                    className={`mac-surface rounded-2xl p-5 shadow-sm border transition-all relative group ${selectedIds.has(sub.id)
                            ? 'border-primary-500 ring-1 ring-primary-500'
                            : 'border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-primary-200 dark:hover:border-gray-600'
                        }`}
                >
                    {/* Checkbox (Absolute) */}
                    <div className="absolute top-4 left-4 z-10">
                        <input
                            type="checkbox"
                            className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500 dark:bg-slate-800 dark:border-gray-600 cursor-pointer"
                            checked={selectedIds.has(sub.id)}
                            onChange={() => onSelectOne(sub.id)}
                        />
                    </div>

                    {/* Actions (Absolute) */}
                    <div className="absolute top-3 right-3 flex space-x-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(sub); }}
                            className="p-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-white hover:text-primary-600 rounded-md text-gray-500 shadow-sm transition-colors"
                        >
                            <Edit2 size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDuplicate(sub); }}
                            className="p-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-white hover:text-blue-600 rounded-md text-gray-500 shadow-sm transition-colors"
                        >
                            <Copy size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(sub.id); }}
                            className="p-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-white hover:text-red-600 rounded-md text-gray-500 shadow-sm transition-colors"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>

                    {/* Card Content */}
                    <div className="flex flex-col items-center text-center mt-2">
                        {sub.iconUrl ? (
                            <div className="w-14 h-14 mb-3 relative flex items-center justify-center">
                                <img src={sub.iconUrl} alt={sub.name} className="w-full h-full object-contain" loading="lazy" referrerPolicy="no-referrer" />
                                {sub.status === 'cancelled' && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
                                )}
                            </div>
                        ) : (
                            <div className="w-14 h-14 rounded-2xl bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-xl mb-3 relative">
                                {sub.name.charAt(0).toUpperCase()}
                                {sub.status === 'cancelled' && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
                                )}
                            </div>
                        )}

                        <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate w-full px-2">{sub.name}</h3>
                        <div className="mb-3 flex flex-col items-center justify-center gap-2">
                            <div className="flex items-center justify-center gap-2">
                                <CategoryGlyph category={sub.category} containerSize={18} size={12} />
                                <p className="text-xs text-gray-500 dark:text-gray-400">{displayCategoryLabel(sub.category, lang)}</p>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <PaymentGlyph method={sub.paymentMethod || 'Credit Card'} containerSize={18} size={12} />
                                <p className="text-xs text-gray-500 dark:text-gray-400">{displayPaymentMethodLabel(sub.paymentMethod || 'Credit Card', lang)}</p>
                            </div>
                            {sub.status === 'cancelled' && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">
                                    {t('cancelled')}
                                </span>
                            )}
                        </div>

                        <div className="flex items-baseline mb-4">
                            <span className={`text-2xl font-bold mr-1 ${sub.status === 'cancelled' ? 'text-gray-400 dark:text-gray-500 decoration-slate-400' : 'text-gray-900 dark:text-white'}`}>
                                {formatCurrency(sub.price, sub.currency)}
                            </span>
                            <span className="text-xs text-gray-500">
                                / {lang === 'zh' ? (sub.frequency === Frequency.MONTHLY ? '月' : sub.frequency === Frequency.YEARLY ? '年' : '周期') : (sub.frequency === Frequency.MONTHLY ? 'mo' : sub.frequency === Frequency.YEARLY ? 'yr' : 'cycle')}
                            </span>
                        </div>

                        <div className="w-full border-t border-gray-100 dark:border-gray-700 pt-3 mt-auto flex justify-between items-center text-xs">
                            <span className="text-gray-400">{t('next_bill')}</span>
                            <div className="font-medium text-gray-700 dark:text-gray-200">
                                {renderDateBadge(sub.nextBillingDate, sub)}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
