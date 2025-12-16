
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Subscription, Frequency } from '../types';
import { Edit2, Trash2, ExternalLink, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Check, X, Copy, LayoutGrid, List } from 'lucide-react';
import { getT } from '../services/i18n';
import { CategoryGlyph, PaymentGlyph } from './ui/glyphs';
import { displayCategoryLabel, displayFrequencyLabel, displayPaymentMethodLabel } from '../services/displayLabels';

interface Props {
  subscriptions: Subscription[];
  onEdit: (sub: Subscription) => void;
  onDelete: (id: string) => void;
  onDuplicate: (sub: Subscription) => void;
  onBatchDelete: (ids: string[]) => void;
  lang: 'en' | 'zh';
}

// --- MultiSelect Component ---
interface FilterMultiSelectProps {
  label: string;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  t: (key: any) => string;
}

const FilterMultiSelect: React.FC<FilterMultiSelectProps> = ({ label, options, selectedValues, onChange, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors ${selectedValues.length > 0 ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
      >
        <span>{label} {selectedValues.length > 0 && `(${selectedValues.length})`}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-2 w-56 mac-surface rounded-xl shadow-lg border border-gray-100 dark:border-gray-600 overflow-hidden animate-fade-in">
          <div className="p-2 max-h-60 overflow-y-auto space-y-1">
             {options.map((opt) => (
                <div 
                  key={opt.value}
                  onClick={() => toggleOption(opt.value)}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer text-sm text-gray-700 dark:text-gray-200"
                >
                  {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedValues.includes(opt.value) ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 dark:border-gray-500'}`}>
                    {selectedValues.includes(opt.value) && <Check size={10} strokeWidth={3} />}
                  </div>
                  <span className="truncate">{opt.label}</span>
                </div>
             ))}
          </div>
          {selectedValues.length > 0 && (
             <div className="border-t border-gray-100 dark:border-gray-700 p-2">
               <button 
                 onClick={() => { onChange([]); setIsOpen(false); }}
                 className="w-full py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
               >
                 {t('reset')}
               </button>
             </div>
          )}
        </div>
      )}
    </div>
  );
};


