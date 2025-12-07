
import React, { useState } from 'react';
import { AppSettings, ExchangeRates } from '../types';
import { fetchExchangeRates } from '../services/currencyService';
import { translations } from '../services/i18n';
import { Plus, Moon, Sun, Monitor, RefreshCw, Send, Loader2, Globe, Clock } from 'lucide-react';

interface Props {
    settings: AppSettings;
    onUpdateSettings: (settings: AppSettings) => void;
}

const COMMON_TIMEZONES = [
  'UTC',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney'
];

const Settings: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'currency' | 'notifications' | 'security'>('general');
  const [newCategory, setNewCategory] = useState('');
  const [newPayment, setNewPayment] = useState('');
  const [newCurrency, setNewCurrency] = useState({ code: '', name: '' });
  
  // Currency State
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  // Security State
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showQr, setShowQr] = useState(false);

  // Notification State
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);

  const t = (key: keyof typeof translations['en']) => {
    const value = translations[settings.language][key];
    return value !== undefined ? value : key;
  };

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
  }

  // Currency Handlers
  const fetchRates = async () => {
    setIsLoadingRates(true);
    const data = await fetchExchangeRates(settings.currencyApi.provider, settings.currencyApi.apiKey);
    setRates(data);
    setIsLoadingRates(false);
  };

  // Notification Handlers
  const handleTestTelegram = async () => {
    const { botToken, chatId } = settings.notifications.telegram;
    
    if (!botToken || !chatId) {
        alert("Please enter both Bot Token and Chat ID to test.");
        return;
    }

    setIsTestingTelegram(true);
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: "🔔 Subscrybe Test: Your notifications are correctly configured!"
            })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            alert("Message sent successfully! Check your Telegram.");
        } else {
            alert(`Error from Telegram: ${data.description}`);
        }
    } catch (error) {
        console.error("Telegram Test Error:", error);
        alert("Failed to connect to Telegram API. Check your network or token.");
    } finally {
        setIsTestingTelegram(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[600px] overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
        {['general', 'currency', 'notifications', 'security'].map((tab) => (
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
                                <span className="capitalize">{mode}</span>
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
                        {settings.customCategories.map(cat => (
                            <span key={cat} className="px-3 py-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 rounded-full text-sm flex items-center gap-2">
                                {cat}
                                <button onClick={() => onUpdateSettings({...settings, customCategories: settings.customCategories.filter(c => c !== cat)})} className="text-gray-400 hover:text-red-500"><XIcon size={12}/></button>
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
                        {settings.customPaymentMethods.map(pm => (
                            <span key={pm} className="px-3 py-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 rounded-full text-sm flex items-center gap-2">
                                {pm}
                                <button onClick={() => onUpdateSettings({...settings, customPaymentMethods: settings.customPaymentMethods.filter(p => p !== pm)})} className="text-gray-400 hover:text-red-500"><XIcon size={12}/></button>
                            </span>
                        ))}
                    </div>
                </section>
            </div>
        )}

        {/* CURRENCY TAB */}
        {activeTab === 'currency' && (
            <div className="space-y-8 max-w-2xl">
                <section>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('supported_currencies')}</h3>
                    <div className="flex gap-2 mb-3">
                        <input 
                            type="text" placeholder="Code (e.g. TWD)" 
                            className="w-24 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                            value={newCurrency.code} onChange={e => setNewCurrency({...newCurrency, code: e.target.value.toUpperCase()})}
                        />
                         <input 
                            type="text" placeholder="Name (e.g. New Taiwan Dollar)" 
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
                            value={newCurrency.name} onChange={e => setNewCurrency({...newCurrency, name: e.target.value})}
                        />
                        <button 
                            onClick={() => {
                                if(newCurrency.code && newCurrency.name) {
                                    onUpdateSettings({...settings, customCurrencies: [...settings.customCurrencies, newCurrency]});
                                    setNewCurrency({code: '', name: ''});
                                }
                            }} 
                            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                        ><Plus size={20}/></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                         {settings.customCurrencies.map(c => (
                            <span key={c.code} className="px-3 py-1 bg-gray-100 dark:bg-slate-700 dark:text-gray-200 rounded-full text-sm flex items-center gap-2">
                                <b>{c.code}</b> - {c.name}
                                <button onClick={() => onUpdateSettings({...settings, customCurrencies: settings.customCurrencies.filter(cur => cur.code !== c.code)})} className="text-gray-400 hover:text-red-500"><XIcon size={12}/></button>
                            </span>
                        ))}
                    </div>
                </section>

                <section>
                     <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('exchange_rate_api')}</h3>
                     <div className="grid gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('provider')}</label>
                            <select 
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg outline-none"
                                value={settings.currencyApi.provider}
                                onChange={e => onUpdateSettings({...settings, currencyApi: {...settings.currencyApi, provider: e.target.value as any}})}
                            >
                                <option value="none">None (Use Mock Data)</option>
                                <option value="tianapi">TianAPI</option>
                                <option value="apilayer">ApiLayer</option>
                            </select>
                         </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('api_key')}</label>
                            <input 
                                type="password"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg outline-none"
                                value={settings.currencyApi.apiKey}
                                onChange={e => onUpdateSettings({...settings, currencyApi: {...settings.currencyApi, apiKey: e.target.value}})}
                            />
                         </div>
                     </div>
                </section>

                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('realtime_rates')} ({t('base_usd')})</h3>
                        <button onClick={fetchRates} disabled={isLoadingRates} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg">
                            <RefreshCw size={20} className={isLoadingRates ? "animate-spin" : ""} />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {rates ? Object.entries(rates).map(([code, rate]) => (
                             <div key={code} className="p-4 bg-gray-50 dark:bg-slate-700 rounded-xl">
                                <span className="text-sm text-gray-500 dark:text-gray-400">USD to {code}</span>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">{rate}</p>
                             </div>
                        )) : (
                            <div className="col-span-3 text-center py-4 text-gray-400">
                                Click refresh to load rates
                            </div>
                        )}
                    </div>
                </section>
            </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === 'notifications' && (
            <div className="space-y-8 max-w-2xl">
                 {/* Channels */}
                 <section>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('channels')}</h3>
                    
                    <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl mb-4">
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
                                <input placeholder="Bot Token" className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white" value={settings.notifications.telegram.botToken} onChange={e => onUpdateSettings({...settings, notifications: {...settings.notifications, telegram: {...settings.notifications.telegram, botToken: e.target.value}}})} />
                                <div className="flex gap-2">
                                     <input placeholder="Chat ID" className="flex-1 px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white" value={settings.notifications.telegram.chatId} onChange={e => onUpdateSettings({...settings, notifications: {...settings.notifications, telegram: {...settings.notifications.telegram, chatId: e.target.value}}})} />
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

                    <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
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
                 </section>

                 {/* Rules */}
                 <section>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('rules')}</h3>
                    <div className="space-y-3">
                        {[
                            { key: 'renewalReminder', label: t('renewal_reminder') },
                            { key: 'renewalFailed', label: t('renewal_failed') },
                            { key: 'renewalSuccess', label: t('renewal_success') },
                            { key: 'subscriptionChange', label: t('subscription_changes') },
                        ].map((rule) => (
                             <div key={rule.key} className="flex flex-col p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-700 dark:text-gray-200">{rule.label}</span>
                                    <input 
                                        type="checkbox" 
                                        checked={(settings.notifications.rules as any)[rule.key]} 
                                        onChange={e => onUpdateSettings({...settings, notifications: {...settings.notifications, rules: {...settings.notifications.rules, [rule.key]: e.target.checked}}})}
                                        className="w-5 h-5 text-primary-600 rounded"
                                    />
                                </div>
                                
                                {/* Reminder Days Input - Only show for Renewal Reminder when enabled */}
                                {rule.key === 'renewalReminder' && settings.notifications.rules.renewalReminder && (
                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 flex items-center gap-2 animate-fade-in">
                                        <label className="text-sm text-gray-600 dark:text-gray-400">{t('remind_me')}</label>
                                        <input 
                                            type="number" min="1" max="30" 
                                            className="w-16 px-2 py-1 border rounded dark:bg-slate-800 dark:border-gray-600 dark:text-white text-center"
                                            value={settings.notifications.rules.reminderDays}
                                            onChange={e => onUpdateSettings({...settings, notifications: {...settings.notifications, rules: {...settings.notifications.rules, reminderDays: parseInt(e.target.value)}}}) }
                                        />
                                        <span className="text-sm text-gray-600 dark:text-gray-400">{t('days_before')}</span>
                                    </div>
                                )}
                             </div>
                        ))}
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
                        <button className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{t('update_password')}</button>
                    </div>
                 </section>
                 
                 <section>
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('two_factor')}</h3>
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={settings.security.twoFactorEnabled} onChange={e => {
                                onUpdateSettings({...settings, security: {...settings.security, twoFactorEnabled: e.target.checked}});
                                if(e.target.checked) setShowQr(true);
                                else setShowQr(false);
                            }} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                        </label>
                     </div>
                     {showQr && settings.security.twoFactorEnabled && (
                         <div className="p-6 bg-gray-50 dark:bg-slate-700 rounded-xl flex flex-col items-center">
                             <div className="w-48 h-48 bg-white p-2 mb-4">
                                 {/* Mock QR Code */}
                                 <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/Subscrybe:User?secret=JBSWY3DPEHPK3PXP&issuer=Subscrybe" alt="2FA QR" />
                             </div>
                             <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 text-center">{t('scan_qr')}</p>
                             <div className="flex gap-2">
                                 <input type="text" placeholder="Enter 6-digit code" className="px-4 py-2 border rounded-lg dark:bg-slate-800 dark:border-gray-600 dark:text-white" />
                                 <button className="px-4 py-2 bg-green-600 text-white rounded-lg">{t('verify')}</button>
                             </div>
                         </div>
                     )}
                 </section>
            </div>
        )}

      </div>
    </div>
  );
};

const XIcon: React.FC<{size?: number}> = ({size = 16}) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

export default Settings;
