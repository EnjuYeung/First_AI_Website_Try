import React, { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle, Coins, KeyRound, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { AppSettings, SettingsUpdate, ServerSettingsUpdate } from '../types';
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
import { ModalDialog } from './ui/ModalDialog';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (patch: SettingsUpdate) => boolean | Promise<boolean>;
  onApplyRemoteSettings: (update: ServerSettingsUpdate) => void;
}

type SettingsTab = 'general' | 'api' | 'currency' | 'notifications' | 'security';

const Toast = ({ message, onClose }: { message: string; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);
  return <div role="status" aria-live="polite" className="settings-toast fixed z-50 flex items-center gap-3 rounded-xl px-5 py-3"><CheckCircle size={18} aria-hidden="true" />{message}</div>;
};

const Settings: React.FC<Props> = ({ settings, onUpdateSettings, onApplyRemoteSettings }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [alertState, setAlertState] = useState<SettingsAlert | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const t = getT(settings.language);
  const setAlert = (alert: SettingsAlert) => setAlertState(alert);
  const exchange = useExchangeRateSettings(onApplyRemoteSettings, t, setAlert);
  const notification = useNotificationSettings(settings, onUpdateSettings, t, setAlert);
  const security = useSecuritySettings(settings, t, setAlert, setToastMessage, onApplyRemoteSettings);

  const tabs = [
    { id: 'general' as const, icon: SlidersHorizontal },
    { id: 'api' as const, icon: KeyRound },
    { id: 'currency' as const, icon: Coins },
    { id: 'notifications' as const, icon: BellRing },
    { id: 'security' as const, icon: ShieldCheck },
  ];

  return (
    <div className="workspace-page settings-page animate-fade-in space-y-6 pb-8">
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}

      <header>
        <div className="eyebrow mb-3">Subm / {t('settings')}</div>
        <h1 className="page-title">{t('settings')}</h1>
        <p className="page-copy mt-3 text-sm">{t('settings_copy')}</p>
      </header>

      <div className="settings-workspace">
        <aside className="settings-sidebar">
          <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label={t('settings')}>
            {tabs.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                data-active={activeTab === id}
                aria-current={activeTab === id ? 'page' : undefined}
                className="settings-nav-button flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors md:w-full"
              >
                <Icon size={17} aria-hidden="true" />
                <span>{t(id)}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="settings-content min-w-0">
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
        <ModalDialog role="alertdialog" title={alertState.title} onClose={() => setAlertState(null)}
          icon={<div className={`w-fit rounded-xl p-3 ${alertState.type === 'success' ? 'bg-[var(--rail-teal-soft)] text-[var(--rail-teal-ink)]' : 'bg-[var(--alert-coral-soft)] text-[var(--alert-coral)]'}`}>
              {alertState.type === 'success' ? <CheckCircle size={30} /> : <AlertTriangle size={30} />}
            </div>}
          actions={<button onClick={() => setAlertState(null)} className="secondary-action w-full rounded-xl py-2.5 font-medium">{t('close')}</button>}>
          <p>{alertState.message}</p>
        </ModalDialog>
      )}
    </div>
  );
};

export default Settings;
