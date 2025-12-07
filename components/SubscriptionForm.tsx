
import React, { useState, useEffect, useCallback } from 'react';
import { X, Upload, RefreshCw, Image as ImageIcon, Bell, CheckCircle2, XCircle } from 'lucide-react';
import { Frequency, Subscription, AppSettings } from '../types';
import { translations } from '../services/i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sub: Subscription) => void;
  initialData?: Subscription | null;
  settings: AppSettings;
  lang: 'en' | 'zh';
}

const SubscriptionForm: React.FC<Props> = ({ isOpen, onClose, onSave, initialData, settings, lang }) => {
  const t = (key: keyof typeof translations['en']) => {
    const value = translations[lang][key];
    return value !== undefined ? value : key; // allow empty string
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
    iconUrl: '',
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
          iconUrl: '',
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


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, iconUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

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
          
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left Column: Icon */}
            <div className="w-full md:w-1/3 space-y-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('upload_icon')}</label>
              
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 relative group">
                  {formData.iconUrl ? (
                    <>
                      <img src={formData.iconUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, iconUrl: '' }))}
                        className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white font-medium"
                      >
                        {t('remove')}
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="text-gray-400" size={32} />
                  )}
                </div>
              </div>

              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-full py-2 bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition flex items-center justify-center space-x-2">
                  <Upload size={16} />
                  <span>{t('upload_icon')}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Details */}
            <div className="w-full md:w-2/3 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('service_name')}</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Netflix, Spotify"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

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
                        <option key={c.code} value={c.code}>{c.code} ({c.name})</option>
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
                      <option key={f} value={f}>{f}</option>
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

               {/* Payment Method & Status Row */}
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
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('status')}</label>
                    <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, status: 'active'})}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                              formData.status === 'active' 
                              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900' 
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-slate-700 dark:text-gray-300 dark:border-gray-600'
                          }`}
                        >
                            <CheckCircle2 size={16} />
                            {t('active')}
                        </button>
                         <button
                          type="button"
                          onClick={() => setFormData({...formData, status: 'cancelled'})}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                              formData.status === 'cancelled' 
                              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900' 
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-slate-700 dark:text-gray-300 dark:border-gray-600'
                          }`}
                        >
                            <XCircle size={16} />
                            {t('cancelled')}
                        </button>
                    </div>
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

              {/* Notification Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-100 dark:border-gray-600">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Bell size={18} />
                      <span className="text-sm font-medium">{t('enable_notifications')}</span>
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
