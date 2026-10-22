import { pickEditableSettings } from './shared/settingsOwnership.js';
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Home, CreditCard, BarChart3, Settings as SettingsIcon, LogOut, CheckCircle, AlertTriangle } from 'lucide-react';
import { AppSettings, SettingsUpdate, Subscription, SubscriptionEdit } from './types';
import { RevisionConflictError } from './services/storageService';
import { getT } from './services/i18n';
import LoginPage from './components/LoginPage';

const Dashboard = lazy(() => import('./components/Dashboard'));
const SubscriptionList = lazy(() => import('./components/SubscriptionList'));
const SubscriptionForm = lazy(() => import('./components/SubscriptionForm'));
const Settings = lazy(() => import('./components/Settings'));
const SpendingStats = lazy(() => import('./components/SpendingStats'));
const SubscriptionDetails = lazy(() => import('./components/subscription/SubscriptionDetails').then(module => ({ default: module.SubscriptionDetails })));

import { useAuth } from './hooks/useAuth';
import { useAppData } from './hooks/useAppData';
import { useClientPreferences } from './hooks/useClientPreferences';
import { useTheme } from './hooks/useTheme';

// Layout Components
import { AppHeader } from './components/layout/AppHeader';
import { MobileNav } from './components/layout/MobileNav';
import { ModalDialog } from './components/ui/ModalDialog';

