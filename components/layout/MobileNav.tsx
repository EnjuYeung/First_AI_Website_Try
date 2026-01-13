import React from 'react';

interface NavTab {
    id: string;
    icon: React.ElementType;
    label: string;
}

interface MobileNavProps {
    navTabs: readonly NavTab[];
    activeTab: string;
    setActiveTab: (id: any) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ navTabs, activeTab, setActiveTab }) => {
    return (
        <nav className="fixed bottom-0 inset-x-0 z-30 md:hidden">
            <div className="px-4 pb-[env(safe-area-inset-bottom)]">
                <div className="mac-surface border border-white/40 dark:border-white/10 rounded-2xl shadow-mac-sm backdrop-blur-xl">
                    <div className="grid grid-cols-4">
                        {navTabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${isActive
                                            ? 'text-primary-600 dark:text-primary-400'
                                            : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                >
                                    <tab.icon size={18} />
                                    <span className="leading-none">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </nav>
    );
};
