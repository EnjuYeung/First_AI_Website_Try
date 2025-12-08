
import React, { useState, useEffect } from 'react';
import { AppSettings, AIConfig, COMMON_TIMEZONES, ISO_CURRENCIES } from '../types';
import { getRatesFromAI, shouldAutoUpdate } from '../services/currencyService';
import { getT } from '../services/i18n';
import { Plus, Moon, Sun, Monitor, RefreshCw, Send, Loader2, Globe, Clock, Search, CheckCircle, X as XIcon, AlertTriangle, Cpu, Info, Save } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'currency' | 'notifications' | 'security'>('general');
  const [newCategory, setNewCategory] = useState('');
  const [newPayment, setNewPayment] = useState('');
  const [currencySearch, setCurrencySearch] = useState('');
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  
  // Currency State
  const [isUpdatingRates, setIsUpdatingRates] = useState(false);

  // Security State
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showQr, setShowQr] = useState(false);

  // Alert Modal State
  const [alertState, setAlertState] = useState<{ isOpen: boolean; type: 'success' | 'error'; title: string; message: string } | null>(null);
  
  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Notification State
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);

  // AI Config Local State (Not saved immediately)
  const [localAiConfig, setLocalAiConfig] = useState<AIConfig>(settings.aiConfig);

  useEffect(() => {
      setLocalAiConfig(settings.aiConfig);
  }, [settings.aiConfig]);

  const t = getT(settings.language);

  // Auto-Update Check
  useEffect(() => {
      const checkAndAutoUpdate = async () => {
          if (shouldAutoUpdate(settings.lastRatesUpdate) && settings.aiConfig.apiKey) {
              console.log("Auto-updating exchange rates...");
              handleRefreshRates();
          }
      };
      checkAndAutoUpdate();
  }, []);

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
  const handleRefreshRates = async () => {
    if (!settings.aiConfig.apiKey || !settings.aiConfig.baseUrl) {
         setAlertState({
            isOpen: true,
            type: 'error',
            title: t('error_title'),
            message: "Please configure AI settings first to use real-time rates."
        });
        return;
    }

    setIsUpdatingRates(true);
    const codesToFetch = settings.customCurrencies.map(c => c.code);
    const newRates = await getRatesFromAI(codesToFetch, settings.aiConfig);
    
    if (newRates) {
        onUpdateSettings({
            ...settings,
            exchangeRates: { ...settings.exchangeRates, ...newRates },
            lastRatesUpdate: Date.now()
        });
        if (!shouldAutoUpdate(settings.lastRatesUpdate)) { // If manual triggering
             setAlertState({
                isOpen: true,
                type: 'success',
                title: t('success_title'),
                message: t('connection_success')
            });
        }
    } else {
         setAlertState({
            isOpen: true,
            type: 'error',
            title: t('error_title'),
            message: t('connection_failed')
        });
    }
    setIsUpdatingRates(false);
  };

  const filteredCurrencies = ISO_CURRENCIES.filter(c => 
    (c.code.toLowerCase().includes(currencySearch.toLowerCase()) || 
     c.name.toLowerCase().includes(currencySearch.toLowerCase())) &&
    !settings.customCurrencies.some(existing => existing.code === c.code)
  );

  // AI Configuration Handlers
  const handleSaveAiConfig = () => {
      onUpdateSettings({ ...settings, aiConfig: localAiConfig });
      setToastMessage(t('ai_saved_toast'));
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
        {['general', 'ai', 'currency', 'notifications', 'security'].map((tab) => (
            <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-6 py-4 text-sm font-medium capitalize whitespace-nowrap transition-colors ${
                    activeTab === tab 
                    ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50 dark:bg-slate-700' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
            >
                {t(tab === 'ai' ? 'ai_integration' : tab as any)}
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

        {/* AI INTEGRATION TAB */}
        {activeTab === 'ai' && (
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                 {/* Left Column: Form */}
                 <div className="lg:col-span-8 space-y-8">
                     <div>
                         <div className="flex items-center gap-2 mb-2">
                             <Cpu className="text-primary-600" size={24}/>
                             <h3 className="text-xl font-bold text-gray-800 dark:text-white">{t('ai_title')}</h3>
                         </div>
                         <p className="text-sm text-gray-500 dark:text-gray-400">{t('ai_subtitle')}</p>
                     </div>

                     <div className="space-y-6">
                        {/* URL */}
                         <div className="space-y-2">
                             <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('chat_url')}</label>
                             <input 
                                type="text"
                                value={localAiConfig.baseUrl}
                                onChange={e => setLocalAiConfig({...localAiConfig, baseUrl: e.target.value})}
                                placeholder={t('chat_url_placeholder')}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white transition-all font-mono text-sm"
                             />
                         </div>

                         {/* API Key */}
                         <div className="space-y-2">
                             <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('ai_api_key')}</label>
                             <input 
                                type="password"
                                value={localAiConfig.apiKey}
                                onChange={e => setLocalAiConfig({...localAiConfig, apiKey: e.target.value})}
                                placeholder="sk-..."
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white transition-all font-mono text-sm tracking-widest"
                             />
                         </div>

                         {/* Model */}
                         <div className="space-y-2">
                             <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('ai_model_name')}</label>
                             <input 
                                type="text"
                                value={localAiConfig.model}
                                onChange={e => setLocalAiConfig({...localAiConfig, model: e.target.value})}
                                placeholder="e.g. gpt-4o, deepseek-chat"
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white transition-all font-mono text-sm"
                             />
                         </div>

                         {/* Action Buttons */}
                         <div className="flex gap-4 pt-2">
                             <button
                                onClick={handleSaveAiConfig}
                                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"
                             >
                                <Save size={18} />
                                <span>{t('ai_save')}</span>
                             </button>
                         </div>
                     </div>
                 </div>

                 {/* Right Column: Tips */}
                 <div className="lg:col-span-4">
                     <div className="bg-gray-50 dark:bg-slate-700/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
                         <div className="flex items-center gap-2 mb-4 text-gray-800 dark:text-white font-bold">
                             <Info size={18} />
                             <span>{t('ai_config_desc')}</span>
                         </div>
                         <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                             <li className="flex gap-2 items-start">
                                 <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0"></div>
                                 <span>{t('ai_desc_1')}</span>
                             </li>
                             <li className="flex gap-2 items-start">
                                 <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0"></div>
                                 <span>{t('ai_desc_2')}</span>
                             </li>
                             <li className="flex gap-2 items-start">
                                 <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0"></div>
                                 <span>{t('ai_desc_3')}</span>
                             </li>
                             <li className="flex gap-2 items-start">
                                 <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0"></div>
                                 <span>{t('ai_desc_4')}</span>
                             </li>
                         </ul>
                         
                         <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-xl flex items-start gap-3">
                             <AlertTriangle size={18} className="text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                             <p className="text-xs text-yellow-700 dark:text-yellow-400 leading-relaxed">
                                 Ensure your provider supports standard OpenAI-compatible JSON responses for features like currency conversion to work correctly.
                             </p>
                         </div>
                     </div>
                 </div>
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
                                onClick={handleRefreshRates} 
                                disabled={isUpdatingRates} 
                                className="p-2 bg-white dark:bg-slate-600 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-slate-500 rounded-lg transition-all shadow-sm"
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
                             {isUpdatingRates && <span className="text-primary-500 animate-pulse">Updating...</span>}
                        </div>
                     </div>

                     <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                         <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                            {t('ai_rate_info')}
                         </p>
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
                        <button onClick={handleUpdatePassword} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">{t('update_password')}</button>
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
