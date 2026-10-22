import React from 'react';
import {
  Globe,
  LogOut,
  Monitor,
  Moon,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Repeat2,
  Sun,
} from 'lucide-react';
import { AppSettings } from '../../types';

interface NavTab {
  id: string;
  icon: React.ElementType;
  label: string;
}

interface AppHeaderProps {
  navTabs: readonly NavTab[];
  activeTab: string;
  setActiveTab: (id: any) => void;
  isDataLoading: boolean;
  loadRemoteData: () => void;
  settings: AppSettings;
  toggleLanguage: () => void;
  toggleTheme: () => void;
  onLogoutClick: () => void;
  onAddSubscription: () => void;
  t: (key: string) => string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  navTabs,
  activeTab,
  setActiveTab,
  isDataLoading,
  loadRemoteData,
  settings,
  toggleLanguage,
  toggleTheme,
  onLogoutClick,
  onAddSubscription,
  t,
}) => {
  const canAdd = activeTab === 'dashboard' || activeTab === 'list';

  return (
    <header className="app-header sticky top-0 z-40">
      <div className="header-content mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          className="app-brand"
          aria-label={`Subm · ${t('dashboard')}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <Repeat2 size={21} aria-hidden="true" />
          <span>Subm</span>
        </button>
        <nav className="hidden min-w-0 items-center gap-1 lg:flex" aria-label="Primary navigation">
          {navTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="nav-tab flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
                data-active={active}
                aria-current={active ? 'page' : undefined}
              >
                <tab.icon size={16} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={loadRemoteData}
            className="icon-control hidden rounded-xl p-2.5 transition-colors disabled:opacity-45 lg:flex"
            title={t('refresh_rates')}
            aria-label={t('refresh_rates')}
            disabled={isDataLoading}
          >
            <RefreshCcw size={17} className={isDataLoading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={toggleLanguage}
            className="icon-control hidden rounded-xl p-2.5 transition-colors lg:flex"
            title={t('language')}
            aria-label={t('language')}
          >
            <Globe size={17} />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="icon-control rounded-xl p-2.5 transition-colors"
            title={t('appearance')}
            aria-label={t('appearance')}
          >
            {settings.theme === 'dark' ? (
              <Moon size={17} />
            ) : settings.theme === 'system' ? (
              <Monitor size={17} />
            ) : (
              <Sun size={17} />
            )}
          </button>

          {canAdd && (
            <button
              type="button"
              onClick={onAddSubscription}
              aria-label={t('add_new')}
              className="primary-action ml-1 flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition sm:px-4"
            >
              <Plus size={17} />
              <span className="hidden sm:inline">{t('add_new')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLogoutClick}
            className="icon-control ml-0.5 hidden rounded-xl p-2.5 transition-colors lg:flex"
            title={t('logout')}
            aria-label={t('logout')}
          >
            <LogOut size={17} />
          </button>
          <details
            className="mobile-utility-menu lg:hidden"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.currentTarget.removeAttribute('open');
                event.currentTarget.querySelector('summary')?.focus();
              }
            }}
          >
            <summary aria-label={t('actions')} className="icon-control">
              <MoreHorizontal size={21} aria-hidden="true" />
            </summary>
            <div className="utility-popover">
              <button
                type="button"
                aria-label={t('refresh_rates')}
                disabled={isDataLoading}
                onClick={(event) => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  void loadRemoteData();
                }}
              >
                <RefreshCcw size={17} aria-hidden="true" />
                {t('refresh_rates')}
              </button>
              <button
                type="button"
                aria-label={t('language')}
                onClick={(event) => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  toggleLanguage();
                }}
              >
                <Globe size={17} aria-hidden="true" />
                {t('language')}
              </button>
              <button
                type="button"
                aria-label={t('logout')}
                onClick={(event) => {
                  event.currentTarget.closest('details')?.removeAttribute('open');
                  onLogoutClick();
                }}
              >
                <LogOut size={17} aria-hidden="true" />
                {t('logout')}
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
};