const App: React.FC = () => {
  const { isAuthenticated, isLoadingAuth, login, logout } = useAuth();
  const { language, setLanguage, theme, setTheme, colorTheme, setColorTheme } = useClientPreferences();
  const {
    subscriptions, settings, notifications, serverClock, isDataLoading, hasLoadedData, loadError,
    loadRemoteData, updateSettings, beginSubscriptionEdit, saveSubscription, deleteSubscription,
    batchDeleteSubscriptions, duplicateSubscription,
    lastMutationError, clearMutationError, applyRemoteSettings
  } = useAppData(isAuthenticated, logout, language);

  const clientSettings: AppSettings = { ...settings, language, theme, colorTheme };

  useTheme(theme, colorTheme);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'spending' | 'settings'>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const stored = window.localStorage.getItem('subm.activeTab');
    if (stored === 'dashboard' || stored === 'list' || stored === 'spending' || stored === 'settings') {
      return stored;
    }
    return 'dashboard';
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailSubscription = subscriptions.find(sub => sub.id === detailId);
  const [editingDraft, setEditingDraft] = useState<SubscriptionEdit | null>(null);
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
    setDetailId(null);
    clearMutationError();
    setEditingDraft(beginSubscriptionEdit(sub));
    setIsModalOpen(true);
  };

  const handleSaveWrapper = async (sub: Subscription) => {
    const saved = await saveSubscription(sub, editingDraft);
    if (saved) setEditingDraft(null);
    return saved;
  };

  const openAddModal = () => {
    clearMutationError();
    setEditingDraft(null);
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

  const handleSettingsUpdate = (patch: SettingsUpdate) => {
    if (patch.language !== undefined) setLanguage(patch.language);
    if (patch.theme !== undefined) setTheme(patch.theme);
    if (patch.colorTheme !== undefined) setColorTheme(patch.colorTheme);
    const editable = pickEditableSettings(patch);
    return Object.keys(editable).length ? updateSettings(editable) : Promise.resolve(true);
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
        kind: 'save' as const,
        type: 'error' as const,
        log: lastMutationError instanceof RevisionConflictError
          ? (language === 'zh' ? '数据已在其他位置更新，本次保存已停止。请保留需要的草稿内容，关闭编辑框后重新打开，核对最新数据再保存。' : 'Data changed elsewhere; saving stopped. Keep any draft text you need, then reopen the editor and review the latest data before saving.')
          : lastMutationError instanceof Error
          ? lastMutationError.message
          : String(lastMutationError),
      }
    : null;
  const visibleAlert = refreshAlert
    ? { kind: 'refresh' as const, ...refreshAlert }
    : mutationAlert;

  // Nav Configuration
  const navTabs = [
    { id: 'dashboard', icon: Home, label: t('dashboard') },
    { id: 'list', icon: CreditCard, label: t('subscriptions') },
    { id: 'spending', icon: BarChart3, label: t('spending') },
    { id: 'settings', icon: SettingsIcon, label: t('settings') },
  ] as const;


  if (isLoadingAuth) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="eyebrow mb-3">Subm</div>
          <p className="page-copy text-sm">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLogin={login}
        lang={language}
        toggleLanguage={toggleLanguage}
      />
    );
  }

  if (!hasLoadedData) {
    return <div className="app-shell flex min-h-screen items-center justify-center">
      {loadError ? <div role="alert"><p>{t('connection_failed')}</p>
        <button disabled={isDataLoading} onClick={() => void loadRemoteData()}>{language === 'zh' ? '重试加载' : 'Retry loading'}</button>
      </div> : <p>{t('loading')}</p>}
    </div>;
  }


  return (
    <div
      className="app-shell min-h-screen bg-transparent flex flex-col transition-colors duration-200"
      style={{ '--panel-opacity': `${clientSettings.wallpaper.panelOpacity}%` } as React.CSSProperties}
    >

      {clientSettings.wallpaper.url && (
        <div className="app-wallpaper" aria-hidden="true">
          <div
            className="app-wallpaper-image"
            style={{
              backgroundImage: `url(${JSON.stringify(clientSettings.wallpaper.url)})`,
              filter: `blur(${clientSettings.wallpaper.blur}px)`,
            }}
          />
          <div className="app-wallpaper-mask" style={{ opacity: clientSettings.wallpaper.overlay / 100 }} />
        </div>
      )}

      <a href="#main-content" className="skip-link">{language === 'zh' ? '跳转到主要内容' : 'Skip to main content'}</a>
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
        onAddSubscription={openAddModal}
        t={t}
      />

      {/* Main Content */}
      <main id="main-content" tabIndex={-1} data-page={activeTab} className="app-main mx-auto w-full max-w-[1440px] flex-1 px-4 pb-28 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pt-10">
        <Suspense fallback={<div className="py-16 text-center text-gray-500">{language === 'zh' ? '加载中…' : 'Loading…'}</div>}>
        <div className="animate-fade-in">
          {activeTab === 'dashboard' && (
            <Dashboard
              subscriptions={subscriptions}
              lang={language}
              settings={clientSettings}
              serverClock={serverClock}
              onView={(sub) => setDetailId(sub.id)}
              onNavigate={setActiveTab}
            />
          )}

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
              onView={(sub) => setDetailId(sub.id)}
              onAdd={openAddModal}
            />
          )}

          {activeTab === 'spending' && <SpendingStats subscriptions={subscriptions} settings={clientSettings} lang={language} serverClock={serverClock} />}

          {activeTab === 'settings' && (
            <Settings
              settings={clientSettings}
              onUpdateSettings={handleSettingsUpdate}
              onApplyRemoteSettings={applyRemoteSettings}
            />
          )}
        </div>
        </Suspense>
      </main>

      <Suspense fallback={null}>
      {detailSubscription && <SubscriptionDetails subscription={detailSubscription} settings={clientSettings} onClose={() => setDetailId(null)} onEdit={handleEditSubscription} />}
      {isModalOpen && <SubscriptionForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveWrapper}
        initialData={editingDraft?.subscription}
        settings={clientSettings}
        lang={language}
      />}
      </Suspense>

      <MobileNav
        navTabs={navTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Global Modals */}
      {visibleAlert && (
        <ModalDialog wide role="alertdialog"
          title={t(visibleAlert.type === 'success' ? 'refresh_success' : visibleAlert.kind === 'save' ? 'save_failed' : 'refresh_failed')}
          onClose={() => { setRefreshAlert(null); clearMutationError(); }}
          icon={<div className={`rounded-xl p-3 ${visibleAlert.type === 'success' ? 'bg-[var(--rail-teal-soft)] text-[var(--rail-teal-ink)]' : 'bg-[var(--alert-coral-soft)] text-[var(--alert-coral)]'}`}>
            {visibleAlert.type === 'success' ? <CheckCircle size={30} /> : <AlertTriangle size={30} />}
          </div>}
          actions={<button onClick={() => { setRefreshAlert(null); clearMutationError(); }} className="primary-action w-full rounded-xl py-2.5 font-medium">{t('close')}</button>}>
          {visibleAlert.type === 'error' && <pre className="max-h-64 overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-left text-xs leading-5 text-[var(--alert-coral)] whitespace-pre-wrap break-words">{visibleAlert.log}</pre>}
        </ModalDialog>
      )}

      {isLogoutModalOpen && (
        <ModalDialog title={t('logout')} onClose={() => setIsLogoutModalOpen(false)}
          icon={<div className="rounded-xl bg-[var(--alert-coral-soft)] p-3 text-[var(--alert-coral)]"><LogOut size={30} /></div>}
          actions={<div className="flex gap-3">
            <button onClick={() => setIsLogoutModalOpen(false)} className="secondary-action flex-1 rounded-xl py-2.5 font-medium">{t('cancel')}</button>
            <button onClick={handleLogoutConfirm} className="flex-1 rounded-xl bg-red-600 py-2.5 font-medium text-white hover:bg-red-700">{t('logout')}</button>
          </div>}>
          <p>{t('confirm_logout')}</p>
        </ModalDialog>
      )}
    </div>
  );
};

export default App;
