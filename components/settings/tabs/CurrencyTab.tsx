import React from 'react';
import { Plus, RefreshCw, Search, X as XIcon } from 'lucide-react';
import { AppSettings, CurrencyConfig } from '../../../types';

type Props = {
  t: (key: any) => string;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;

  currencySearch: string;
  setCurrencySearch: React.Dispatch<React.SetStateAction<string>>;
  showCurrencyDropdown: boolean;
  setShowCurrencyDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  filteredCurrencies: CurrencyConfig[];

  isUpdatingRates: boolean;
  handleManualUpdateRates: () => void;
  formatLastUpdated: (timestamp: number) => string;
};

const CurrencyTab: React.FC<Props> = ({
  t,
  settings,
  onUpdateSettings,
  currencySearch,
  setCurrencySearch,
  showCurrencyDropdown,
  setShowCurrencyDropdown,
  filteredCurrencies,
  isUpdatingRates,
  handleManualUpdateRates,
  formatLastUpdated,
}) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <div className="xl:col-span-5 space-y-6">
        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-5 border border-gray-200 dark:border-gray-600">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <RefreshCw size={18} className="text-blue-500" />
              <h3 className="font-bold text-gray-800 dark:text-white text-sm">
                {t('realtime_rates')} ({t('base_usd')})
              </h3>
            </div>
            <button
              onClick={handleManualUpdateRates}
              disabled={isUpdatingRates}
              className="p-2 bg-white dark:bg-slate-600 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-slate-500 rounded-lg transition-all shadow-sm disabled:opacity-50"
              title={t('refresh_rates')}
            >
              <RefreshCw size={16} className={isUpdatingRates ? 'animate-spin text-primary-600' : ''} />
            </button>
          </div>

          <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto pr-1">
            {settings.customCurrencies
              .filter((c) => c.code !== 'USD')
              .map((c) => (
                <div
                  key={c.code}
                  className="flex items-center justify-between p-3 mac-surface-soft rounded-lg border border-gray-100 dark:border-gray-600"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-800 dark:text-white">{c.code}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{c.name}</span>
                  </div>
                  <span className="text-lg font-mono font-medium text-gray-700 dark:text-gray-200">
                    {settings.exchangeRates[c.code]?.toFixed(4) || '-.--'}
                  </span>
                </div>
              ))}
            {settings.customCurrencies.filter((c) => c.code !== 'USD').length === 0 && (
              <div className="text-center py-6 text-gray-400 text-sm">Add currencies to see rates.</div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-600 pt-3">
            <span>
              {t('last_updated')}: {formatLastUpdated(settings.lastRatesUpdate)}
            </span>
          </div>
        </div>
      </div>

      <div className="xl:col-span-7 space-y-6">
        <div className="mac-surface rounded-xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm h-full flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('manage_currencies')}</h3>

          <div className="relative mb-6">
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary-500 transition-all">
              <Search size={20} className="text-gray-400" />
              <input
                type="text"
                placeholder={t('search_currency')}
                className="flex-1 bg-transparent outline-none dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm"
                value={currencySearch}
                onChange={(e) => setCurrencySearch(e.target.value)}
                onFocus={() => setShowCurrencyDropdown(true)}
                onBlur={() => setTimeout(() => setShowCurrencyDropdown(false), 200)}
              />
            </div>

            {showCurrencyDropdown && currencySearch && (
              <div className="absolute z-10 w-full mt-2 mac-surface border border-gray-100 dark:border-gray-600 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-fade-in">
                {filteredCurrencies.length > 0 ? (
                  filteredCurrencies.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => {
                        onUpdateSettings({
                          ...settings,
                          customCurrencies: [...settings.customCurrencies, c],
                        });
                        setCurrencySearch('');
                      }}
                      className="w-full text-left px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-between transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800 dark:text-white text-sm">{c.code}</span>
                      </div>
                      <div className="w-6 h-6 bg-primary-50 dark:bg-slate-600 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400">
                        <Plus size={14} />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">No matches found</div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {t('supported_currencies')} ({settings.customCurrencies.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {settings.customCurrencies.map((c) => (
                <div
                  key={c.code}
                  className="group flex items-center gap-2 pl-3 pr-2 py-1.5 bg-gray-50 hover:bg-white dark:bg-slate-700/50 dark:hover:bg-slate-700 border border-gray-200 hover:border-primary-200 dark:border-gray-600 dark:hover:border-primary-500/50 rounded-lg transition-all shadow-sm hover:shadow-md"
                >
                  <span className="text-sm font-bold text-gray-800 dark:text-white leading-none">{c.code}</span>
                  {c.code !== 'USD' && (
                    <button
                      onClick={() =>
                        onUpdateSettings({
                          ...settings,
                          customCurrencies: settings.customCurrencies.filter((cur) => cur.code !== c.code),
                        })
                      }
                      className="ml-1 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                    >
                      <XIcon size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrencyTab;

