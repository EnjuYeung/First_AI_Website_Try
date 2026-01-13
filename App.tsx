import React, { useEffect, useState } from 'react';
import { Plus, Home, CreditCard, BellRing, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { Subscription } from './types';
import { getT } from './services/i18n';
import Dashboard from './components/Dashboard';
import SubscriptionList from './components/SubscriptionList';
import SubscriptionForm from './components/SubscriptionForm';
import Settings from './components/Settings';
import NotificationHistory from './components/NotificationHistory';
import LoginPage from './components/LoginPage';

// Custom Hooks
import { useAuth } from './hooks/useAuth';
import { useAppData } from './hooks/useAppData';
import { useTheme } from './hooks/useTheme';

// Layout Components
import { AppHeader } from './components/layout/AppHeader';
import { MobileNav } from './components/layout/MobileNav';

const App: React.FC = () => {
  const { isAuthenticated, isLoadingAuth, login, logout } = useAuth();
  const {
    subscriptions, settings, notifications, isDataLoading,
    loadRemoteData, updateSettings, saveSubscription, deleteSubscription,
    batchDeleteSubscriptions, duplicateSubscription, deleteNotification, clearNotifications
  } = useAppData(isAuthenticated, logout);

  useTheme(settings.theme);

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

  const t = getT(settings.language);

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

  const handleSaveWrapper = (sub: Subscription) => {
    saveSubscription(sub, !!editingSub);
    setEditingSub(null);
  };

  const openAddModal = () => {
    setEditingSub(null);
    setIsModalOpen(true);
  };

  const toggleLanguage = () => {
    updateSettings({ ...settings, language: settings.language === 'en' ? 'zh' : 'en' });
  };

  const toggleTheme = () => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ ...settings, theme: newTheme });
  };

  const handleLogoutConfirm = () => {
    logout();
    setIsLogoutModalOpen(false);
    setActiveTab('dashboard');
  };

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
        lang={settings.language}
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
        loadRemoteData={loadRemoteData}
        settings={settings}
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

        <div className="animate-fade-in">
          {activeTab === 'dashboard' && <Dashboard subscriptions={subscriptions} lang={settings.language} settings={settings} />}

          {activeTab === 'list' && (
            <SubscriptionList
              subscriptions={subscriptions}
              notifications={notifications}
              onEdit={handleEditSubscription}
              onDelete={deleteSubscription}
              onDuplicate={duplicateSubscription}
              onBatchDelete={batchDeleteSubscriptions}
              lang={settings.language}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationHistory
              lang={settings.language}
              notifications={notifications}
              onDeleteNotification={deleteNotification}
              onClearNotifications={clearNotifications}
            />
          )}

          {activeTab === 'settings' && <Settings settings={settings} onUpdateSettings={updateSettings} />}
        </div>
      </main>

      <SubscriptionForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveWrapper}
        initialData={editingSub}
        settings={settings}
        lang={settings.language}
      />

      <MobileNav
        navTabs={navTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Global Modals */}
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
