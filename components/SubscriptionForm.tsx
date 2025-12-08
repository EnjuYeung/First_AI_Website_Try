
import React, { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, Bell } from 'lucide-react';
import { Frequency, Subscription, AppSettings } from '../types';
import { getT } from '../services/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sub: Subscription) => void;
  initialData?: Subscription | null;
  settings: AppSettings;
  lang: 'en' | 'zh';
}

const SubscriptionForm: React.FC<Props> = ({ isOpen, onClose, onSave, initialData, settings, lang }) => {
  const t = getT(lang);
  
  const frequencyLabel = (freq: Frequency) => {
    if (lang === 'zh') {
      switch (freq) {
        case Frequency.MONTHLY: return '月度';
        case Frequency.QUARTERLY: return '季度';
        case Frequency.SEMI_ANNUALLY: return '半年';
        case Frequency.YEARLY: return '年度';
        default: return freq;
      }
    }
    return freq;
  };

  const [formData, setFormData] = useState<Partial<Subscription>>({
    name: '',
    price: 0,
    currency: 'USD',
    frequency: Frequency.MONTHLY,
    category: 'Other',
    paymentMethod: 'Credit Card',
    status: 'active',
    startDate: new Date().toISOString().split('T')[0],
    nextBillingDate: '',
    notes: '',
    notificationsEnabled: true
  });

  // Helper to calculate next billing date
  const calculateNextDate = useCallback((startStr: string, freq: Frequency) => {
    if (!startStr || !freq) return '';

    // Manually parse YYYY-MM-DD to construct local date
    const [y, m, d] = startStr.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    start.setHours(0,0,0,0);

    const today = new Date();
    today.setHours(0,0,0,0);

    let nextDate = new Date(start);

    // If the start date is in the future, that is the next billing date
    if (nextDate > today) {
      const year = nextDate.getFullYear();
      const month = String(nextDate.getMonth() + 1).padStart(2, '0');
      const day = String(nextDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // If start date is today or past, add frequency until > today
    while (nextDate <= today) {
      switch (freq) {
        case Frequency.MONTHLY:
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case Frequency.QUARTERLY:
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case Frequency.SEMI_ANNUALLY:
          nextDate.setMonth(nextDate.getMonth() + 6);
          break;
        case Frequency.YEARLY:
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }
    }
    
    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, '0');
    const day = String(nextDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Initialize form when opening
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
            ...initialData,
            status: initialData.status || 'active',
            notificationsEnabled: initialData.notificationsEnabled !== undefined ? initialData.notificationsEnabled : true
        });
      } else {
        // Default Initialization for New Subscription
        const today = new Date().toISOString().split('T')[0];
        const defaultFreq = Frequency.MONTHLY;
        const initialNextBill = calculateNextDate(today, defaultFreq);

        setFormData({
          name: '',
          price: 0,
          currency: 'USD',
          frequency: defaultFreq,
          category: settings.customCategories[0] || 'Other',
          paymentMethod: settings.customPaymentMethods[0] || 'Credit Card',
          status: 'active',
          startDate: today,
          nextBillingDate: initialNextBill, // Set calculated value immediately
          notes: '',
          notificationsEnabled: true
        });
      }
    }
  }, [isOpen, initialData, settings.customCategories, settings.customPaymentMethods, calculateNextDate]);

  // Auto-calculate Next Billing Date when Start Date or Frequency changes
  useEffect(() => {
    if (!isOpen || !formData.startDate || !formData.frequency) return;
    
    const calculated = calculateNextDate(formData.startDate, formData.frequency);
    
    // Only update if the calculated date is different to avoid infinite loops
    if (calculated !== formData.nextBillingDate) {
      setFormData(prev => ({ ...prev, nextBillingDate: calculated }));
    }
  }, [formData.startDate, formData.frequency, isOpen, calculateNextDate, formData.nextBillingDate]);

  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialData?.id || generateId(),
      ...formData as Subscription,
      price: Number(formData.price)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden my-8 animate-fade-in">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {initialData ? t('edit_subscription') : t('add_subscription')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/40 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{t('service_name')}</h3>
                <input
                  required
                  type="text"
                  placeholder={t('service_placeholder')}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-slate-800 shadow-sm space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('price')}</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.price}
                      onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('currency')}</label>
                    <select
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.currency}
                      onChange={e => setFormData({...formData, currency: e.target.value})}
                    >
                      {settings.customCurrencies.map(c => (
                          <option key={c.code} value={c.code}>{c.code}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('frequency')}</label>
                    <select
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    value={formData.frequency}
                    onChange={e => setFormData({...formData, frequency: e.target.value as Frequency})}
                  >
                    {Object.values(Frequency).map(f => (
                      <option key={f} value={f}>{frequencyLabel(f as Frequency)}</option>
                    ))}
                  </select>
                </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('categories')}</label>
                    <select
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}
                    >
                      {settings.customCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-slate-800 shadow-sm space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('payment_methods')}</label>
                    <select
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                        value={formData.paymentMethod}
                        onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
                    >
                        {settings.customPaymentMethods.map(pm => (
                        <option key={pm} value={pm}>{pm}</option>
                        ))}
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('status')}</label>
                    <select
                      className={`w-full px-4 py-2 border rounded-lg font-semibold text-center focus:ring-2 focus:ring-primary-500 outline-none transition-colors ${
                        formData.status === 'active' 
                        ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900' 
                        : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900'
                      }`}
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value as 'active' | 'cancelled'})}
                    >
                      <option value="active">{t('active')}</option>
                      <option value="cancelled">{t('cancelled')}</option>
                    </select>
                 </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('start_date')}</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                      value={formData.startDate}
                      onChange={e => setFormData({...formData, startDate: e.target.value})}
                    />
                  </div>
                  <div>
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                       {t('next_billing_date')}
                       <RefreshCw size={12} className="text-gray-400" />
                     </label>
                     <input
                      type="date"
                      readOnly
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-slate-600 rounded-lg text-gray-500 dark:text-gray-300 cursor-not-allowed outline-none"
                      value={formData.nextBillingDate}
                     />
                  </div>
                 </div>
              </div>

              {/* Notification Toggle */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white dark:from-slate-700 dark:to-slate-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Bell size={18} />
                      <div>
                        <p className="text-sm font-semibold">{t('enable_notifications')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('next_billing_date')} {t('notifications')}</p>
                      </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={formData.notificationsEnabled} 
                        onChange={e => setFormData({...formData, notificationsEnabled: e.target.checked})} 
                        className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-95 mt-4"
          >
            {initialData ? t('save') : t('add_new')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SubscriptionForm;
