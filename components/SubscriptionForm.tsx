
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, RefreshCw, Bell, Loader2 } from 'lucide-react';
import { Frequency, Subscription, AppSettings } from '../types';
import { getT } from '../services/i18n';
import { CategoryGlyph, PaymentGlyph } from './ui/glyphs';
import { displayCategoryLabel, displayPaymentMethodLabel } from '../services/displayLabels';
import { deleteUploadedIcon, uploadIconFile } from '../services/storageService';
import { getTodayYMD } from '../services/dateUtils';
import { calculateNextBillingDateYMD } from '../shared/billingDate.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sub: Subscription) => boolean | Promise<boolean>;
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
    cancelledAt: undefined,
    startDate: getTodayYMD(settings.timezone),
    nextBillingDate: '',
    iconUrl: '',
    notes: '',
    notificationsEnabled: true
  });

  const [iconLoadError, setIconLoadError] = useState(false);
  const [iconUploadError, setIconUploadError] = useState<string | null>(null);
  const [isIconUploading, setIsIconUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const temporaryUploads = useRef(new Set<string>());
  const formSession = useRef(0);
  const initializedFor = useRef<string | null>(null);
  const scheduleTouched = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const iconUrl = String(formData.iconUrl || '').trim();

  const handleIconFile = async (file: File | null) => {
    if (!file) return;
    const uploadSession = formSession.current;
    setIconLoadError(false);
    setIconUploadError(null);

    // Keep payload sizes reasonable for persistence.
    const maxBytes = 1 * 1024 * 1024;
    if (file.size > maxBytes) {
      setIconUploadError(t('upload_icon_too_large'));
      return;
    }

    try {
      setIsIconUploading(true);
      const uploadedUrl = await uploadIconFile(file);
      if (formSession.current !== uploadSession) {
        await deleteUploadedIcon(uploadedUrl).catch(console.error);
        return;
      }
      temporaryUploads.current.add(uploadedUrl);
      setFormData((prev) => ({ ...prev, iconUrl: uploadedUrl }));
    } catch (err: any) {
      if (formSession.current !== uploadSession) return;
      const msg = String(err?.message || '');
      if (msg.includes('icon_too_large') || msg.includes('LIMIT_FILE_SIZE')) {
        setIconUploadError(t('upload_icon_too_large'));
      } else if (msg.includes('unsupported_file_type')) {
        setIconUploadError(t('upload_icon_unsupported'));
      } else {
        setIconUploadError(t('upload_icon_failed'));
      }
    } finally {
      if (formSession.current === uploadSession) setIsIconUploading(false);
    }
  };

  // Helper to calculate next billing date
  const calculateNextDate = useCallback((startStr: string, freq: Frequency) => {
    return calculateNextBillingDateYMD(startStr, freq, getTodayYMD(settings.timezone));
  }, [settings.timezone]);

  // Initialize form when opening
  useEffect(() => {
    if (!isOpen) {
      initializedFor.current = null;
      formSession.current += 1;
      setIsIconUploading(false);
      setIsSubmitting(false);
      return;
    }

    const recordKey = initialData?.id || '__new__';
    if (initializedFor.current === recordKey) return;
    initializedFor.current = recordKey;
    formSession.current += 1;
    scheduleTouched.current = false;
    setSubmitError(null);
    setIsSubmitting(false);
    setIconLoadError(false);
    setIconUploadError(null);

      if (initialData) {
        setFormData({
            ...initialData,
            status: initialData.status || 'active',
            cancelledAt: initialData.status === 'cancelled' ? initialData.cancelledAt : undefined,
            iconUrl: initialData.iconUrl || '',
            notificationsEnabled: initialData.notificationsEnabled !== undefined ? initialData.notificationsEnabled : true
        });
      } else {
        // Default Initialization for New Subscription
        const today = getTodayYMD(settings.timezone);
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
          iconUrl: '',
          notes: '',
          notificationsEnabled: true
        });
      }
  }, [isOpen, initialData?.id, calculateNextDate]);

  // Auto-calculate Next Billing Date when Start Date or Frequency changes
  useEffect(() => {
    if (
      !isOpen ||
      formData.status === 'cancelled' ||
      !formData.startDate ||
      !formData.frequency ||
      (initialData && !scheduleTouched.current)
    ) return;
    
    const calculated = calculateNextDate(formData.startDate, formData.frequency);
    
    // Only update if the calculated date is different to avoid infinite loops
    if (calculated !== formData.nextBillingDate) {
      setFormData(prev => ({ ...prev, nextBillingDate: calculated }));
    }
  }, [formData.startDate, formData.frequency, formData.status, isOpen, initialData, calculateNextDate, formData.nextBillingDate]);

  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  const handleStatusChange = (value: 'active' | 'cancelled') => {
    setFormData((prev) => {
      if (value === 'cancelled') {
        if (prev.status === 'cancelled') return { ...prev, status: value, nextBillingDate: '' };
        return { ...prev, status: value, cancelledAt: getTodayYMD(settings.timezone), nextBillingDate: '' };
      }
      scheduleTouched.current = true;
      return { ...prev, status: value, cancelledAt: undefined };
    });
  };

  const closeAndDiscardUploads = useCallback(() => {
    formSession.current += 1;
    setIsIconUploading(false);
    setIsSubmitting(false);
    const pending = [...temporaryUploads.current];
    temporaryUploads.current.clear();
    pending.forEach((url) => void deleteUploadedIcon(url).catch(console.error));
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const firstInput = dialog?.querySelector<HTMLElement>('input:not([type="hidden"]), button, select, textarea');
    firstInput?.focus();
  }, [isOpen]);

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndDiscardUploads();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) || [])];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isIconUploading) return;
    setIsSubmitting(true);
    setSubmitError(null);
    let saved = false;
    try {
      saved = await onSave({
          id: initialData?.id || generateId(),
          ...formData as Subscription,
          price: Number(formData.price),
          iconUrl: iconUrl.length > 0 ? iconUrl : undefined
        });
    } catch {
      saved = false;
    }
    if (!saved) {
      setIsSubmitting(false);
      setSubmitError(lang === 'zh' ? '保存失败，请检查网络后重试。' : 'Save failed. Check your connection and try again.');
      return;
    }
    temporaryUploads.current.delete(iconUrl);
    const unused = [...temporaryUploads.current];
    temporaryUploads.current.clear();
    unused.forEach((url) => void deleteUploadedIcon(url).catch(console.error));
    onClose();
  };

  return (
    <div className="dialog-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 animate-fade-in sm:p-4">
      <div ref={dialogRef} onKeyDown={handleDialogKeyDown} role="dialog" aria-modal="true" aria-labelledby="subscription-form-title" className="dialog-panel my-6 max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[20px] animate-pop-in">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
          <div>
            <div className="eyebrow mb-2">Subm / {t('subscriptions')}</div>
            <h2 id="subscription-form-title" className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--ink)]">
            {initialData ? t('edit_subscription') : t('add_subscription')}
            </h2>
          </div>
          <button aria-label={t('close')} onClick={closeAndDiscardUploads} className="icon-control rounded-xl p-2 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="subscription-form space-y-5 p-5 sm:p-7">
          {/* 服务名称 */}
          <div className="p-5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/40 shadow-sm">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('service_name')}</label>
            <input
              required
              type="text"
              placeholder={t('service_placeholder')}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-base"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>

          {/* 图标设置（在线链接） */}
          <div className="p-5 rounded-xl border border-gray-100 dark:border-gray-700 mac-surface-soft shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/70 dark:bg-slate-900/40 ring-1 ring-black/5 dark:ring-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
	                {iconUrl && !iconLoadError ? (
                  <img
                    src={iconUrl}
                    alt={String(formData.name || 'icon')}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setIconLoadError(true)}
                  />
                ) : (
                  <span className="text-xl font-bold text-primary-600">
                    {String(formData.name || 'S').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('icon_url')}
                </label>
                <input
                  type="text"
                  inputMode="url"
                  placeholder={t('icon_url_placeholder')}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  value={String(formData.iconUrl || '')}
                  onChange={(e) => {
                    setIconLoadError(false);
                    setIconUploadError(null);
                    setFormData({ ...formData, iconUrl: e.target.value });
                  }}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('icon_url_tip')}</p>
                {iconUploadError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{iconUploadError}</p>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <label className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100/70 dark:bg-slate-700/60 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl transition-colors cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={isIconUploading}
                      onChange={(e) => handleIconFile(e.target.files?.[0] || null)}
                    />
                    {isIconUploading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>{t('uploading')}</span>
                      </>
                    ) : (
                      <span>{t('upload_from_device')}</span>
                    )}
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t('upload_icon_hint')}</span>
                </div>
              </div>

              {iconUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setIconLoadError(false);
                    setFormData({ ...formData, iconUrl: '' });
                  }}
                  className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-200 bg-gray-100/70 dark:bg-slate-700/60 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
                  title={t('clear_icon')}
                >
                  {t('clear_icon')}
                </button>
              )}
            </div>
          </div>

          {/* 价格/币种/周期/分类 */}
          <div className="p-5 rounded-xl border border-gray-100 dark:border-gray-700 mac-surface-soft shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('price')}</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.price}
                  onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('currency')}</label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.currency}
                  onChange={e => setFormData({...formData, currency: e.target.value})}
                >
                  {settings.customCurrencies.map(c => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('frequency')}</label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.frequency}
                  onChange={e => {
                    scheduleTouched.current = true;
                    setFormData({...formData, frequency: e.target.value as Frequency});
                  }}
                >
                  {Object.values(Frequency).map(f => (
                    <option key={f} value={f}>{frequencyLabel(f as Frequency)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <CategoryGlyph category={String(formData.category || '')} containerSize={18} size={12} />
                  <span>{t('categories')}</span>
                </label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                >
                  {settings.customCategories.map(cat => (
                    <option key={cat} value={cat}>{displayCategoryLabel(cat, lang)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 支付方式 / 状态 */}
          <div className="p-5 rounded-xl border border-gray-100 dark:border-gray-700 mac-surface-soft shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	              <div className="flex flex-col gap-1">
	                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
	                  <PaymentGlyph method={String(formData.paymentMethod || 'Credit Card')} containerSize={18} size={12} />
	                  <span>{lang === 'zh' ? '支付方式' : t('payment_methods')}</span>
	                </label>
	                <select
	                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
	                    value={formData.paymentMethod}
	                    onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
	                >
	                    {settings.customPaymentMethods.map(pm => (
	                    <option key={pm} value={pm}>{displayPaymentMethodLabel(pm, lang)}</option>
	                    ))}
	                </select>
	              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('status')}</label>
                <select
                  className={`w-full px-4 py-2.5 border rounded-lg font-semibold text-center focus:ring-2 focus:ring-primary-500 outline-none transition-colors ${
                    formData.status === 'active' 
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900' 
                    : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900'
                  }`}
                  value={formData.status}
                  onChange={e => handleStatusChange(e.target.value as 'active' | 'cancelled')}
                >
                  <option value="active">{t('active')}</option>
                  <option value="cancelled">{t('cancelled')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* 起始日期 / 下个账单日 */}
          <div className="p-5 rounded-xl border border-gray-100 dark:border-gray-700 mac-surface-soft shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('start_date')}</label>
                <input
                  type="date"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none font-mono text-sm"
                  value={formData.startDate}
                  onChange={e => {
                    scheduleTouched.current = true;
                    setFormData({...formData, startDate: e.target.value});
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                 <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                   {t('next_billing_date')}
                   <RefreshCw size={12} className="text-gray-400" />
                 </label>
                 <input
                  type="date"
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-slate-600 rounded-lg text-gray-600 dark:text-gray-200 cursor-not-allowed outline-none font-mono text-sm tracking-wide"
                  value={formData.nextBillingDate}
                 />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="p-5 rounded-xl border border-gray-100 dark:border-gray-700 mac-surface-soft shadow-sm">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('notes')}</label>
            <textarea
              className="w-full min-h-[100px] px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
            />
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

          <button
            type="submit"
            disabled={isIconUploading || isSubmitting}
            className="primary-action mt-2 w-full rounded-xl py-4 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? (lang === 'zh' ? '保存中…' : 'Saving…')
              : initialData ? t('save') : t('add_new')}
          </button>
          {submitError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{submitError}</p>}
        </form>
      </div>
    </div>
  );
};

export default SubscriptionForm;
