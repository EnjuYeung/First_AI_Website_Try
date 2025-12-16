
import React, { useState, useEffect } from 'react';
import { Plus, Home, CreditCard, BarChart2, BellRing, Settings as SettingsIcon, Globe, Moon, Sun, LogOut, RefreshCcw, WalletCards } from 'lucide-react';
import { Subscription, AppSettings, NotificationRecord } from './types';
import { fetchAllData, saveAllData, getDefaultSettings } from './services/storageService';
import { getT } from './services/i18n';
import Dashboard from './components/Dashboard';
import SubscriptionList from './components/SubscriptionList';
import SubscriptionForm from './components/SubscriptionForm';
import Settings from './components/Settings';
import Statistics from './components/Statistics';
import NotificationHistory from './components/NotificationHistory';
import LoginPage from './components/LoginPage';

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // App State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'analytics' | 'notifications' | 'settings'>('dashboard');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings());
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  
  // Logout Modal State
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Helper for translations
  const t = getT(settings.language);

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem('auth_token');
    if (token) {
        setIsAuthenticated(true);
    }
    setIsLoadingAuth(false);

    if (token) {
        loadRemoteData();
    }
  }, []);

  // Apply theme whenever settings change
  useEffect(() => {
    applyTheme(settings);
  }, [settings.theme]);

  const applyTheme = (themeSettings: AppSettings) => {
    if (themeSettings.theme === 'dark' || (themeSettings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  };

  const handleSync = () => {
    loadRemoteData();
  };

  const loadRemoteData = async () => {
    setIsDataLoading(true);
    try {
      const data = await fetchAllData();
      setSubscriptions(data.subscriptions);
      setSettings(data.settings);
      setNotifications(data.notifications || []);
      applyTheme(data.settings);
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setIsDataLoading(false);
    }
  };

  const persistData = (partial?: { subscriptions?: Subscription[]; settings?: AppSettings; notifications?: NotificationRecord[] }) => {
    const payload = {
      subscriptions: partial?.subscriptions ?? subscriptions,
      settings: partial?.settings ?? settings,
      notifications: partial?.notifications ?? notifications
    };
    saveAllData(payload);
  };

  // Update settings handler
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    applyTheme(newSettings);
    persistData({ settings: newSettings });
  };

  const handleSaveSubscription = (sub: Subscription) => {
    let updated: Subscription[];
    if (editingSub) {
      updated = subscriptions.map(s => s.id === sub.id ? sub : s);
    } else {
      updated = [...subscriptions, sub];
    }
    setSubscriptions(updated);
    persistData({ subscriptions: updated });
    setEditingSub(null);
  };

  const handleDeleteSubscription = (id: string) => {
    if (window.confirm(t('confirm_delete'))) {
      const updated = subscriptions.filter(s => s.id !== id);
      setSubscriptions(updated);
      persistData({ subscriptions: updated });
    }
  };

  const handleBatchDelete = (ids: string[]) => {
    const message = t('confirm_batch_delete').replace('{count}', ids.length.toString());
    if (window.confirm(message)) {
      const updated = subscriptions.filter(s => !ids.includes(s.id));
      setSubscriptions(updated);
      persistData({ subscriptions: updated });
    }
  };

  const handleDuplicateSubscription = (sub: Subscription) => {
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Date.now().toString(36) + Math.random().toString(36).substring(2);
    
    const prefix = t('copy_prefix');
    const suffix = t('copy_suffix');

    const newName = `${prefix}${sub.name}${suffix}`;

    const newSub: Subscription = {
      ...sub,
      id: newId,
      name: newName,
      // Keep other fields same
    };

    const updated = [...subscriptions, newSub];
    setSubscriptions(updated);
    persistData({ subscriptions: updated });
  };

  const handleEditSubscription = (sub: Subscription) => {
    setEditingSub(sub);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingSub(null);
    setIsModalOpen(true);
  };

  // Toggle Language Helper
  const toggleLanguage = () => {
      handleUpdateSettings({ ...settings, language: settings.language === 'en' ? 'zh' : 'en' });
  };

  // Toggle Theme Helper
  const toggleTheme = () => {
      const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
      handleUpdateSettings({ ...settings, theme: newTheme });
  };

  const handleLogin = (token: string) => {
      localStorage.setItem('auth_token', token);
      setIsAuthenticated(true);
      loadRemoteData();
  };

  const handleLogoutClick = () => {
      setIsLogoutModalOpen(true);
  };

  const handleLogoutConfirm = () => {
      localStorage.removeItem('auth_token');
      setIsAuthenticated(false);
      setIsLogoutModalOpen(false);
      setActiveTab('dashboard'); // Reset tab
  };

  if (isLoadingAuth) {
      return null; // Or a loading spinner
  }

  if (!isAuthenticated) {
      return (
          <LoginPage 
            onLogin={handleLogin} 
            lang={settings.language}
            toggleLanguage={toggleLanguage}
          />
      );
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col transition-colors duration-200">
      
      {/* Top Navigation Bar */}
      <header className="px-4 sm:px-6 h-16 flex items-center justify-between sticky top-0 z-20 bg-white/70 dark:bg-slate-950/50 backdrop-blur-xl border-b border-white/30 dark:border-white/10 shadow-mac-sm">
         {/* Left: Branding & Nav Links */}
         <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-gradient-to-br from-primary-600/90 to-indigo-500/90 text-white shadow-mac-sm ring-1 ring-white/30">
                <WalletCards size={18} />
              </div>
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Subm</h1>
            </div>
            
            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-1 ml-4">
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60 ${activeTab === 'dashboard' ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}`}
                >
                   <Home size={18} />
                   <span>{t('dashboard')}</span>
                </button>
                 <button 
                  onClick={() => setActiveTab('list')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60 ${activeTab === 'list' ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}`}
                >
                   <CreditCard size={18} />
                   <span>{t('subscriptions')}</span>
                </button>
                 <button 
                  onClick={() => setActiveTab('analytics')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60 ${activeTab === 'analytics' ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}`}
                >
                   <BarChart2 size={18} />
                   <span>{t('analytics')}</span>
                </button>
                 <button 
                  onClick={() => setActiveTab('notifications')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60 ${activeTab === 'notifications' ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}`}
                >
                   <BellRing size={18} />
                   <span>{t('notifications_history')}</span>
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60 ${activeTab === 'settings' ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}`}
                >
                   <SettingsIcon size={18} />
                   <span>{t('settings')}</span>
                </button>
            </nav>
         </div>

         {/* Right: Controls */}
         <div className="flex items-center gap-2 text-gray-600 dark:text-gray-200">
            <button
              onClick={handleSync}
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
            <button onClick={handleLogoutClick} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title={t('logout')}><LogOut size={18} /></button>
         </div>
      </header>


      {/* Main Content */}
      <main className="flex-1 p-5 sm:p-6 lg:p-10 overflow-x-hidden max-w-7xl mx-auto w-full">
        {/* Header Section for Page Content */}
        <div className="flex justify-between items-center mb-8">
            {/* Optional Breadcrumb or Page Title if strictly needed, otherwise implied by tabs */}
             <div>
                 {/* Empty div to keep layout if add button is on right */}
             </div>
          
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
              onDelete={handleDeleteSubscription}
              onDuplicate={handleDuplicateSubscription}
              onBatchDelete={handleBatchDelete}
              lang={settings.language}
            />
          )}

          {activeTab === 'analytics' && (
            <Statistics subscriptions={subscriptions} settings={settings} lang={settings.language} />
          )}

          {activeTab === 'notifications' && (
            <NotificationHistory lang={settings.language} notifications={notifications} />
          )}
          
          {activeTab === 'settings' && <Settings settings={settings} onUpdateSettings={handleUpdateSettings} />}
        </div>
      </main>

      {/* Subscription Form Modal */}
      <SubscriptionForm 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSubscription}
        initialData={editingSub}
        settings={settings}
        lang={settings.language}
      />

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-fade-in">
              <div className="mac-surface rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center animate-pop-in">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
                      <LogOut size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('logout')}</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                      {t('confirm_logout')}
                  </p>
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
