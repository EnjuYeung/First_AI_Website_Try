import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { AppSettings, ISO_CURRENCIES } from '../types';
import { getT } from '../services/i18n';
import { canonicalCategoryKey, canonicalPaymentMethodKey } from '../services/displayLabels';
import { useExchangeRateSettings } from '../hooks/useExchangeRateSettings';
import { useNotificationSettings } from '../hooks/useNotificationSettings';
import { useSecuritySettings } from '../hooks/useSecuritySettings';
import { SettingsAlert } from '../hooks/settingsTypes';
import ApiTab from './settings/tabs/ApiTab';
import CurrencyTab from './settings/tabs/CurrencyTab';
import GeneralTab from './settings/tabs/GeneralTab';
import NotificationsTab from './settings/tabs/NotificationsTab';
import SecurityTab from './settings/tabs/SecurityTab';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

const Toast = ({ message, onClose }: { message: string; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return <div className="fixed bottom-6 right-6 bg-green-600 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 z-50"><CheckCircle size={20} />{message}</div>;
};

const reorder = (list: string[], from: number, to: number) => {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

const Settings: React.FC<Props> = ({ settings, onUpdateSettings }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'api' | 'currency' | 'notifications' | 'security'>('general');
  const [newCategory, setNewCategory] = useState('');
  const [newPayment, setNewPayment] = useState('');
  const [currencySearch, setCurrencySearch] = useState('');
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [dragCatIndex, setDragCatIndex] = useState<number | null>(null);
  const [dragPayIndex, setDragPayIndex] = useState<number | null>(null);
  const [alertState, setAlertState] = useState<SettingsAlert | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const t = getT(settings.language);
  const setAlert = (alert: SettingsAlert) => setAlertState(alert);

  const exchange = useExchangeRateSettings(settings, onUpdateSettings, t, setAlert);
  const notification = useNotificationSettings(settings, onUpdateSettings, t, setAlert);
  const security = useSecuritySettings(settings, onUpdateSettings, t, setAlert, setToastMessage);

  const addCategory = () => {
    const value = canonicalCategoryKey(newCategory);
    if (value && !settings.customCategories.some((item) => canonicalCategoryKey(item).toLowerCase() === value.toLowerCase())) {
      onUpdateSettings({ ...settings, customCategories: [...settings.customCategories, value] });
      setNewCategory('');
    }
  };
  const addPayment = () => {
    const value = canonicalPaymentMethodKey(newPayment);
    if (value && !settings.customPaymentMethods.some((item) => canonicalPaymentMethodKey(item).toLowerCase() === value.toLowerCase())) {
      onUpdateSettings({ ...settings, customPaymentMethods: [...settings.customPaymentMethods, value] });
      setNewPayment('');
    }
  };
  const filteredCurrencies = ISO_CURRENCIES.filter((currency) =>
    `${currency.code} ${currency.name}`.toLowerCase().includes(currencySearch.toLowerCase()) &&
    !settings.customCurrencies.some((item) => item.code === currency.code)
  );

  return (
    <div className="mac-surface rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[600px] overflow-hidden relative">
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
      <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
        {(['general', 'api', 'currency', 'notifications', 'security'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-4 text-sm font-medium capitalize whitespace-nowrap ${activeTab === tab ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50 dark:bg-slate-700' : 'text-gray-500 dark:text-gray-400'}`}>{t(tab as any)}</button>
        ))}
      </div>
      <div className="p-6">
        {activeTab === 'general' && <GeneralTab
          t={t} currentLanguage={settings.language} settings={settings} onUpdateSettings={onUpdateSettings}
          newCategory={newCategory} setNewCategory={setNewCategory} newPayment={newPayment}
          setNewPayment={setNewPayment} categories={settings.customCategories}
          payments={settings.customPaymentMethods} dragCatIndex={dragCatIndex}
          setDragCatIndex={setDragCatIndex} dragPayIndex={dragPayIndex} setDragPayIndex={setDragPayIndex}
          handleAddCategory={addCategory} handleAddPayment={addPayment}
          handleCategoryDragStart={setDragCatIndex}
          handleCategoryDrop={(index) => {
            if (dragCatIndex !== null && dragCatIndex !== index) onUpdateSettings({ ...settings, customCategories: reorder(settings.customCategories, dragCatIndex, index) });
            setDragCatIndex(null);
          }}
          handlePaymentDragStart={setDragPayIndex}
          handlePaymentDrop={(index) => {
            if (dragPayIndex !== null && dragPayIndex !== index) onUpdateSettings({ ...settings, customPaymentMethods: reorder(settings.customPaymentMethods, dragPayIndex, index) });
            setDragPayIndex(null);
          }}
        />}
        {activeTab === 'api' && <ApiTab t={t} currentLanguage={settings.language} settings={settings} exchangeApiKey={exchange.exchangeApiKey} setExchangeApiKey={exchange.setExchangeApiKey} isSavingExchangeApi={exchange.isSavingExchangeApi} handleSaveExchangeApiKey={exchange.handleSaveExchangeApiKey} />}
        {activeTab === 'currency' && <CurrencyTab
          t={t} settings={settings} onUpdateSettings={onUpdateSettings} currencySearch={currencySearch}
          setCurrencySearch={setCurrencySearch} showCurrencyDropdown={showCurrencyDropdown}
          setShowCurrencyDropdown={setShowCurrencyDropdown} filteredCurrencies={filteredCurrencies}
          isUpdatingRates={exchange.isUpdatingRates} handleManualUpdateRates={exchange.handleManualUpdateRates}
          formatLastUpdated={(timestamp) => timestamp ? new Date(timestamp).toLocaleString() : 'Never'}
        />}
        {activeTab === 'notifications' && <NotificationsTab
          t={t} settings={settings} onUpdateSettings={onUpdateSettings} {...notification}
        />}
        {activeTab === 'security' && <SecurityTab t={t} settings={settings} {...security} />}
      </div>
      {alertState?.isOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="mac-surface rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
          <div className={`mx-auto mb-4 w-fit p-3 rounded-full ${alertState.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
            {alertState.type === 'success' ? <CheckCircle size={32} /> : <AlertTriangle size={32} />}
          </div>
          <h3 className="text-xl font-bold">{alertState.title}</h3>
          <p className="text-gray-500 mt-2 text-sm">{alertState.message}</p>
          <button onClick={() => setAlertState(null)} className="w-full mt-5 py-2.5 bg-gray-100 dark:bg-slate-700 rounded-xl">{t('close')}</button>
        </div>
      </div>}
    </div>
  );
};

export default Settings;
