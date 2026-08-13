import React, { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle, Coins, KeyRound, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { AppSettings } from '../types';
import { getT } from '../services/i18n';
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
  onUpdateSettings: (settings: AppSettings) => boolean | Promise<boolean>;
  onApplyRemoteSettings: (patch: Partial<AppSettings>) => void;
}

type SettingsTab = 'general' | 'api' | 'currency' | 'notifications' | 'security';

const Toast = ({ message, onClose }: { message: string; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-[var(--rail-teal)] px-5 py-3 text-white shadow-xl"><CheckCircle size={18} />{message}</div>;
};

const Settings: React.FC<Props> = ({ settings, onUpdateSettings, onApplyRemoteSettings }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [alertState, setAlertState] = useState<SettingsAlert | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const t = getT(settings.language);
  const setAlert = (alert: SettingsAlert) => setAlertState(alert);
  const exchange = useExchangeRateSettings(onApplyRemoteSettings, t, setAlert);
  const notification = useNotificationSettings(settings, onUpdateSettings, t, setAlert);
  const security = useSecuritySettings(settings, t, setAlert, setToastMessage);

  const tabs = [
    { id: 'general' as const, icon: SlidersHorizontal },
    { id: 'api' as const, icon: KeyRound },
    { id: 'currency' as const, icon: Coins },
    { id: 'notifications' as const, icon: BellRing },
    { id: 'security' as const, icon: ShieldCheck },
  ];

  return (
    <div className="animate-fade-in space-y-6 pb-8">
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

      <header>
        <div className="eyebrow mb-3">Subm / {t('settings')}</div>
        <h1 className="page-title">{t('settings')}</h1>
        <p className="page-copy mt-3 text-sm">{t('settings_copy')}</p>
      </header>

      <div className="statement-card grid min-h-[640px] overflow-hidden md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--line)] bg-[var(--surface-soft)] p-3 md:border-b-0 md:border-r md:p-4">
          <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label={t('settings')}>
            {tabs.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                data-active={activeTab === id}
                className="settings-nav-button flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors md:w-full"
              >
                <Icon size={17} />
                <span>{t(id)}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 p-5 sm:p-7 lg:p-9">
          {activeTab === 'general' && (
            <GeneralTab t={t} currentLanguage={settings.language} settings={settings} onUpdateSettings={onUpdateSettings} />
          )}
          {activeTab === 'api' && <ApiTab t={t} currentLanguage={settings.language} settings={settings} exchangeApiKey={exchange.exchangeApiKey} setExchangeApiKey={exchange.setExchangeApiKey} isSavingExchangeApi={exchange.isSavingExchangeApi} handleSaveExchangeApiKey={exchange.handleSaveExchangeApiKey} />}
          {activeTab === 'currency' && (
            <CurrencyTab
              t={t}
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              isUpdatingRates={exchange.isUpdatingRates}
              handleManualUpdateRates={exchange.handleManualUpdateRates}
              formatLastUpdated={(timestamp) => timestamp ? new Date(timestamp).toLocaleString() : t('never')}
            />
          )}
          {activeTab === 'notifications' && <NotificationsTab t={t} settings={settings} onUpdateSettings={onUpdateSettings} {...notification} />}
          {activeTab === 'security' && <SecurityTab t={t} settings={settings} {...security} />}
        </div>
      </div>

      {alertState?.isOpen && (
        <div className="dialog-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="dialog-panel w-full max-w-sm rounded-[18px] p-6 text-center">
            <div className={`mx-auto mb-4 w-fit rounded-full p-3 ${alertState.type === 'success' ? 'bg-[var(--rail-teal-soft)] text-[var(--rail-teal)]' : 'bg-[var(--alert-coral-soft)] text-[var(--alert-coral)]'}`}>
              {alertState.type === 'success' ? <CheckCircle size={30} /> : <AlertTriangle size={30} />}
            </div>
            <h3 className="font-display text-xl font-semibold text-[var(--ink)]">{alertState.title}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{alertState.message}</p>
            <button onClick={() => setAlertState(null)} className="mt-5 w-full rounded-xl bg-[var(--surface-soft)] py-2.5 font-medium text-[var(--ink)]">{t('close')}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
