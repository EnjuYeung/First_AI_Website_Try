import React, { useState, useEffect } from 'react';
import { Plus, LayoutDashboard, List, Settings as SettingsIcon, BarChart2, BellRing, Globe, Moon, Sun, LogOut, Home, CreditCard } from 'lucide-react';
import { Subscription, AppSettings } from './types';
import { loadSubscriptions, saveSubscriptions, loadSettings, saveSettings } from './services/storageService';
import { translations } from './services/i18n';
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

  // App State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'analytics' | 'notifications' | 'settings'>('dashboard');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);

  // Helper for translations
  const t = (key: keyof typeof translations['en']) => {
    const value = translations[settings.language][key];
    return value !== undefined ? value : key;
  };

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem('auth_token');
    if (token) {
        setIsAuthenticated(true);
    }
    setIsLoadingAuth(false);

    const loadedSubs = loadSubscriptions();
    setSubscriptions(loadedSubs);

    // Initial Theme Load
    if (settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  }, []);

  // Update settings handler
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    // Apply theme
    if (newSettings.theme === 'dark' || (newSettings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  };

  const handleSaveSubscription = (sub: Subscription) => {
    let updated: Subscription[];
    if (editingSub) {
      updated = subscriptions.map(s => s.id === sub.id ? sub : s);
    } else {
      updated = [...subscriptions, sub];
    }
    setSubscriptions(updated);
    saveSubscriptions(updated);
    setEditingSub(null);
  };

  const handleDeleteSubscription = (id: string) => {
    if (window.confirm(t('confirm_delete'))) {
      const updated = subscriptions.filter(s => s.id !== id);
      setSubscriptions(updated);
      saveSubscriptions(updated);
    }
  };

  const handleBatchDelete = (ids: string[]) => {
    const message = t('confirm_batch_delete').replace('{count}', ids.length.toString());
    if (window.confirm(message)) {
      const updated = subscriptions.filter(s => !ids.includes(s.id));
      setSubscriptions(updated);
      saveSubscriptions(updated);
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
    saveSubscriptions(updated);
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
  };

  const handleLogout = () => {
      if (window.confirm(t('confirm_logout'))) {
          localStorage.removeItem('auth_token');
          setIsAuthenticated(false);
          setActiveTab('dashboard'); // Reset tab
      }
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col transition-colors duration-200">
      
      {/* Top Navigation Bar */}
      <header className="bg-black text-white px-6 h-16 flex items-center justify-between sticky top-0 z-20 shadow-md">
         {/* Left: Branding & Nav Links */}
         <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold tracking-tight">SubManager</h1>
            
            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-1 ml-4">
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                >
                   <Home size={18} />
                   <span>{t('dashboard')}</span>
                </button>
                 <button 
                  onClick={() => setActiveTab('list')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'list' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                >
                   <CreditCard size={18} />
                   <span>{t('subscriptions')}</span>
                </button>
                 <button 
                  onClick={() => setActiveTab('analytics')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'analytics' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                >
                   <BarChart2 size={18} />
                   <span>{t('analytics')}</span>
                </button>
                 <button 
                  onClick={() => setActiveTab('notifications')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'notifications' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                >
                   <BellRing size={18} />
                   <span>{t('notifications_history')}</span>
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                >
                   <SettingsIcon size={18} />
                   <span>{t('settings')}</span>
                </button>
            </nav>
         </div>

         {/* Right: Controls */}
         <div className="flex items-center gap-4 text-gray-300">
            <button onClick={toggleLanguage} className="hover:text-white transition-colors" title={t('language')}><Globe size={18} /></button>
            <button onClick={toggleTheme} className="hover:text-white transition-colors" title={t('appearance')}>
                {settings.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button onClick={handleLogout} className="hover:text-white transition-colors" title={t('logout')}><LogOut size={18} /></button>
         </div>
      </header>


      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-10 overflow-x-hidden max-w-7xl mx-auto w-full">
        {/* Header Section for Page Content */}
        <div className="flex justify-between items-center mb-8">
            {/* Optional Breadcrumb or Page Title if strictly needed, otherwise implied by tabs */}
             <div>
                 {/* Empty div to keep layout if add button is on right */}
             </div>
          
          {activeTab !== 'settings' && activeTab !== 'notifications' && (
            <button
                onClick={openAddModal}
                className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl shadow-md transition-transform active:scale-95"
            >
                <Plus size={20} />
                <span className="hidden sm:inline">{t('add_new')}</span>
            </button>
          )}
        </div>

        <div className="animate-fade-in">
          {activeTab === 'dashboard' && <Dashboard subscriptions={subscriptions} lang={settings.language} />}
          
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
            <Statistics subscriptions={subscriptions} lang={settings.language} />
          )}

          {activeTab === 'notifications' && (
            <NotificationHistory lang={settings.language} />
          )}
          
          {activeTab === 'settings' && <Settings settings={settings} onUpdateSettings={handleUpdateSettings} />}
        </div>
      </main>

      {/* Modal */}
      <SubscriptionForm 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSubscription}
        initialData={editingSub}
        settings={settings}
        lang={settings.language}
      />
    </div>
  );
};

export default App;