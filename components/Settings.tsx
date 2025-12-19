import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import * as QRCode from 'qrcode';

import { AppSettings, ISO_CURRENCIES, NotificationChannel } from '../types';
import { getT } from '../services/i18n';
import { canonicalCategoryKey, canonicalPaymentMethodKey } from '../services/displayLabels';
import { getTodayLocalYMD } from '../services/dateUtils';
import { apiFetchJson, authJsonHeaders } from '../services/apiClient';
import { normalizeReminderTemplateString, renderReminderTemplate } from '../shared/reminderTemplate.js';

import ApiTab from './settings/tabs/ApiTab';
import CurrencyTab from './settings/tabs/CurrencyTab';
import GeneralTab from './settings/tabs/GeneralTab';
import NotificationsTab from './settings/tabs/NotificationsTab';
import SecurityTab from './settings/tabs/SecurityTab';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 bg-green-600 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in z-50">
      <CheckCircle size={20} />
      <span className="font-medium">{message}</span>
    </div>
  );
};

const Settings: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'api' | 'currency' | 'notifications' | 'security'>('general');

  const [newCategory, setNewCategory] = useState('');
  const [newPayment, setNewPayment] = useState('');
  const [currencySearch, setCurrencySearch] = useState('');
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [isUpdatingRates, setIsUpdatingRates] = useState(false);
  const [exchangeApiKey, setExchangeApiKey] = useState('');
  const [isSavingExchangeApi, setIsSavingExchangeApi] = useState(false);

  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showQr, setShowQr] = useState(false);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaQrUrl, setTwoFaQrUrl] = useState<string | null>(null);
  const [is2faBusy, setIs2faBusy] = useState(false);
  const [is2faVerifying, setIs2faVerifying] = useState(false);

  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [templateText, setTemplateText] = useState(settings.notifications.rules.template);

  const [dragCatIndex, setDragCatIndex] = useState<number | null>(null);
  const [dragPayIndex, setDragPayIndex] = useState<number | null>(null);

  useEffect(() => {
    setTemplateText(settings.notifications.rules.template);
  }, [settings.notifications.rules.template]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!settings.security.pendingTwoFactorSecret) {
        setTwoFaQrUrl(null);
        setShowQr(false);
        return;
      }

      const otpauth = `otpauth://totp/Subm?secret=${settings.security.pendingTwoFactorSecret}&issuer=Subm`;
      setShowQr(true);
      try {
        const dataUrl = await QRCode.toDataURL(otpauth, { width: 200, margin: 1 });
        if (!cancelled) setTwoFaQrUrl(dataUrl);
      } catch {
        if (!cancelled) setTwoFaQrUrl(null);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [settings.security.pendingTwoFactorSecret]);

  const t = getT(settings.language);
  const currentLanguage = settings.language || 'en';

  const isTwoFactorActive = settings.security.twoFactorEnabled;
  const isTwoFactorPending = !!settings.security.pendingTwoFactorSecret;
  const categories = settings.customCategories || [];
  const payments = settings.customPaymentMethods || [];

  const handleAddCategory = () => {
    const canon = canonicalCategoryKey(newCategory);
    const exists = settings.customCategories.some(
      (c) => canonicalCategoryKey(c).toLowerCase() === canon.toLowerCase()
    );
    if (canon && !exists) {
      onUpdateSettings({ ...settings, customCategories: [...settings.customCategories, canon] });
      setNewCategory('');
    }
  };

  const handleAddPayment = () => {
    const canon = canonicalPaymentMethodKey(newPayment);
    const exists = settings.customPaymentMethods.some(
      (p) => canonicalPaymentMethodKey(p).toLowerCase() === canon.toLowerCase()
    );
    if (canon && !exists) {
      onUpdateSettings({ ...settings, customPaymentMethods: [...settings.customPaymentMethods, canon] });
      setNewPayment('');
    }
  };

  const assertTemplateValid = (raw: string) => {
    const parsed = JSON.parse(raw || '');
    if (!parsed?.lines || !Array.isArray(parsed.lines) || parsed.lines.length === 0) {
      throw new Error('invalid_template');
    }
    return parsed;
  };

  const reorderList = (list: string[], from: number, to: number) => {
    const arr = [...list];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    return arr;
  };

  const handleCategoryDragStart = (index: number) => setDragCatIndex(index);
  const handleCategoryDrop = (index: number) => {
    if (dragCatIndex === null || dragCatIndex === index) return;
    const reordered = reorderList(settings.customCategories, dragCatIndex, index);
    onUpdateSettings({ ...settings, customCategories: reordered });
    setDragCatIndex(null);
  };

  const handlePaymentDragStart = (index: number) => setDragPayIndex(index);
  const handlePaymentDrop = (index: number) => {
    if (dragPayIndex === null || dragPayIndex === index) return;
    const reordered = reorderList(settings.customPaymentMethods, dragPayIndex, index);
    onUpdateSettings({ ...settings, customPaymentMethods: reordered });
    setDragPayIndex(null);
  };

  const bufferToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const encryptExchangeApiKey = async (plainKey: string) => {
    const data = await apiFetchJson<any>('/api/exchange-rate/public-key', { headers: authJsonHeaders() });
    if (!data?.jwk) throw new Error('failed_to_get_public_key');
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      data.jwk,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );
    const encrypted = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      new TextEncoder().encode(plainKey)
    );
    return bufferToBase64(encrypted);
  };

  const handleSaveExchangeApiKey = async (alsoTest: boolean) => {
    if (!exchangeApiKey.trim()) return;
    setIsSavingExchangeApi(true);
    try {
      const encryptedKey = await encryptExchangeApiKey(exchangeApiKey.trim());
      const json = await apiFetchJson<any>('/api/exchange-rate/config', {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({ encryptedKey, test: alsoTest }),
      });
      if (json?.ok === false) throw new Error(json?.message || 'save_failed');

      onUpdateSettings({
        ...settings,
        exchangeRateApi: json.settings.exchangeRateApi,
        exchangeRates: json.settings.exchangeRates,
        lastRatesUpdate: json.settings.lastRatesUpdate,
      });
      setExchangeApiKey('');
      setAlertState({
        isOpen: true,
        type: 'success',
        title: t('success_title'),
        message: alsoTest ? t('connection_success') : t('saved'),
      });
    } catch (err: any) {
      setAlertState({
        isOpen: true,
        type: 'error',
        title: t('error_title'),
        message: err?.message || 'save_failed',
      });
    } finally {
      setIsSavingExchangeApi(false);
    }
  };

  const handleManualUpdateRates = async () => {
    setIsUpdatingRates(true);
    try {
      const json = await apiFetchJson<any>('/api/exchange-rate/update', {
        method: 'POST',
        headers: authJsonHeaders(),
      });
      if (json?.ok === false) throw new Error(json?.message || 'update_failed');
      onUpdateSettings({
        ...settings,
        exchangeRateApi: json.settings.exchangeRateApi,
        exchangeRates: json.settings.exchangeRates,
        lastRatesUpdate: json.settings.lastRatesUpdate,
      });
      setAlertState({
        isOpen: true,
        type: 'success',
        title: t('success_title'),
        message: t('rates_updated'),
      });
    } catch (err: any) {
      setAlertState({
        isOpen: true,
        type: 'error',
        title: t('error_title'),
        message: err?.message || 'update_failed',
      });
    } finally {
      setIsUpdatingRates(false);
    }
  };

  const filteredCurrencies = ISO_CURRENCIES.filter(
    (c) =>
      (c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
        c.name.toLowerCase().includes(currencySearch.toLowerCase())) &&
      !settings.customCurrencies.some((existing) => existing.code === c.code)
  );

  const buildTestReminderMessage = () => {
    const today = getTodayLocalYMD();
    const normalized = normalizeReminderTemplateString(templateText);
    return renderReminderTemplate(normalized, {
      name: '测试订阅',
      nextBillingDate: today,
      price: '0.00',
      currency: '',
      paymentMethod: '测试支付方式',
    });
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    try {
      assertTemplateValid(templateText);
      await apiFetchJson<any>('/api/notifications/test-telegram', {
        method: 'POST',
        headers: authJsonHeaders(),
      });
      setAlertState({
        isOpen: true,
        type: 'success',
        title: t('success_title'),
        message: 'Message sent successfully! Check your Telegram.',
      });
    } catch (error: any) {
      console.error('Telegram Test Error:', error);
      setAlertState({
        isOpen: true,
        type: 'error',
        title: t('error_title'),
        message:
          error?.message === 'telegram_not_configured'
            ? 'Please enable Telegram notifications and fill Bot Token + Chat ID first.'
            : error?.message === 'invalid_template'
              ? '模板格式错误，请输入包含 lines 数组的 JSON。'
              : error?.message || 'Telegram test failed. Check your settings.',
      });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleUpdatePassword = async () => {
    const { current, new: newPass, confirm } = passwords;

    if (!current || !newPass || !confirm) {
      setAlertState({ isOpen: true, type: 'error', title: t('error_title'), message: t('password_error_empty') });
      return;
    }
    if (newPass !== confirm) {
      setAlertState({
        isOpen: true,
        type: 'error',
        title: t('error_title'),
        message: t('password_error_mismatch'),
      });
      return;
    }

    try {
      await apiFetchJson<any>('/api/change-password', {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({ currentPassword: current, newPassword: newPass }),
      });

      setPasswords({ current: '', new: '', confirm: '' });
      onUpdateSettings({
        ...settings,
        security: {
          ...settings.security,
          lastPasswordChange: new Date().toISOString(),
        },
      });
      setAlertState({
        isOpen: true,
        type: 'success',
        title: t('success_title'),
        message: t('password_success'),
      });
    } catch (error: any) {
      console.error('Password update failed', error);
      setAlertState({
        isOpen: true,
        type: 'error',
        title: t('error_title'),
        message: error?.message || t('connection_failed') || 'Network error',
      });
    }
  };

  const startTwoFactor = async () => {
    setIs2faBusy(true);
    try {
      const data = await apiFetchJson<any>('/api/2fa/init', { method: 'POST', headers: authJsonHeaders() });
      onUpdateSettings({
        ...settings,
        security: {
          ...settings.security,
          twoFactorEnabled: false,
          pendingTwoFactorSecret: data.secret,
          twoFactorSecret: settings.security.twoFactorSecret || '',
        },
      });
    } catch (error: any) {
      console.error('2FA init failed', error);
      setAlertState({
        isOpen: true,
        type: 'error',
        title: t('error_title'),
        message: error?.message || t('connection_failed') || 'Network error',
      });
    } finally {
      setIs2faBusy(false);
    }
  };

  const verifyTwoFactor = async () => {
    if (!twoFaCode) {
      setAlertState({ isOpen: true, type: 'error', title: t('error_title'), message: t('password_error_empty') });
      return;
    }

    setIs2faVerifying(true);
    try {
      await apiFetchJson<any>('/api/2fa/verify', {
        method: 'POST',
        headers: authJsonHeaders(),
        body: JSON.stringify({ code: twoFaCode }),
      });
      const confirmedSecret =
        settings.security.pendingTwoFactorSecret || settings.security.twoFactorSecret || '';
      setTwoFaCode('');
      setTwoFaQrUrl(null);
      setShowQr(false);
      onUpdateSettings({
        ...settings,
        security: {
          ...settings.security,
          twoFactorEnabled: true,
          twoFactorSecret: confirmedSecret,
          pendingTwoFactorSecret: '',
        },
      });
      setToastMessage(t('success_title'));
    } catch (error: any) {
      console.error('2FA verify failed', error);
      setAlertState({
        isOpen: true,
        type: 'error',
        title: t('error_title'),
        message: error?.message || t('connection_failed') || 'Network error',
      });
    } finally {
      setIs2faVerifying(false);
    }
  };

  const disableTwoFactor = async () => {
    setIs2faBusy(true);
    try {
      await apiFetchJson<any>('/api/2fa/disable', { method: 'POST', headers: authJsonHeaders() });
      setTwoFaCode('');
      setTwoFaQrUrl(null);
      setShowQr(false);
      onUpdateSettings({
        ...settings,
        security: {
          ...settings.security,
          twoFactorEnabled: false,
          twoFactorSecret: '',
          pendingTwoFactorSecret: '',
        },
      });
      setToastMessage(t('success_title'));
    } catch (error: any) {
      console.error('2FA disable failed', error);
      setAlertState({
        isOpen: true,
        type: 'error',
        title: t('error_title'),
        message: error?.message || t('connection_failed') || 'Network error',
      });
    } finally {
      setIs2faBusy(false);
    }
  };

  const toggleReminderChannel = (channel: NotificationChannel, checked: boolean) => {
    const baseChannels = settings.notifications.rules.channels || { renewalReminder: [] };
    const current = baseChannels.renewalReminder || [];
    const next = checked ? Array.from(new Set([...current, channel])) : current.filter((c) => c !== channel);
    onUpdateSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        rules: {
          ...settings.notifications.rules,
          channels: {
            ...baseChannels,
            renewalReminder: next,
          },
        },
      },
    });
  };

  const handleSaveTemplate = () => {
    try {
      assertTemplateValid(templateText);
      const normalized = normalizeReminderTemplateString(templateText);
      onUpdateSettings({
        ...settings,
        notifications: {
          ...settings.notifications,
          rules: { ...settings.notifications.rules, template: normalized },
        },
      });
      setTemplateText(normalized);
      setAlertState({ isOpen: true, type: 'success', title: t('success_title'), message: '模板已保存' });
    } catch {
      setAlertState({
        isOpen: true,
        type: 'error',
        title: t('error_title'),
        message: '模板格式错误，请输入包含 lines 数组的 JSON。',
      });
    }
  };

  const handleTestTemplate = () => {
    void buildTestReminderMessage();
    handleTestTelegram();
  };

  const handleToggleTwoFactor = (enabled: boolean) => {
    if (enabled) startTwoFactor();
    else disableTwoFactor();
  };

  const formatLastUpdated = (timestamp: number) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="mac-surface rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[600px] overflow-hidden relative">
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

      <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
        {(['general', 'api', 'currency', 'notifications', 'security'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-4 text-sm font-medium capitalize whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50 dark:bg-slate-700'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t(tab as any)}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === 'general' && (
          <GeneralTab
            t={t}
            currentLanguage={currentLanguage}
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            newCategory={newCategory}
            setNewCategory={setNewCategory}
            newPayment={newPayment}
            setNewPayment={setNewPayment}
            categories={categories}
            payments={payments}
            dragCatIndex={dragCatIndex}
            setDragCatIndex={setDragCatIndex}
            dragPayIndex={dragPayIndex}
            setDragPayIndex={setDragPayIndex}
            handleAddCategory={handleAddCategory}
            handleAddPayment={handleAddPayment}
            handleCategoryDragStart={handleCategoryDragStart}
            handleCategoryDrop={handleCategoryDrop}
            handlePaymentDragStart={handlePaymentDragStart}
            handlePaymentDrop={handlePaymentDrop}
          />
        )}

        {activeTab === 'api' && (
          <ApiTab
            t={t}
            currentLanguage={currentLanguage}
            settings={settings}
            exchangeApiKey={exchangeApiKey}
            setExchangeApiKey={setExchangeApiKey}
            isSavingExchangeApi={isSavingExchangeApi}
            handleSaveExchangeApiKey={handleSaveExchangeApiKey}
          />
        )}

        {activeTab === 'currency' && (
          <CurrencyTab
            t={t}
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            currencySearch={currencySearch}
            setCurrencySearch={setCurrencySearch}
            showCurrencyDropdown={showCurrencyDropdown}
            setShowCurrencyDropdown={setShowCurrencyDropdown}
            filteredCurrencies={filteredCurrencies}
            isUpdatingRates={isUpdatingRates}
            handleManualUpdateRates={handleManualUpdateRates}
            formatLastUpdated={formatLastUpdated}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsTab
            t={t}
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            templateText={templateText}
            setTemplateText={setTemplateText}
            handleSaveTemplate={handleSaveTemplate}
            handleTestTemplate={handleTestTemplate}
            isTestingTelegram={isTestingTelegram}
            handleTestTelegram={handleTestTelegram}
            toggleReminderChannel={toggleReminderChannel}
          />
        )}

        {activeTab === 'security' && (
          <SecurityTab
            t={t}
            settings={settings}
            passwords={passwords}
            setPasswords={setPasswords}
            handleUpdatePassword={handleUpdatePassword}
            isTwoFactorActive={isTwoFactorActive}
            isTwoFactorPending={isTwoFactorPending}
            showQr={showQr}
            twoFaQrUrl={twoFaQrUrl}
            twoFaCode={twoFaCode}
            setTwoFaCode={setTwoFaCode}
            is2faBusy={is2faBusy}
            is2faVerifying={is2faVerifying}
            handleToggleTwoFactor={handleToggleTwoFactor}
            verifyTwoFactor={verifyTwoFactor}
          />
        )}
      </div>

      {alertState && alertState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-fade-in">
          <div className="mac-surface rounded-2xl shadow-xl max-w-sm w-full p-6 border border-gray-100 dark:border-gray-700 transform scale-100 transition-all animate-pop-in">
            <div className="flex flex-col items-center text-center space-y-4">
              <div
                className={`p-3 rounded-full ${
                  alertState.type === 'success'
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {alertState.type === 'success' ? <CheckCircle size={32} /> : <AlertTriangle size={32} />}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{alertState.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">{alertState.message}</p>
              </div>
              <button
                onClick={() => setAlertState(null)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-white font-medium rounded-xl transition-colors"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;

