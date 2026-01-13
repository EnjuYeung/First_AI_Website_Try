import React from 'react';
import { WalletCards, RefreshCcw, Globe, Moon, Sun, LogOut } from 'lucide-react';
import { AppSettings } from '../../types';

interface NavTab {
    id: string;
    icon: React.ElementType;
    label: string;
}

interface AppHeaderProps {
    navTabs: readonly NavTab[]; // or NavTab[]
    activeTab: string;
    setActiveTab: (id: any) => void;

    isDataLoading: boolean;
    loadRemoteData: () => void;

    settings: AppSettings;
    toggleLanguage: () => void;
    toggleTheme: () => void;
    onLogoutClick: () => void;

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
    t
}) => {
    return (
        <header className="px-4 sm:px-6 h-16 flex items-center justify-between sticky top-0 z-20 bg-white/70 dark:bg-slate-950/50 backdrop-blur-xl border-b border-white/30 dark:border-white/10 shadow-mac-sm">
            <div className="flex items-center gap-4 sm:gap-8">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-gradient-to-br from-primary-600/90 to-indigo-500/90 text-white shadow-mac-sm ring-1 ring-white/30">
                        <WalletCards size={18} />
                    </div>
                    <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Subm</h1>
                </div>

                <nav className="hidden md:flex items-center gap-1 ml-4">
                    {navTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
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
                <button onClick={onLogoutClick} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title={t('logout')}><LogOut size={18} /></button>
            </div>
        </header>
    );
};
