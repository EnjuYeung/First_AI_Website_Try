
import React, { useState, useEffect } from 'react';
import { AppSettings, COMMON_TIMEZONES, ISO_CURRENCIES, NotificationChannel } from '../types';
import { getT } from '../services/i18n';
import { Plus, Moon, Sun, Monitor, RefreshCw, Send, Loader2, Globe, Clock, Search, CheckCircle, X as XIcon, AlertTriangle, Save, Mail } from 'lucide-react';

interface Props {
    settings: AppSettings;
    onUpdateSettings: (settings: AppSettings) => void;
}

const Toast: React.FC<{ message: string, onClose: () => void }> = ({ message, onClose }) => {
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

  // Security State
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showQr, setShowQr] = useState(false);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaQrUrl, setTwoFaQrUrl] = useState<string | null>(null);
  const [is2faBusy, setIs2faBusy] = useState(false);
  const [is2faVerifying, setIs2faVerifying] = useState(false);

  // Alert Modal State
  const [alertState, setAlertState] = useState<{ isOpen: boolean; type: 'success' | 'error'; title: string; message: string } | null>(null);
  
  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Notification State
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [templateText, setTemplateText] = useState(settings.notifications.rules.template);

  // Drag-and-drop state
  const [dragCatIndex, setDragCatIndex] = useState<number | null>(null);
  const [dragPayIndex, setDragPayIndex] = useState<number | null>(null);

  useEffect(() => {
      setTemplateText(settings.notifications.rules.template);
  }, [settings.notifications.rules.template]);

  useEffect(() => {
      if (settings.security.pendingTwoFactorSecret) {
          const otpauth = `otpauth://totp/Subm?secret=${settings.security.pendingTwoFactorSecret}&issuer=Subm`;
          setTwoFaQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauth)}`);
          setShowQr(true);
      } else {
          setTwoFaQrUrl(null);
          setShowQr(false);
      }
  }, [settings.security.pendingTwoFactorSecret]);

  const t = getT(settings.language);
  const currentLanguage = settings.language || 'en';
  const isTwoFactorActive = settings.security.twoFactorEnabled;
  const isTwoFactorPending = !!settings.security.pendingTwoFactorSecret;
  const categories = settings.customCategories || [];
  const payments = settings.customPaymentMethods || [];

  // General Handlers
  const handleAddCategory = () => {
    if (newCategory && !settings.customCategories.includes(newCategory)) {
      onUpdateSettings({ ...settings, customCategories: [...settings.customCategories, newCategory] });
      setNewCategory('');
    }
  };

  const handleAddPayment = () => {
    if (newPayment && !settings.customPaymentMethods.includes(newPayment)) {
        onUpdateSettings({...settings, customPaymentMethods: [...settings.customPaymentMethods, newPayment]});
        setNewPayment('');
    }
  };

  // Template helpers
  const parseTemplate = () => {
    const parsed = JSON.parse(templateText || '{}');
    if (!parsed.lines || !Array.isArray(parsed.lines) || parsed.lines.length === 0) {
      throw new Error('invalid_template');
    }
    return parsed;
  };

  const renderTemplateMessage = (sub: { name: string; nextBillingDate: string; price: number | string; currency: string; paymentMethod: string; }) => {
    const parsed = parseTemplate();
    const map: Record<string, string | number> = {
      name: sub.name || '未填写',
      nextBillingDate: sub.nextBillingDate || '未填写',
      price: sub.price ?? '',
      currency: sub.currency || '',
      paymentMethod: sub.paymentMethod || '未填写'
    };
    const replaceTokens = (line: string) =>
      typeof line === 'string'
        ? line
            .replace(/{{\s*name\s*}}/g, String(map.name))
            .replace(/{{\s*nextBillingDate\s*}}/g, String(map.nextBillingDate))
            .replace(/{{\s*price\s*}}/g, String(map.price))
            .replace(/{{\s*currency\s*}}/g, String(map.currency))
            .replace(/{{\s*paymentMethod\s*}}/g, String(map.paymentMethod))
        : '';
    return parsed.lines.map(replaceTokens).join('\n');
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

  const authHeader = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
  });

  const bufferToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const encryptExchangeApiKey = async (plainKey: string) => {
    const resp = await fetch('/api/exchange-rate/public-key', { headers: authHeader() });
    const data = await resp.json();
    if (!resp.ok || !data?.jwk) throw new Error('failed_to_get_public_key');
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
      const resp = await fetch('/api/exchange-rate/config', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ encryptedKey, test: alsoTest })
      });
      const json = await resp.json();
      if (!resp.ok || json?.ok === false) throw new Error(json?.message || 'save_failed');

      onUpdateSettings({
        ...settings,
        exchangeRateApi: json.settings.exchangeRateApi,
        exchangeRates: json.settings.exchangeRates,
        lastRatesUpdate: json.settings.lastRatesUpdate
      });
      setExchangeApiKey('');
      setAlertState({
        isOpen: true,
        type: 'success',
        title: t('success_title'),
        message: alsoTest ? t('connection_success') : t('saved')
      });
    } catch (err: any) {
      setAlertState({
        isOpen: true,
        type: 'error',
        title: t('error_title'),
        message: err?.message || 'save_failed'
      });
    } finally {
      setIsSavingExchangeApi(false);
    }
  };

  const handleManualUpdateRates = async () => {
    setIsUpdatingRates(true);
    try {
      const resp = await fetch('/api/exchange-rate/update', {
        method: 'POST',
        headers: authHeader()
      });
      const json = await resp.json();
      if (!resp.ok || json?.ok === false) throw new Error(json?.message || 'update_failed');
      onUpdateSettings({
        ...settings,
        exchangeRateApi: json.settings.exchangeRateApi,
        exchangeRates: json.settings.exchangeRates,
        lastRatesUpdate: json.settings.lastRatesUpdate
      });
      setAlertState({
        isOpen: true,
        type: 'success',
        title: t('success_title'),
        message: t('rates_updated')
      });
    } catch (err: any) {
      setAlertState({
        isOpen: true,
        type: 'error',
        title: t('error_title'),
        message: err?.message || 'update_failed'
      });
    } finally {
      setIsUpdatingRates(false);
    }
  };

  const filteredCurrencies = ISO_CURRENCIES.filter(c => 
    (c.code.toLowerCase().includes(currencySearch.toLowerCase()) || 
     c.name.toLowerCase().includes(currencySearch.toLowerCase())) &&
    !settings.customCurrencies.some(existing => existing.code === c.code)
  );

  const buildTestReminderMessage = () => {
    const today = new Date().toISOString().slice(0, 10);
    return renderTemplateMessage({
      name: '测试订阅',
      nextBillingDate: today,
      price: '0.00',
      currency: '',
      paymentMethod: '测试支付方式'
    });
  };

  // Notification Handlers
  const handleTestTelegram = async () => {
    const { botToken, chatId } = settings.notifications.telegram;
    
    if (!botToken || !chatId) {
        setAlertState({
            isOpen: true,
            type: 'error',
            title: t('error_title'),
            message: "Please enter both Bot Token and Chat ID to test."
        });
        return;
    }

    let message: string;
    try {
        message = buildTestReminderMessage();
    } catch (err) {
        setAlertState({
            isOpen: true,
            type: 'error',
            title: t('error_title'),
            message: "模板格式错误，请输入包含 lines 数组的 JSON。"
        });
        return;
    }

    setIsTestingTelegram(true);
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message
            })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            setAlertState({
                isOpen: true,
                type: 'success',
                title: t('success_title'),
                message: "Message sent successfully! Check your Telegram."
            });
        } else {
             setAlertState({
                isOpen: true,
                type: 'error',
                title: t('error_title'),
                message: `Error from Telegram: ${data.description}`
            });
        }
    } catch (error) {
        console.error("Telegram Test Error:", error);
         setAlertState({
            isOpen: true,
            type: 'error',
            title: t('error_title'),
            message: "Failed to connect to Telegram API. Check your network or token."
        });
    } finally {
        setIsTestingTelegram(false);
    }
  };

  const handleUpdatePassword = async () => {
    const { current, new: newPass, confirm } = passwords;
    
    if (!current || !newPass || !confirm) {
        setAlertState({
            isOpen: true,
            type: 'error',
            title: t('error_title'),
            message: t('password_error_empty')
        });
        return;
    }

    if (newPass !== confirm) {
         setAlertState({
            isOpen: true,
            type: 'error',
            title: t('error_title'),
            message: t('password_error_mismatch')
        });
        return;
    }

    try {
        const resp = await fetch('/api/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
            },
            body: JSON.stringify({ currentPassword: current, newPassword: newPass })
        });

        if (!resp.ok) {
            setAlertState({
                isOpen: true,
                type: 'error',
                title: t('error_title'),
                message: t('invalid_credentials')
            });
            return;
        }

        setPasswords({ current: '', new: '', confirm: '' });
        onUpdateSettings({
            ...settings,
            security: {
                ...settings.security,
                lastPasswordChange: new Date().toISOString()
            }
        });

        setAlertState({
            isOpen: true,
            type: 'success',
            title: t('success_title'),
            message: t('password_success')
        });
    } catch (error) {
        console.error('Password update failed', error);
        setAlertState({
            isOpen: true,
            type: 'error',
            title: t('error_title'),
            message: t('connection_failed') || 'Network error'
        });
    }
  };

  const startTwoFactor = async () => {
    setIs2faBusy(true);
    try {
        const resp = await fetch('/api/2fa/init', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
            }
        });

        if (!resp.ok) {
            setAlertState({
                isOpen: true,
                type: 'error',
                title: t('error_title'),
                message: t('connection_failed') || 'Init failed'
            });
            return;
        }

        const data = await resp.json();
        const otpauth = data.otpauthUrl || `otpauth://totp/Subm?secret=${data.secret}&issuer=Subm`;
        setTwoFaQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauth)}`);
        setShowQr(true);
        onUpdateSettings({
            ...settings,
            security: {
                ...settings.security,
                twoFactorEnabled: false,
                pendingTwoFactorSecret: data.secret,
                twoFactorSecret: settings.security.twoFactorSecret || ''
            }
        });
    } catch (error) {
        console.error('2FA init failed', error);
        setAlertState({
            isOpen: true,
            type: 'error',
            title: t('error_title'),
            message: t('connection_failed') || 'Network error'
        });
    } finally {
        setIs2faBusy(false);
    }
  };

  const verifyTwoFactor = async () => {
    if (!twoFaCode) {
        setAlertState({
            isOpen: true,
            type: 'error',
            title: t('error_title'),
            message: t('password_error_empty')
        });
        return;
    }

    setIs2faVerifying(true);
    try {
        const resp = await fetch('/api/2fa/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
            },
            body: JSON.stringify({ code: twoFaCode })
        });

        if (!resp.ok) {
            setAlertState({
                isOpen: true,
                type: 'error',
                title: t('error_title'),
                message: t('invalid_credentials')
            });
            return;
        }

        const data = await resp.json();
        setTwoFaCode('');
        setTwoFaQrUrl(null);
        setShowQr(false);
        onUpdateSettings({
            ...settings,
            security: {
                ...settings.security,
                twoFactorEnabled: true,
                twoFactorSecret: data.secret || settings.security.twoFactorSecret || '',
                pendingTwoFactorSecret: ''
            }
        });
        setToastMessage(t('success_title'));
    } catch (error) {
        console.error('2FA verify failed', error);
        setAlertState({
            isOpen: true,
            type: 'error',
            title: t('error_title'),
            message: t('connection_failed') || 'Network error'
        });
    } finally {
        setIs2faVerifying(false);
    }
  };

  const disableTwoFactor = async () => {
    setIs2faBusy(true);
    try {
        const resp = await fetch('/api/2fa/disable', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
            }
        });
        if (!resp.ok) {
            setAlertState({
                isOpen: true,
                type: 'error',
                title: t('error_title'),
                message: t('connection_failed') || 'Network error'
            });
            return;
        }

        setTwoFaCode('');
        setTwoFaQrUrl(null);
        setShowQr(false);
        onUpdateSettings({
            ...settings,
            security: {
                ...settings.security,
                twoFactorEnabled: false,
                twoFactorSecret: '',
                pendingTwoFactorSecret: ''
            }
        });
        setToastMessage(t('success_title'));
    } catch (error) {
        console.error('2FA disable failed', error);
        setAlertState({
            isOpen: true,
            type: 'error',
            title: t('error_title'),
            message: t('connection_failed') || 'Network error'
        });
    } finally {
    setIs2faBusy(false);
  }
  };

  const toggleReminderChannel = (channel: NotificationChannel, checked: boolean) => {
    const baseChannels = settings.notifications.rules.channels || { renewalReminder: [] };
    const current = baseChannels.renewalReminder || [];
    const next = checked ? Array.from(new Set([...current, channel])) : current.filter(c => c !== channel);
    onUpdateSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        rules: {
          ...settings.notifications.rules,
          channels: {
            ...baseChannels,
            renewalReminder: next
          }
        }
      }
    });
  };

  const handleSaveTemplate = () => {
    try {
      parseTemplate();
      onUpdateSettings({
        ...settings,
        notifications: {
          ...settings.notifications,
          rules: { ...settings.notifications.rules, template: templateText }
        }
      });
      setAlertState({
        isOpen: true,
        type: 'success',
        title: t('success_title'),
        message: '模板已保存'
      });
    } catch (err) {
      setAlertState({
        isOpen: true,
        type: 'error',
        title: t('error_title'),
        message: "模板格式错误，请输入包含 lines 数组的 JSON。"
      });
    }
  };

  const handleTestTemplate = () => {
    handleTestTelegram();
  };

  const handleToggleTwoFactor = (enabled: boolean) => {
    if (enabled) {
        startTwoFactor();
    } else {
        disableTwoFactor();
    }
  };

  const formatLastUpdated = (timestamp: number) => {
      if (!timestamp) return 'Never';
      return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[600px] overflow-hidden relative">
      {/* Toast */}
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
        {['general', 'api', 'currency', 'notifications', 'security'].map((tab) => (
            <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
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
        
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
            <div className="space-y-8 max-w-2xl">
                {/* Language */}
                 <section>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('language')}</h3>
                    <div className="flex space-x-4">
                        <button
                            onClick={() => onUpdateSettings({ ...settings, language: 'zh' })}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
                                settings.language === 'zh'
                                ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-white' 
                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                            }`}
                        >
                            <Globe size={16} />
                            <span>简体中文</span>
                        </button>
                        <button
                            onClick={() => onUpdateSettings({ ...settings, language: 'en' })}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
                                settings.language === 'en'
                                ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-white' 
                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                            }`}
                        >
                            <Globe size={16} />
                            <span>English</span>
                        </button>
                    </div>
                </section>

                {/* Timezone */}
                <section>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('timezone')}</h3>
                    <div className="flex items-center space-x-2 max-w-xs">
                         <Clock className="text-gray-500" size={20} />
                         <select 
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg outline-none"
                            value={settings.timezone}
                            onChange={(e) => onUpdateSettings({ ...settings, timezone: e.target.value })}
                        >
                            {COMMON_TIMEZONES.map(tz => (
                                <option key={tz} value={tz}>{tz}</option>
                            ))}
                            {!COMMON_TIMEZONES.includes(settings.timezone) && (
                                <option value={settings.timezone}>{settings.timezone}</option>
                            )}
                        </select>
                    </div>
                </section>


                {/* Theme */}
                <section>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('appearance')}</h3>
                    <div className="flex space-x-4">
                        {(['light', 'dark', 'system'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => onUpdateSettings({ ...settings, theme: mode })}
                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
                                    settings.theme === mode 
                                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-white' 
                                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                                }`}
                            >
                                {mode === 'light' && <Sun size={16} />}
                                {mode === 'dark' && <Moon size={16} />}
                                {mode === 'system' && <Monitor size={16} />}
                                <span className="capitalize">
                                  {mode === 'light' && t('theme_light')}
                                  {mode === 'dark' && t('theme_dark')}
                                  {mode === 'system' && t('theme_system')}
                                </span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Categories */}
                <section>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('categories')}</h3>
                    <div className="flex gap-2 mb-3">
                        <input 
                            type="text" 
                            placeholder="Add new category" 
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                            value={newCategory}
                            onChange={e => setNewCategory(e.target.value)}
                        />
                        <button onClick={handleAddCategory} className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus size={20}/></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {categories.map((cat, idx) => (
                            <span
                                key={cat}
                                draggable
                                onDragStart={() => handleCategoryDragStart(idx)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handleCategoryDrop(idx)}
                                onDragEnd={() => setDragCatIndex(null)}
                                className={`px-3 py-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 rounded-full text-sm flex items-center gap-2 cursor-move select-none ${
                                    dragCatIndex === idx ? 'ring-2 ring-primary-400' : ''
                                }`}
                                title={currentLanguage === 'zh' ? '拖动调整顺序' : 'Drag to reorder'}
                            >
                                {cat}
                                <button onClick={() => onUpdateSettings({...settings, customCategories: categories.filter(c => c !== cat)})} className="text-gray-400 hover:text-red-500"><XIcon size={12}/></button>
                            </span>
                        ))}
                    </div>
                </section>

                {/* Payment Methods */}
                <section>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('payment_methods')}</h3>
                    <div className="flex gap-2 mb-3">
                        <input 
                            type="text" 
                            placeholder="Add payment method" 
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                            value={newPayment}
                            onChange={e => setNewPayment(e.target.value)}
                        />
                        <button onClick={handleAddPayment} className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus size={20}/></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {payments.map((pm, idx) => (
                            <span
                                key={pm}
                                draggable
                                onDragStart={() => handlePaymentDragStart(idx)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handlePaymentDrop(idx)}
                                onDragEnd={() => setDragPayIndex(null)}
                                className={`px-3 py-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 rounded-full text-sm flex items-center gap-2 cursor-move select-none ${
                                    dragPayIndex === idx ? 'ring-2 ring-primary-400' : ''
                                }`}
                                title={currentLanguage === 'zh' ? '拖动调整顺序' : 'Drag to reorder'}
                            >
                                {pm}
                                <button onClick={() => onUpdateSettings({...settings, customPaymentMethods: payments.filter(p => p !== pm)})} className="text-gray-400 hover:text-red-500"><XIcon size={12}/></button>
                            </span>
                        ))}
                    </div>
                </section>
            </div>
        )}

        {/* API TAB */}
        {activeTab === 'api' && (
          <div className="space-y-6 max-w-2xl">
            <section>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">ExchangeRate-API</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                URL: https://v6.exchangerate-api.com/v6/YOUR-API-KEY/latest/USD
              </p>
            </section>

            <section className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl space-y-3">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('api_key')}</label>
              <input
                type="password"
                placeholder="YOUR-API-KEY"
                value={exchangeApiKey}
                onChange={(e) => setExchangeApiKey(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveExchangeApiKey(false)}
                  disabled={isSavingExchangeApi || !exchangeApiKey.trim()}
                  className="px-4 py-2 bg-gray-100 dark:bg-slate-600 dark:text-white rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save size={16} />
                  <span>{t('save')}</span>
                </button>
                <button
                  onClick={() => handleSaveExchangeApiKey(true)}
                  disabled={isSavingExchangeApi || !exchangeApiKey.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingExchangeApi ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  <span>{t('save_and_test')}</span>
                </button>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <div>已启用：{settings.exchangeRateApi?.enabled ? '是' : '否'}</div>
                <div>上次测试：{settings.exchangeRateApi?.lastTestedAt ? new Date(settings.exchangeRateApi.lastTestedAt).toLocaleString(currentLanguage === 'zh' ? 'zh-CN' : 'en-US') : '-'}</div>
                <div>上次自动(0时)：{settings.exchangeRateApi?.lastRunAt0 ? new Date(settings.exchangeRateApi.lastRunAt0).toLocaleString(currentLanguage === 'zh' ? 'zh-CN' : 'en-US') : '-'}</div>
                <div>上次自动(12时)：{settings.exchangeRateApi?.lastRunAt12 ? new Date(settings.exchangeRateApi.lastRunAt12).toLocaleString(currentLanguage === 'zh' ? 'zh-CN' : 'en-US') : '-'}</div>
              </div>
            </section>
          </div>
        )}

        {/* CURRENCY TAB */}
        {activeTab === 'currency' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                
                {/* Left Col: Real-time Rates */}
                <div className="xl:col-span-5 space-y-6">
                     <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-5 border border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-center mb-4">
                             <div className="flex items-center gap-2">
                                <RefreshCw size={18} className="text-blue-500"/>
                                <h3 className="font-bold text-gray-800 dark:text-white text-sm">{t('realtime_rates')} ({t('base_usd')})</h3>
                            </div>
                            <button
                                onClick={handleManualUpdateRates}
                                disabled={isUpdatingRates}
                                className="p-2 bg-white dark:bg-slate-600 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-slate-500 rounded-lg transition-all shadow-sm disabled:opacity-50"
                                title={t('refresh_rates')}
                            >
                                <RefreshCw size={16} className={isUpdatingRates ? "animate-spin text-primary-600" : ""} />
                            </button>
                        </div>
                        
                        <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto pr-1">
                            {settings.customCurrencies.filter(c => c.code !== 'USD').map(c => (
                                <div key={c.code} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-gray-600">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-800 dark:text-white">{c.code}</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">{c.name}</span>
                                    </div>
                                    <span className="text-lg font-mono font-medium text-gray-700 dark:text-gray-200">
                                        {settings.exchangeRates[c.code]?.toFixed(4) || '-.--'}
                                    </span>
                                </div>
                            ))}
                            {settings.customCurrencies.filter(c => c.code !== 'USD').length === 0 && (
                                <div className="text-center py-6 text-gray-400 text-sm">
                                    Add currencies to see rates.
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-600 pt-3">
                             <span>{t('last_updated')}: {formatLastUpdated(settings.lastRatesUpdate)}</span>
                        </div>
                     </div>
                </div>

                {/* Right Col: Currency Management */}
                <div className="xl:col-span-7 space-y-6">
                     <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm h-full flex flex-col">
                         <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('manage_currencies')}</h3>
                         
                         {/* Search Add */}
                         <div className="relative mb-6">
                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary-500 transition-all">
                                <Search size={20} className="text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder={t('search_currency')} 
                                    className="flex-1 bg-transparent outline-none dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm" 
                                    value={currencySearch}
                                    onChange={(e) => setCurrencySearch(e.target.value)}
                                    onFocus={() => setShowCurrencyDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowCurrencyDropdown(false), 200)}
                                />
                            </div>
                            
                            {/* Dropdown Results */}
                            {showCurrencyDropdown && currencySearch && (
                                <div className="absolute z-10 w-full mt-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-gray-600 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-fade-in">
                                    {filteredCurrencies.length > 0 ? filteredCurrencies.map(c => (
                                        <button 
                                            key={c.code}
                                            onClick={() => {
                                                onUpdateSettings({...settings, customCurrencies: [...settings.customCurrencies, c]});
                                                setCurrencySearch('');
                                            }}
                                            className="w-full text-left px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-between transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800 dark:text-white text-sm">{c.code}</span>
                                            </div>
                                            <div className="w-6 h-6 bg-primary-50 dark:bg-slate-600 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400">
                                                <Plus size={14} />
                                            </div>
                                        </button>
                                    )) : (
                                        <div className="p-4 text-center text-gray-500 text-sm">No matches found</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Active Currencies Grid */}
                        <div className="flex-1">
                             <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('supported_currencies')} ({settings.customCurrencies.length})</h4>
                             <div className="flex flex-wrap gap-2">
                                {settings.customCurrencies.map(c => (
                                    <div key={c.code} className="group flex items-center gap-2 pl-3 pr-2 py-1.5 bg-gray-50 hover:bg-white dark:bg-slate-700/50 dark:hover:bg-slate-700 border border-gray-200 hover:border-primary-200 dark:border-gray-600 dark:hover:border-primary-500/50 rounded-lg transition-all shadow-sm hover:shadow-md">
                                        <span className="text-sm font-bold text-gray-800 dark:text-white leading-none">{c.code}</span>
                                        {c.code !== 'USD' && (
                                            <button 
                                                onClick={() => onUpdateSettings({...settings, customCurrencies: settings.customCurrencies.filter(cur => cur.code !== c.code)})} 
                                                className="ml-1 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                            >
                                                <XIcon size={14}/>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                     </div>
                </div>
            </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === 'notifications' && (
            <div className="space-y-8 max-w-4xl">
                 {/* Channels */}
                 <section className="space-y-6">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('channels')}</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl h-full">
                          <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                  <Send size={20} className="text-blue-500"/>
                                  <span className="font-semibold dark:text-white">{t('telegram_bot')}</span>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" checked={settings.notifications.telegram.enabled} onChange={e => onUpdateSettings({...settings, notifications: {...settings.notifications, telegram: {...settings.notifications.telegram, enabled: e.target.checked}}})} className="sr-only peer" />
                                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                              </label>
                          </div>
                          {settings.notifications.telegram.enabled && (
                              <div className="space-y-3">
                                  <input 
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="Bot Token"
                                    className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white"
                                    value={settings.notifications.telegram.botToken}
                                    onChange={e => onUpdateSettings({...settings, notifications: {...settings.notifications, telegram: {...settings.notifications.telegram, botToken: e.target.value}}})}
                                  />
                                  <div className="flex gap-2">
                                       <input 
                                         type="password"
                                         autoComplete="new-password"
                                         placeholder="Chat ID"
                                         className="flex-1 px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white"
                                         value={settings.notifications.telegram.chatId}
                                         onChange={e => onUpdateSettings({...settings, notifications: {...settings.notifications, telegram: {...settings.notifications.telegram, chatId: e.target.value}}})}
                                       />
                                       <button 
                                          onClick={handleTestTelegram}
                                          disabled={isTestingTelegram || !settings.notifications.telegram.botToken || !settings.notifications.telegram.chatId}
                                          className="px-4 py-2 bg-gray-100 dark:bg-slate-600 dark:text-white rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
                                       >
                                           {isTestingTelegram ? <Loader2 size={16} className="animate-spin"/> : <Send size={16} />}
                                           <span>Test</span>
                                       </button>
                                  </div>
                              </div>
                          )}
                      </div>

                      <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl h-full">
                          <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                  <Mail size={20} className="text-blue-500"/>
                                  <span className="font-semibold dark:text-white">{t('email')}</span>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" checked={settings.notifications.email.enabled} onChange={e => onUpdateSettings({...settings, notifications: {...settings.notifications, email: {...settings.notifications.email, enabled: e.target.checked}}})} className="sr-only peer" />
                                  <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                              </label>
                          </div>
                          {settings.notifications.email.enabled && (
                               <input placeholder="Email Address" className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white" value={settings.notifications.email.emailAddress} onChange={e => onUpdateSettings({...settings, notifications: {...settings.notifications, email: {...settings.notifications.email, emailAddress: e.target.value}}})} />
                          )}
                      </div>
                    </div>
                 </section>

                 {/* Rules */}
                  <section className="space-y-3">
                     <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('rules')}</h3>
                    <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-800 dark:text-white font-medium">{t('renewal_reminder')}</span>
                        <input 
                          type="checkbox" 
                          checked={settings.notifications.rules.renewalReminder} 
                          onChange={e => onUpdateSettings({...settings, notifications: {...settings.notifications, rules: {...settings.notifications.rules, renewalReminder: e.target.checked}}})}
                          className="w-5 h-5 text-primary-600 rounded"
                        />
                      </div>

                      {settings.notifications.rules.renewalReminder && (
                        <>
                          <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <label className="text-sm text-gray-600 dark:text-gray-400">{t('remind_me')}</label>
                            <input 
                                type="number" min="1" max="30" 
                                className="w-16 px-2 py-1 border rounded dark:bg-slate-900 dark:border-gray-600 dark:text-white text-center"
                                value={settings.notifications.rules.reminderDays}
                                onChange={e => onUpdateSettings({...settings, notifications: {...settings.notifications, rules: {...settings.notifications.rules, reminderDays: parseInt(e.target.value || '0')}}}) }
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-400">{t('days_before')}</span>
                          </div>

                          <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                            {(['telegram','email'] as NotificationChannel[]).map(ch => {
                                const channelEnabled = (settings.notifications as any)[ch]?.enabled;
                                const selected = settings.notifications.rules.channels?.renewalReminder?.includes(ch);
                                return (
                                  <label key={ch} className={`flex items-center gap-2 text-sm ${channelEnabled ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}`}>
                                    <input
                                      type="checkbox"
                                      disabled={!channelEnabled}
                                      checked={!!selected}
                                      onChange={e => toggleReminderChannel(ch, e.target.checked)}
                                      className="w-4 h-4 accent-primary-600"
                                    />
                                    <span>{ch === 'telegram' ? t('telegram_bot') : t('email')}</span>
                                    {!channelEnabled && <span className="text-xs">({t('enable_notifications')})</span>}
                                  </label>
                                );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-800 dark:text-white font-medium">通知模板 (JSON)</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {'使用 lines 数组，支持 {{name}}, {{nextBillingDate}}, {{price}}, {{currency}}, {{paymentMethod}}'}
                          </p>
                        </div>
                      </div>
                      <textarea
                        value={templateText}
                        onChange={e => setTemplateText(e.target.value)}
                        rows={10}
                        className="w-full px-3 py-2 border rounded-lg font-mono text-sm bg-gray-50 dark:bg-slate-800 dark:border-gray-700 dark:text-white"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={handleSaveTemplate}
                          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                        >
                          <Save size={16} /> 保存模板
                        </button>
                        <button
                          onClick={handleTestTemplate}
                          disabled={isTestingTelegram}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white ${isTestingTelegram ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                          {isTestingTelegram ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} 测试模板
                        </button>
                      </div>
                    </div>
                  </section>
            </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
            <div className="space-y-8 max-w-2xl">
                 <section>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('change_password')}</h3>
                    <div className="space-y-4">
                        <input type="password" placeholder={t('current_password')} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white" value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} />
                        <input type="password" placeholder={t('new_password')} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} />
                        <input type="password" placeholder={t('confirm_new_password')} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} />
                        <button onClick={handleUpdatePassword} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{t('update_password')}</button>
                    </div>
                 </section>
                 
                 <section>
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('two_factor')}</h3>
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={isTwoFactorActive || isTwoFactorPending || showQr} 
                                onChange={e => handleToggleTwoFactor(e.target.checked)} 
                                className="sr-only peer" 
                                disabled={is2faBusy || is2faVerifying}
                            />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                         </label>
                     </div>
                     <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        {isTwoFactorActive ? '已开启双重认证' : '未开启双重认证'}
                     </p>
                     {(showQr || isTwoFactorPending || twoFaQrUrl) && (
                         <div className="p-6 bg-gray-50 dark:bg-slate-700 rounded-xl flex flex-col items-center gap-4">
                             <div className="w-48 h-48 bg-white p-2">
                                 {twoFaQrUrl ? (
                                    <img src={twoFaQrUrl} alt="2FA QR" className="w-full h-full object-contain" />
                                 ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">Loading...</div>
                                 )}
                             </div>
                             <p className="text-sm text-gray-600 dark:text-gray-300 text-center">{t('scan_qr')}</p>
                             <div className="flex gap-2 w-full max-w-sm">
                                 <input 
                                    type="text" 
                                    placeholder="Enter 6-digit code" 
                                    className="flex-1 px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-gray-600 dark:text-white" 
                                    value={twoFaCode}
                                    onChange={e => setTwoFaCode(e.target.value)}
                                 />
                                 <button 
                                    onClick={verifyTwoFactor}
                                    disabled={is2faVerifying}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-60"
                                 >
                                    {is2faVerifying ? t('logging_in') : t('verify')}
                                 </button>
                             </div>
                         </div>
                     )}
                 </section>
            </div>
        )}

      </div>

      {/* Alert Modal */}
      {alertState && alertState.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
             <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-sm w-full p-6 border border-gray-100 dark:border-gray-700 transform scale-100 transition-all">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`p-3 rounded-full ${alertState.type === 'success' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
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
