import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, RefreshCw, Bell, Loader2, ChevronDown, Upload } from 'lucide-react';
import { useDialogScrollLock } from '../hooks/useDialogScrollLock';
import { Frequency, Subscription, AppSettings } from '../types';
import { getT } from '../services/i18n';
import { newId } from '../services/ids';
import { CategoryGlyph, PaymentGlyph } from './ui/glyphs';
import {
  displayCategoryLabel,
  displayFrequencyLabel,
  displayPaymentMethodLabel,
} from '../services/displayLabels';
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

const SubscriptionForm: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  settings,
  lang,
}) => {
  const t = getT(lang);
  useDialogScrollLock(isOpen);

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
    url: '',
    notes: '',
    notificationsEnabled: true,
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

  useEffect(
    () => () => {
      // A late upload belongs to the closed form, even when the lazy form unmounts.
      formSession.current += 1;
    },
    []
  );

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
  const calculateNextDate = useCallback(
    (startStr: string, freq: Frequency) => {
      return calculateNextBillingDateYMD(startStr, freq, getTodayYMD(settings.timezone));
    },
    [settings.timezone]
  );

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
        notificationsEnabled:
          initialData.notificationsEnabled !== undefined ? initialData.notificationsEnabled : true,
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
        url: '',
        notes: '',
        notificationsEnabled: true,
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
    )
      return;

    const calculated = calculateNextDate(formData.startDate, formData.frequency);

    // Only update if the calculated date is different to avoid infinite loops
    if (calculated !== formData.nextBillingDate) {
      setFormData((prev) => ({ ...prev, nextBillingDate: calculated }));
    }
  }, [
    formData.startDate,
    formData.frequency,
    formData.status,
    isOpen,
    initialData,
    calculateNextDate,
    formData.nextBillingDate,
  ]);

  const handleStatusChange = (value: 'active' | 'cancelled') => {
    setFormData((prev) => {
      if (value === 'cancelled') {
        if (prev.status === 'cancelled') return { ...prev, status: value, nextBillingDate: '' };
        return {
          ...prev,
          status: value,
          cancelledAt: getTodayYMD(settings.timezone),
          nextBillingDate: '',
        };
      }
      scheduleTouched.current = true;
      return { ...prev, status: value, cancelledAt: undefined };
    });
  };

  const closeAndDiscardUploads = useCallback(() => {
    if (isSubmitting) return;
    formSession.current += 1;
    setIsIconUploading(false);
    setIsSubmitting(false);
    const pending = [...temporaryUploads.current];
    temporaryUploads.current.clear();
    pending.forEach((url) => void deleteUploadedIcon(url).catch(console.error));
    onClose();
  }, [onClose, isSubmitting]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLInputElement>('#subscription-name')?.focus();
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndDiscardUploads();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
      ) || []),
    ].filter((control) => control.tagName === 'SUMMARY' || !control.closest('details:not([open])'));
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
        id: initialData?.id || newId(),
        ...(formData as Subscription),
        price: Number(formData.price),
        iconUrl: iconUrl.length > 0 ? iconUrl : undefined,
      });
    } catch {
      saved = false;
    }
    if (!saved) {
      setIsSubmitting(false);
      setSubmitError(t('save_failed_detail'));
      return;
    }
    temporaryUploads.current.delete(iconUrl);
    const unused = [...temporaryUploads.current];
    temporaryUploads.current.clear();
    unused.forEach((url) => void deleteUploadedIcon(url).catch(console.error));
    onClose();
  };

  return (
    <div className="dialog-backdrop editor-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div
        ref={dialogRef}
        onKeyDown={handleDialogKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscription-form-title"
        className="dialog-panel subscription-editor-panel"
      >
        <header className="editor-heading">
          <div>
            <h2 id="subscription-form-title">
              {initialData ? t('edit_subscription') : t('add_subscription')}
            </h2>
            <p>{t('core_details')}</p>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            aria-label={t('close')}
            onClick={closeAndDiscardUploads}
            className="icon-control"
          >
            <X size={21} aria-hidden="true" />
          </button>
        </header>
        <form
          id="subscription-editor"
          onSubmit={handleSubmit}
          onInvalidCapture={(event) => {
            event.target.closest('details')?.setAttribute('open', '');
          }}
          className="subscription-form redesigned-form"
        >
          <div className="editor-field editor-wide">
            <label htmlFor="subscription-name">{t('service_name')}</label>
            <input
              id="subscription-name"
              required
              type="text"
              autoComplete="off"
              placeholder={t('service_placeholder')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <fieldset className="editor-section editor-wide">
            <legend>{t('billing_details')}</legend>
            <div className="editor-grid price-grid">
              <div className="editor-field">
                <label htmlFor="subscription-price">{t('price')}</label>
                <input
                  id="subscription-price"
                  required
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                />
              </div>
              <div className="editor-field">
                <label htmlFor="subscription-currency">{t('currency')}</label>
                <select
                  id="subscription-currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                >
                  {settings.customCurrencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="editor-field">
                <label htmlFor="subscription-frequency">{t('frequency')}</label>
                <select
                  id="subscription-frequency"
                  value={formData.frequency}
                  onChange={(e) => {
                    scheduleTouched.current = true;
                    setFormData({ ...formData, frequency: e.target.value as Frequency });
                  }}
                >
                  {Object.values(Frequency).map((f) => (
                    <option key={f} value={f}>
                      {displayFrequencyLabel(f, lang)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="editor-grid mt-4">
              <div className="editor-field">
                <label htmlFor="subscription-start-date">{t('start_date')}</label>
                <input
                  id="subscription-start-date"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => {
                    scheduleTouched.current = true;
                    setFormData({ ...formData, startDate: e.target.value });
                  }}
                />
              </div>
              <div className="editor-field">
                <label htmlFor="subscription-next-date">
                  {t('next_billing_date')}
                  <RefreshCw size={13} aria-hidden="true" />
                </label>
                <input
                  id="subscription-next-date"
                  type="date"
                  readOnly
                  aria-describedby="billing-date-hint"
                  value={formData.nextBillingDate}
                />
                <p id="billing-date-hint" className="field-hint">
                  {t('automatic_date_hint')}
                </p>
              </div>
            </div>
          </fieldset>
          <fieldset className="editor-section editor-wide">
            <legend>{t('organize_details')}</legend>
            <div className="editor-grid">
              <div className="editor-field">
                <label htmlFor="subscription-category">
                  <CategoryGlyph
                    category={String(formData.category || '')}
                    containerSize={18}
                    size={12}
                  />
                  {t('categories')}
                </label>
                <select
                  id="subscription-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {settings.customCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {displayCategoryLabel(cat, lang)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="editor-field">
                <label htmlFor="subscription-payment">
                  <PaymentGlyph
                    method={String(formData.paymentMethod || 'Credit Card')}
                    containerSize={18}
                    size={12}
                  />
                  {t('payment')}
                </label>
                <select
                  id="subscription-payment"
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                >
                  {settings.customPaymentMethods.map((pm) => (
                    <option key={pm} value={pm}>
                      {displayPaymentMethodLabel(pm, lang)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>
          <div className="editor-field editor-wide">
            <label htmlFor="subscription-status">{t('status')}</label>
            <select
              id="subscription-status"
              value={formData.status}
              onChange={(e) => handleStatusChange(e.target.value as 'active' | 'cancelled')}
            >
              <option value="active">{t('active')}</option>
              <option value="cancelled">{t('cancelled')}</option>
            </select>
            <p className="field-hint">{t('record_status_hint')}</p>
          </div>
          <div className="editor-reminder editor-wide">
            <Bell size={18} aria-hidden="true" />
            <div>
              <label htmlFor="subscription-reminder">{t('billing_reminder')}</label>
              <p>{t('reminder_setup_note')}</p>
            </div>
            <input
              id="subscription-reminder"
              type="checkbox"
              checked={formData.notificationsEnabled}
              onChange={(e) => setFormData({ ...formData, notificationsEnabled: e.target.checked })}
            />
          </div>
          <details className="editor-optional editor-wide">
            <summary>
              {t('optional_details')}
              <span>{t('optional')}</span>
              <ChevronDown size={17} aria-hidden="true" />
            </summary>
            <div className="optional-body">
              <div className="editor-icon-row">
                <span className="editor-icon-preview" aria-hidden="true">
                  {iconUrl && !iconLoadError ? (
                    <img
                      src={iconUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={() => setIconLoadError(true)}
                    />
                  ) : (
                    String(formData.name || 'S')
                      .charAt(0)
                      .toUpperCase()
                  )}
                </span>
                <div>
                  <label className="file-upload-control secondary-action">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      aria-label={t('upload_from_device')}
                      disabled={isIconUploading}
                      onChange={(e) => handleIconFile(e.target.files?.[0] || null)}
                    />
                    {isIconUploading ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Upload size={16} aria-hidden="true" />
                    )}
                    <span>{isIconUploading ? t('uploading') : t('upload_from_device')}</span>
                  </label>
                  <p className="field-hint">{t('upload_icon_hint')}</p>
                </div>
                {iconUrl && (
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => {
                      setIconLoadError(false);
                      setFormData({ ...formData, iconUrl: '' });
                    }}
                  >
                    {t('clear_icon')}
                  </button>
                )}
              </div>
              <div className="editor-field">
                <label htmlFor="subscription-icon">{t('icon_url')}</label>
                <input
                  id="subscription-icon"
                  type="text"
                  inputMode="url"
                  placeholder={t('icon_url_placeholder')}
                  value={String(formData.iconUrl || '')}
                  aria-describedby={iconUploadError ? 'icon-upload-error' : undefined}
                  onChange={(e) => {
                    setIconLoadError(false);
                    setIconUploadError(null);
                    setFormData({ ...formData, iconUrl: e.target.value });
                  }}
                />
                {iconUploadError && (
                  <p id="icon-upload-error" role="alert" className="field-error">
                    {iconUploadError}
                  </p>
                )}
              </div>
              <div className="editor-field">
                <label htmlFor="subscription-url">{t('service_url')}</label>
                <input
                  id="subscription-url"
                  type="url"
                  inputMode="url"
                  placeholder={t('service_url_placeholder')}
                  value={String(formData.url || '')}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>
              <div className="editor-field">
                <label htmlFor="subscription-notes">{t('notes')}</label>
                <textarea
                  id="subscription-notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
          </details>
        </form>
        <footer className="editor-footer">
          {submitError && (
            <p role="alert" className="field-error">
              {submitError}
            </p>
          )}
          <div>
            <button
              type="button"
              className="secondary-action"
              disabled={isSubmitting}
              onClick={closeAndDiscardUploads}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              form="subscription-editor"
              disabled={isIconUploading || isSubmitting}
              className="primary-action"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {isSubmitting ? t('saving') : initialData ? t('save') : t('add_new')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SubscriptionForm;