const SubscriptionList: React.FC<Props> = ({ subscriptions, onEdit, onDelete, onDuplicate, onBatchDelete, lang }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // View State
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Multi-select Filter states
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedFrequencies, setSelectedFrequencies] = useState<string[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const [sortConfig, setSortConfig] = useState<{ key: 'price' | 'nextBillingDate' | 'name' | 'category' | 'paymentMethod' | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });

  const t = getT(lang);

  // --- Extract Filter Options ---
  
  const categoriesOptionList = useMemo(() => {
    const cats = new Set(subscriptions.map(s => s.category));
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
     const methods = new Set(subscriptions.map(s => s.paymentMethod || 'Credit Card'));
     return Array.from(methods).map(m => ({
       value: m,
       label: displayPaymentMethodLabel(m, lang),
       icon: <PaymentGlyph method={m} containerSize={18} size={12} />,
     }));
  }, [subscriptions, lang]);

  const priceRangeOptionList = useMemo(() => {
    return [
      { value: 'low', label: t('price_low') },
      { value: 'mid', label: t('price_mid') },
      { value: 'high', label: t('price_high') },
    ];
  }, [lang]);

  const statusOptionList = useMemo(() => {
    return [
        { value: 'active', label: t('active') },
        { value: 'cancelled', label: t('cancelled') }
    ];
  }, [lang]);

  const currencySymbol = (code: string) => {
    const map: Record<string, string> = {
      USD: '$',
      CNY: '¥',
      EUR: '€',
      GBP: '£',
      HKD: 'HK$',
      JPY: '¥',
      SGD: 'S$',
      AUD: 'A$',
      CAD: 'C$'
    };
    return map[code] || code;
  };

  // --- Sorting & Filtering Logic ---

  const handleSort = (key: 'price' | 'nextBillingDate' | 'name' | 'category' | 'paymentMethod') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredSubscriptions = useMemo(() => {
    return subscriptions
      .filter(sub => 
        sub.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .filter(sub => 
        selectedCategories.length === 0 || selectedCategories.includes(sub.category)
      )
      .filter(sub => 
        selectedFrequencies.length === 0 || selectedFrequencies.includes(sub.frequency)
      )
      .filter(sub => 
        selectedPayments.length === 0 || selectedPayments.includes(sub.paymentMethod || 'Credit Card')
      )
      .filter(sub => 
        selectedStatuses.length === 0 || selectedStatuses.includes(sub.status || 'active')
      )
      .filter(sub => {
        if (selectedPriceRanges.length === 0) return true;
        // OR logic for price ranges
        return selectedPriceRanges.some(range => {
           if (range === 'low') return sub.price >= 0 && sub.price <= 5;
           if (range === 'mid') return sub.price > 5 && sub.price <= 10;
           if (range === 'high') return sub.price > 10;
           return false;
        });
      })
      .sort((a, b) => {
        if (!sortConfig.key) return 0;

        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        if (sortConfig.key === 'name') {
          aValue = (a.name || '').toLowerCase();
          bValue = (b.name || '').toLowerCase();
        }
        if (sortConfig.key === 'category') {
          aValue = (a.category || '').toLowerCase();
          bValue = (b.category || '').toLowerCase();
        }
        if (sortConfig.key === 'paymentMethod') {
          aValue = (a.paymentMethod || 'credit card').toLowerCase();
          bValue = (b.paymentMethod || 'credit card').toLowerCase();
        }

        // Date comparison
        if (sortConfig.key === 'nextBillingDate') {
          aValue = new Date(a.nextBillingDate).getTime();
          bValue = new Date(b.nextBillingDate).getTime();
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [subscriptions, searchTerm, selectedCategories, selectedFrequencies, selectedPayments, selectedPriceRanges, selectedStatuses, sortConfig]);

  // Selection Logic
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


  const getDaysRemaining = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const renderDateBadge = (dateStr: string) => {
    const days = getDaysRemaining(dateStr);
    let badge = null;

    if (days <= 3) {
      badge = (
        <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full whitespace-nowrap shadow-sm">
          {days < 0 ? t('overdue') : days === 0 ? t('today') : `${days} ${t('days_left')}`}
        </span>
      );
    } else if (days <= 5) {
      badge = (
        <span className="ml-2 px-2 py-0.5 bg-yellow-400 text-gray-900 text-[10px] font-bold rounded-full whitespace-nowrap shadow-sm">
          {days} {t('days_left')}
        </span>
      );
    }

    return (
      <div className="flex items-center">
        <span>{dateStr}</span>
        {badge}
      </div>
    );
  };
  
  const renderStatusBadge = (status: 'active' | 'cancelled') => {
      if (status === 'cancelled') {
          return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{t('cancelled')}</span>
      }
      return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{t('active')}</span>
  };

  if (subscriptions.length === 0 && !searchTerm) {
    return (
      <div className="mac-surface rounded-2xl p-10 text-center border border-dashed border-gray-300 dark:border-gray-600">
        <p className="text-gray-500 dark:text-gray-400">{t('manage_text')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters Toolbar */}
      <div className="mac-surface p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full xl:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder={t('search_placeholder')} 
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
           <FilterMultiSelect 
              label={t('categories')} 
              options={categoriesOptionList} 
              selectedValues={selectedCategories} 
              onChange={setSelectedCategories}
              t={t}
           />
           <FilterMultiSelect 
              label={t('frequency')} 
              options={frequenciesOptionList} 
              selectedValues={selectedFrequencies} 
              onChange={setSelectedFrequencies}
              t={t}
           />
           <FilterMultiSelect 
              label={t('payment')} 
              options={paymentMethodsOptionList} 
              selectedValues={selectedPayments} 
              onChange={setSelectedPayments}
              t={t}
           />
            <FilterMultiSelect 
              label={t('price_range')} 
              options={priceRangeOptionList} 
              selectedValues={selectedPriceRanges} 
              onChange={setSelectedPriceRanges}
              t={t}
           />
           <FilterMultiSelect 
              label={t('status')} 
              options={statusOptionList} 
              selectedValues={selectedStatuses} 
              onChange={setSelectedStatuses}
              t={t}
           />
           
           {(selectedCategories.length > 0 || selectedFrequencies.length > 0 || selectedPayments.length > 0 || selectedPriceRanges.length > 0 || selectedStatuses.length > 0) && (
              <button 
                onClick={() => {
                  setSelectedCategories([]);
                  setSelectedFrequencies([]);
                  setSelectedPayments([]);
                  setSelectedPriceRanges([]);
                  setSelectedStatuses([]);
                }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1"
              >
                <X size={14}/>
                {t('reset')}
              </button>
           )}
        </div>
        
        {/* Right Actions: View Toggle & Batch Actions */}
        <div className="flex items-center gap-2 ml-auto">
            {selectedIds.size > 0 && (
                <button
                    onClick={executeBatchDelete}
                    className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors text-sm font-medium animate-fade-in"
                >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline">{t('batch_delete')} ({selectedIds.size})</span>
                </button>
            )}

            <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-1 border border-gray-200 dark:border-gray-600">
                <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary-600 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    title={t('view_list')}
                >
                    <List size={18} />
                </button>
                <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary-600 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    title={t('view_grid')}
                >
                    <LayoutGrid size={18} />
                </button>
            </div>
        </div>
      </div>

      {/* Content Area */}
      {viewMode === 'list' ? (
          // LIST VIEW
          <div className="mac-surface rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left align-middle">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-6 py-4 w-12">
                         <div className="flex items-center">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 dark:bg-slate-800 dark:border-gray-600 cursor-pointer"
                                checked={selectedIds.size === filteredSubscriptions.length && filteredSubscriptions.length > 0}
                                onChange={handleSelectAll}
                            />
                         </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors select-none group whitespace-nowrap"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        {t('service')}
                        {sortConfig.key === 'name' ? (
                          sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary-600"/> : <ArrowDown size={14} className="text-primary-600"/>
                        ) : (
                          <ArrowUpDown size={14} className="text-gray-300 group-hover:text-gray-500"/>
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors select-none group whitespace-nowrap"
                      onClick={() => handleSort('category')}
                    >
                      <div className="flex items-center gap-1">
                        {t('category')}
                        {sortConfig.key === 'category' ? (
                          sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary-600"/> : <ArrowDown size={14} className="text-primary-600"/>
                        ) : (
                          <ArrowUpDown size={14} className="text-gray-300 group-hover:text-gray-500"/>
                        )}
                      </div>
                    </th>
                    
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">{t('status')}</th>

                    <th 
                      className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors select-none group whitespace-nowrap"
                      onClick={() => handleSort('price')}
                    >
                      <div className="flex items-center gap-1">
                        {t('cost')}
                        {sortConfig.key === 'price' ? (
                          sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary-600"/> : <ArrowDown size={14} className="text-primary-600"/>
                        ) : (
                          <ArrowUpDown size={14} className="text-gray-300 group-hover:text-gray-500"/>
                        )}
                      </div>
                    </th>
                    
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">{t('frequency')}</th>
                    <th 
                      className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors select-none group whitespace-nowrap"
                      onClick={() => handleSort('paymentMethod')}
                    >
                      <div className="flex items-center gap-1">
                        {t('payment')}
                        {sortConfig.key === 'paymentMethod' ? (
                          sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary-600"/> : <ArrowDown size={14} className="text-primary-600"/>
                        ) : (
                          <ArrowUpDown size={14} className="text-gray-300 group-hover:text-gray-500"/>
                        )}
                      </div>
                    </th>
                    
                    <th 
                      className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors select-none group whitespace-nowrap"
                      onClick={() => handleSort('nextBillingDate')}
                    >
                       <div className="flex items-center gap-1">
                        {t('next_bill')}
                        {sortConfig.key === 'nextBillingDate' ? (
                          sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary-600"/> : <ArrowDown size={14} className="text-primary-600"/>
                        ) : (
                          <ArrowUpDown size={14} className="text-gray-300 group-hover:text-gray-500"/>
                        )}
                      </div>
                    </th>
                    
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider text-right whitespace-nowrap">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredSubscriptions.map((sub) => (
                    <tr 
                        key={sub.id} 
                        className={`hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${selectedIds.has(sub.id) ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 dark:bg-slate-800 dark:border-gray-600 cursor-pointer"
                                checked={selectedIds.has(sub.id)}
                                onChange={() => handleSelectOne(sub.id)}
                            />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          {sub.iconUrl ? (
                              <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-600 border border-gray-200 dark:border-gray-600 overflow-hidden flex-shrink-0">
                                   <img src={sub.iconUrl} alt={sub.name} className="w-full h-full object-contain" />
                              </div>
                          ) : (
                              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg flex-shrink-0">
                              {sub.name.charAt(0).toUpperCase()}
                              </div>
                          )}
                          
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{sub.name}</p>
                            {sub.url && (
                              <div className="flex items-center space-x-1 text-xs text-primary-500 hover:underline">
                                  <a href={sub.url} target="_blank" rel="noreferrer" className="flex items-center">
                                    {t('view_details')}
                                    <ExternalLink size={10} className="ml-1"/>
                                  </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <CategoryGlyph category={sub.category || '-'} containerSize={20} size={12} />
                          <span className="truncate">{displayCategoryLabel(sub.category || '-', lang)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                          {renderStatusBadge(sub.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900 dark:text-white">{currencySymbol(sub.currency)}{sub.price.toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            sub.frequency === Frequency.MONTHLY ? 'bg-blue-100 text-blue-800' : 
                            sub.frequency === Frequency.YEARLY ? 'bg-purple-100 text-purple-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                          {displayFrequencyLabel(sub.frequency, lang)}
                        </span>
                      </td>
		                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
		                          <div className="flex items-center gap-2">
		                              <PaymentGlyph method={sub.paymentMethod || 'Credit Card'} containerSize={20} size={12} />
		                              <span className="truncate">{displayPaymentMethodLabel(sub.paymentMethod || 'Credit Card', lang)}</span>
		                          </div>
		                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {renderDateBadge(sub.nextBillingDate)}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onEdit(sub); }}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-600 rounded-lg transition"
                            title={t('edit_subscription')}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDuplicate(sub); }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-600 rounded-lg transition"
                            title={t('duplicate')}
                          >
                            <Copy size={16} />
                          </button>
                          <button 
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
                  {filteredSubscriptions.length === 0 && (
                    <tr>
                       <td colSpan={9} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                          No subscriptions found matching your criteria.
                       </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
      ) : (
          // GRID VIEW
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
             {filteredSubscriptions.map(sub => (
                 <div 
                    key={sub.id}
	                    className={`mac-surface rounded-2xl p-5 shadow-sm border transition-all relative group ${
                        selectedIds.has(sub.id) 
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
                            onChange={() => handleSelectOne(sub.id)}
                        />
                     </div>

                     {/* Actions (Absolute) */}
                     <div className="absolute top-3 right-3 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                             onClick={(e) => { e.stopPropagation(); onEdit(sub); }}
                             className="p-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-white hover:text-primary-600 rounded-md text-gray-500 shadow-sm"
                         >
                             <Edit2 size={14} />
                         </button>
                         <button 
                             onClick={(e) => { e.stopPropagation(); onDuplicate(sub); }}
                             className="p-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-white hover:text-blue-600 rounded-md text-gray-500 shadow-sm"
                         >
                             <Copy size={14} />
                         </button>
                         <button 
                             onClick={(e) => { e.stopPropagation(); onDelete(sub.id); }}
                             className="p-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-white hover:text-red-600 rounded-md text-gray-500 shadow-sm"
                         >
                             <Trash2 size={14} />
                         </button>
                     </div>

                     {/* Card Content */}
                     <div className="flex flex-col items-center text-center mt-2">
                         {sub.iconUrl ? (
                             <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-slate-700 p-1 mb-3 relative">
                                 <img src={sub.iconUrl} alt={sub.name} className="w-full h-full object-contain rounded-xl" />
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
                                {currencySymbol(sub.currency)}{sub.price}
                            </span>
                             <span className="text-xs text-gray-500">
                                / {lang === 'zh' ? (sub.frequency === Frequency.MONTHLY ? '月' : sub.frequency === Frequency.YEARLY ? '年' : '周期') : (sub.frequency === Frequency.MONTHLY ? 'mo' : sub.frequency === Frequency.YEARLY ? 'yr' : 'cycle')}
                            </span>
                         </div>
                         
                         <div className="w-full border-t border-gray-100 dark:border-gray-700 pt-3 mt-auto flex justify-between items-center text-xs">
                             <span className="text-gray-400">{t('next_bill')}</span>
                             <div className="font-medium text-gray-700 dark:text-gray-200">
                                 {renderDateBadge(sub.nextBillingDate)}
                             </div>
                         </div>
                     </div>
                 </div>
             ))}
             {filteredSubscriptions.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400 mac-surface rounded-2xl border border-dashed border-gray-200">
	                   {t('no_subscriptions')}
	                </div>
	             )}
          </div>
      )}
    </div>
  );
};

export default SubscriptionList;
