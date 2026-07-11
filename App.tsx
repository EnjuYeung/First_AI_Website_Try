import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Plus, Home, CreditCard, BellRing, Settings as SettingsIcon, LogOut, CheckCircle, AlertTriangle } from 'lucide-react';
import { AppSettings, Subscription } from './types';
import { getT } from './services/i18n';
import LoginPage from './components/LoginPage';

const Dashboard = lazy(() => import('./components/Dashboard'));
const SubscriptionList = lazy(() => import('./components/SubscriptionList'));
const SubscriptionForm = lazy(() => import('./components/SubscriptionForm'));
const Settings = lazy(() => import('./components/Settings'));
const NotificationHistory = lazy(() => import('./components/NotificationHistory'));

// Custom Hooks
import { useAuth } from './hooks/useAuth';
import { useAppData } from './hooks/useAppData';
import { useClientPreferences } from './hooks/useClientPreferences';
import { useTheme } from './hooks/useTheme';

// Layout Components
import { AppHeader } from './components/layout/AppHeader';
import { MobileNav } from './components/layout/MobileNav';

const App: React.FC = () => {
  const { isAuthenticated, isLoadingAuth, login, logout } = useAuth();
  const { language, setLanguage, theme, setTheme } = useClientPreferences();
  const {
    subscriptions, settings, notifications, isDataLoading,
    loadRemoteData, updateSettings, saveSubscription, deleteSubscription,
    batchDeleteSubscriptions, duplicateSubscription, deleteNotification, clearNotifications,
    lastMutationError, clearMutationError
  } = useAppData(isAuthenticated, logout, language);

  const clientSettings: AppSettings = { ...settings, language, theme };

  useTheme(theme);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'notifications' | 'settings'>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const stored = window.localStorage.getItem('subm.activeTab');
    if (stored === 'dashboard' || stored === 'list' || stored === 'notifications' || stored === 'settings') {
      return stored;
    }
    return 'dashboard';
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [refreshAlert, setRefreshAlert] = useState<
    { type: 'success' } | { type: 'error'; log: string } | null
  >(null);

  const t = getT(language);

  // Persist Tab
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('subm.activeTab', activeTab);
  }, [activeTab]);

  // Handlers
  const handleEditSubscription = (sub: Subscription) => {
    setEditingSub(sub);
    setIsModalOpen(true);
  };

  const handleSaveWrapper = async (sub: Subscription) => {
    const saved = await saveSubscription(sub, !!editingSub);
    if (saved) setEditingSub(null);
    return saved;
  };

  const openAddModal = () => {
    setEditingSub(null);
    setIsModalOpen(true);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  const toggleTheme = () => {
    const nextTheme: Record<string, 'light' | 'dark' | 'system'> = {
      system: 'light',
      light: 'dark',
      dark: 'system'
    };
    setTheme(nextTheme[theme] || 'system');
  };

  const handleSettingsUpdate = (nextSettings: AppSettings) => {
    if (nextSettings.language !== language) setLanguage(nextSettings.language);
    if (nextSettings.theme !== theme) setTheme(nextSettings.theme);

    const { language: _nextLanguage, theme: _nextTheme, ...nextServerSettings } = nextSettings;
    const { language: _language, theme: _theme, ...currentServerSettings } = settings;
    if (JSON.stringify(nextServerSettings) === JSON.stringify(currentServerSettings)) {
      return Promise.resolve(true);
    }

    return updateSettings({
      ...nextSettings,
      language: settings.language,
      theme: settings.theme,
    });
  };

  const handleManualRefresh = async () => {
    const result = await loadRemoteData();
    if (result.ok) {
      setRefreshAlert({ type: 'success' });
      return;
    }

    const error = result.error;
    const detail = error instanceof Error
      ? error.stack || `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : JSON.stringify(error, null, 2);
    setRefreshAlert({
      type: 'error',
      log: `[${new Date().toISOString()}] ${detail || 'Unknown refresh error'}`,
    });
  };

  const handleLogoutConfirm = () => {
    logout();
    setIsLogoutModalOpen(false);
    setActiveTab('dashboard');
  };

  const mutationAlert = lastMutationError
    ? {
        type: 'error' as const,
        log: lastMutationError instanceof Error
          ? lastMutationError.stack || `${lastMutationError.name}: ${lastMutationError.message}`
          : String(lastMutationError),
      }
    : null;
  const visibleAlert = refreshAlert || mutationAlert;

  // Nav Configuration
  const navTabs = [
    { id: 'dashboard', icon: Home, label: t('dashboard') },
    { id: 'list', icon: CreditCard, label: t('subscriptions') },
    { id: 'notifications', icon: BellRing, label: t('notifications_history') },
    { id: 'settings', icon: SettingsIcon, label: t('settings') },
  ] as const;


  if (isLoadingAuth) return null; // Or a loading spinner

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLogin={login}
        lang={language}
        toggleLanguage={toggleLanguage}
      />
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col transition-colors duration-200">

      <AppHeader
        navTabs={navTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDataLoading={isDataLoading}
        loadRemoteData={handleManualRefresh}
        settings={clientSettings}
        toggleLanguage={toggleLanguage}
        toggleTheme={toggleTheme}
        onLogoutClick={() => setIsLogoutModalOpen(true)}
        t={t}
      />

      {/* Main Content */}
      <main className="flex-1 p-5 pb-24 sm:p-6 sm:pb-6 lg:p-10 lg:pb-10 overflow-x-hidden max-w-7xl mx-auto w-full">

        {/* Helper Action (Add Button) - Only visible on Dashboard/List */}
        <div className="flex justify-between items-center mb-8 min-h-[44px]">
          <div></div>
          {(activeTab === 'dashboard' || activeTab === 'list') && (
            <button
              onClick={openAddModal}
              className="flex items-center space-x-2 bg-primary-600/90 hover:bg-primary-600 text-white px-5 py-2.5 rounded-2xl shadow-mac-sm transition-transform active:scale-[0.98] backdrop-blur-md"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">{t('add_new')}</span>
            </button>
          )}
        </div>

        <Suspense fallback={<div className="py-16 text-center text-gray-500">{language === 'zh' ? '加载中…' : 'Loading…'}</div>}>
        <div className="animate-fade-in">
          {activeTab === 'dashboard' && <Dashboard subscriptions={subscriptions} lang={language} settings={clientSettings} />}

          {activeTab === 'list' && (
            <SubscriptionList
              subscriptions={subscriptions}
              notifications={notifications}
              onEdit={handleEditSubscription}
              onDelete={deleteSubscription}
              onDuplicate={duplicateSubscription}
              onBatchDelete={batchDeleteSubscriptions}
              lang={language}
              exchangeRates={clientSettings.exchangeRates}
              timezone={clientSettings.timezone}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationHistory
              lang={language}
              notifications={notifications}
              onDeleteNotification={deleteNotification}
              onClearNotifications={clearNotifications}
            />
          )}

          {activeTab === 'settings' && <Settings settings={clientSettings} onUpdateSettings={handleSettingsUpdate} />}
        </div>
        </Suspense>
      </main>

      <Suspense fallback={null}>
      <SubscriptionForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveWrapper}
        initialData={editingSub}
        settings={clientSettings}
        lang={language}
      />
      </Suspense>

      <MobileNav
        navTabs={navTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Global Modals */}
      {visibleAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-fade-in">
          <div className="mac-surface rounded-2xl shadow-xl w-full max-w-lg overflow-hidden p-6 text-center animate-pop-in">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              visibleAlert.type === 'success'
                ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            }`}>
              {visibleAlert.type === 'success' ? <CheckCircle size={32} /> : <AlertTriangle size={32} />}
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {t(visibleAlert.type === 'success' ? 'refresh_success' : 'refresh_failed')}
            </h3>
            {visibleAlert.type === 'error' && (
              <pre className="max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-left text-xs leading-5 text-red-200 whitespace-pre-wrap break-words">
                {visibleAlert.log}
              </pre>
            )}
            <button
              onClick={() => {
                setRefreshAlert(null);
                clearMutationError();
              }}
              className="w-full mt-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors"
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}

      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-fade-in">
          <div className="mac-surface rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center animate-pop-in">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
              <LogOut size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('logout')}</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{t('confirm_logout')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-white font-medium rounded-xl transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleLogoutConfirm}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-red-500/30"
              >
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
