
import React, { useState, useEffect } from 'react';
import { Plus, LayoutDashboard, List, CreditCard, Settings as SettingsIcon, BarChart2 } from 'lucide-react';
import { Subscription, AppSettings } from './types';
import { loadSubscriptions, saveSubscriptions, loadSettings, saveSettings } from './services/storageService';
import { translations } from './services/i18n';
import Dashboard from './components/Dashboard';
import SubscriptionList from './components/SubscriptionList';
import SubscriptionForm from './components/SubscriptionForm';
import Settings from './components/Settings';
import Statistics from './components/Statistics';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'analytics' | 'settings'>('dashboard');
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex transition-colors duration-200">
      {/* Sidebar Navigation */}
      <aside className="w-20 lg:w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-gray-700 fixed h-full z-10 transition-all">
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-gray-100 dark:border-gray-700">
          <div className="bg-primary-600 text-white p-2 rounded-lg">
            <CreditCard size={20} />
          </div>
          <span className="ml-3 font-bold text-xl text-gray-800 dark:text-white hidden lg:block">{t('app_name')}</span>
        </div>

        <nav className="p-4 space-y-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center p-3 rounded-xl transition-all ${
              activeTab === 'dashboard' 
                ? 'bg-primary-50 dark:bg-slate-700 text-primary-600 dark:text-white font-medium' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="ml-3 hidden lg:block">{t('dashboard')}</span>
          </button>

          <button
            onClick={() => setActiveTab('list')}
            className={`w-full flex items-center p-3 rounded-xl transition-all ${
              activeTab === 'list' 
                ? 'bg-primary-50 dark:bg-slate-700 text-primary-600 dark:text-white font-medium' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <List size={20} />
            <span className="ml-3 hidden lg:block">{t('subscriptions')}</span>
          </button>
          
          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center p-3 rounded-xl transition-all ${
              activeTab === 'analytics' 
                ? 'bg-primary-50 dark:bg-slate-700 text-primary-600 dark:text-white font-medium' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <BarChart2 size={20} />
            <span className="ml-3 hidden lg:block">{t('analytics')}</span>
          </button>

          <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
            <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center p-3 rounded-xl transition-all ${
                activeTab === 'settings' 
                    ? 'bg-primary-50 dark:bg-slate-700 text-primary-600 dark:text-white font-medium' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
                <SettingsIcon size={20} />
                <span className="ml-3 hidden lg:block">{t('settings')}</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-20 lg:ml-64 p-6 lg:p-10 overflow-x-hidden">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                {activeTab === 'list' ? t('subscriptions') : 
                 activeTab === 'analytics' ? t('analytics') :
                 activeTab === 'settings' ? t('settings') : t('dashboard')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {activeTab === 'dashboard' && t('overview_text')}
              {activeTab === 'list' && t('manage_text')}
              {activeTab === 'analytics' && t('analytics_text')}
              {activeTab === 'settings' && t('settings_text')}
            </p>
          </div>
          
          {activeTab !== 'settings' && (
            <button
                onClick={openAddModal}
                className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl shadow-md transition-transform active:scale-95"
            >
                <Plus size={20} />
                <span className="hidden sm:inline">{t('add_new')}</span>
            </button>
          )}
        </header>

        <div className="max-w-6xl mx-auto">
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
