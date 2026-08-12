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
        <nav className="fixed inset-x-0 bottom-0 z-30 md:hidden" aria-label="Mobile navigation">
            <div className="border-t bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl" style={{ borderColor: 'var(--line)' }}>
                <div className="mx-auto max-w-lg">
                    <div
                        className="grid"
                        style={{ gridTemplateColumns: `repeat(${navTabs.length}, minmax(0, 1fr))` }}
                    >
                        {navTabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={`relative flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-medium transition-colors ${isActive ? 'text-[var(--rail-teal)]' : 'text-[var(--muted)]'}`}
                                >
                                    {isActive && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-[var(--rail-teal)]" />}
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
