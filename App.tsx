import React, { useState } from 'react';
import { Plus, Home, CreditCard, BarChart2, BellRing, Settings as SettingsIcon, Globe, Moon, Sun, LogOut, RefreshCcw, WalletCards } from 'lucide-react';
import { Subscription } from './types';
import { getT } from './services/i18n';
import Dashboard from './components/Dashboard';
import SubscriptionList from './components/SubscriptionList';
import SubscriptionForm from './components/SubscriptionForm';
import Settings from './components/Settings';
import Statistics from './components/Statistics';
import NotificationHistory from './components/NotificationHistory';
import LoginPage from './components/LoginPage';

// Custom Hooks
import { useAuth } from './hooks/useAuth';
import { useAppData } from './hooks/useAppData';
import { useTheme } from './hooks/useTheme';

const App: React.FC = () => {
  const { isAuthenticated, isLoadingAuth, login, logout } = useAuth();
  const { 
    subscriptions, settings, notifications, isDataLoading, 
    loadRemoteData, updateSettings, saveSubscription, deleteSubscription, 
    batchDeleteSubscriptions, duplicateSubscription, deleteNotification, clearNotifications 
  } = useAppData(isAuthenticated, logout);
  
  useTheme(settings.theme);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'analytics' | 'notifications' | 'settings'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const t = getT(settings.language);

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

  if (isLoadingAuth) return null;

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
      {/* Header */}
      <header className="px-4 sm:px-6 h-16 flex items-center justify-between sticky top-0 z-20 bg-white/70 dark:bg-slate-950/50 backdrop-blur-xl border-b border-white/30 dark:border-white/10 shadow-mac-sm">
         <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-gradient-to-br from-primary-600/90 to-indigo-500/90 text-white shadow-mac-sm ring-1 ring-white/30">
                <WalletCards size={18} />
              </div>
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Subm</h1>
            </div>
            
            <nav className="hidden md:flex items-center gap-1 ml-4">
                {[
                  { id: 'dashboard', icon: Home, label: t('dashboard') },
                  { id: 'list', icon: CreditCard, label: t('subscriptions') },
                  { id: 'analytics', icon: BarChart2, label: t('analytics') },
                  { id: 'notifications', icon: BellRing, label: t('notifications_history') },
                  { id: 'settings', icon: SettingsIcon, label: t('settings') }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60 ${activeTab === tab.id ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}`}
                  >
                     <tab.icon size={18} />
                     <span>{tab.label}</span>
                  </button>
                ))}
            </nav>
         </div>

         <div className="flex items-center gap-2 text-gray-600 dark:text-gray-200">
            <button
              onClick={loadRemoteData}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              title="Sync from server"
              disabled={isDataLoading}
            >
              <RefreshCcw size={18} className={isDataLoading ? 'animate-spin' : ''} />
            </button>
            <button onClick={toggleLanguage} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title={t('language')}><Globe size={18} /></button>
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title={t('appearance')}>
                {settings.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button onClick={() => setIsLogoutModalOpen(true)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title={t('logout')}><LogOut size={18} /></button>
         </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-5 sm:p-6 lg:p-10 overflow-x-hidden max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-center mb-8">
             <div></div>
          {activeTab !== 'settings' && activeTab !== 'notifications' && (
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
              onEdit={handleEditSubscription}
              onDelete={deleteSubscription}
              onDuplicate={duplicateSubscription}
              onBatchDelete={batchDeleteSubscriptions}
              lang={settings.language}
            />
          )}

          {activeTab === 'analytics' && (
            <Statistics subscriptions={subscriptions} settings={settings} lang={settings.language} />
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
