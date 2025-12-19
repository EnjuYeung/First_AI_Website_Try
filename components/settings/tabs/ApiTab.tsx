import React from 'react';
import { CheckCircle, Loader2, Save } from 'lucide-react';
import { AppSettings } from '../../../types';

type Props = {
  t: (key: any) => string;
  currentLanguage: 'en' | 'zh';
  settings: AppSettings;

  exchangeApiKey: string;
  setExchangeApiKey: React.Dispatch<React.SetStateAction<string>>;
  isSavingExchangeApi: boolean;
  handleSaveExchangeApiKey: (alsoTest: boolean) => void;
};

const ApiTab: React.FC<Props> = ({
  t,
  currentLanguage,
  settings,
  exchangeApiKey,
  setExchangeApiKey,
  isSavingExchangeApi,
  handleSaveExchangeApiKey,
}) => {
  return (
    <div className="space-y-6 max-w-2xl">
      <section>
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">ExchangeRate-API</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          URL: https://v6.exchangerate-api.com/v6/YOUR-API-KEY/latest/USD
        </p>
      </section>

      <section className="p-4 border border-gray-200 dark:border-gray-600 rounded-xl space-y-3">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('api_key')}</label>
        <input
          type="password"
          placeholder="YOUR-API-KEY"
          value={exchangeApiKey}
          onChange={(e) => setExchangeApiKey(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg dark:bg-slate-700 dark:border-gray-600 dark:text-white"
        />

        <div className="flex gap-2">
          <button
            onClick={() => handleSaveExchangeApiKey(false)}
            disabled={isSavingExchangeApi || !exchangeApiKey.trim()}
            className="px-4 py-2 bg-gray-100 dark:bg-slate-600 dark:text-white rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
          >
            <Save size={16} />
            <span>{t('save')}</span>
          </button>
          <button
            onClick={() => handleSaveExchangeApiKey(true)}
            disabled={isSavingExchangeApi || !exchangeApiKey.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isSavingExchangeApi ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            <span>{t('save_and_test')}</span>
          </button>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <div>已启用：{settings.exchangeRateApi?.enabled ? '是' : '否'}</div>
          <div>
            上次测试：
            {settings.exchangeRateApi?.lastTestedAt
              ? new Date(settings.exchangeRateApi.lastTestedAt).toLocaleString(
                  currentLanguage === 'zh' ? 'zh-CN' : 'en-US'
                )
              : '-'}
          </div>
          <div>
            上次自动(0时)：
            {settings.exchangeRateApi?.lastRunAt0
              ? new Date(settings.exchangeRateApi.lastRunAt0).toLocaleString(
                  currentLanguage === 'zh' ? 'zh-CN' : 'en-US'
                )
              : '-'}
          </div>
          <div>
            上次自动(12时)：
            {settings.exchangeRateApi?.lastRunAt12
              ? new Date(settings.exchangeRateApi.lastRunAt12).toLocaleString(
                  currentLanguage === 'zh' ? 'zh-CN' : 'en-US'
                )
              : '-'}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ApiTab;

