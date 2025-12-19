import React from 'react';
import { Plus, Globe, Clock, Sun, Moon, Monitor, X as XIcon } from 'lucide-react';
import { AppSettings, COMMON_TIMEZONES } from '../../../types';
import { CategoryGlyph, PaymentGlyph } from '../../ui/glyphs';
import { displayCategoryLabel, displayPaymentMethodLabel } from '../../../services/displayLabels';

type Props = {
  t: (key: any) => string;
  currentLanguage: 'en' | 'zh';
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;

  newCategory: string;
  setNewCategory: React.Dispatch<React.SetStateAction<string>>;
  newPayment: string;
  setNewPayment: React.Dispatch<React.SetStateAction<string>>;

  categories: string[];
  payments: string[];

  dragCatIndex: number | null;
  setDragCatIndex: React.Dispatch<React.SetStateAction<number | null>>;
  dragPayIndex: number | null;
  setDragPayIndex: React.Dispatch<React.SetStateAction<number | null>>;

  handleAddCategory: () => void;
  handleAddPayment: () => void;
  handleCategoryDragStart: (index: number) => void;
  handleCategoryDrop: (index: number) => void;
  handlePaymentDragStart: (index: number) => void;
  handlePaymentDrop: (index: number) => void;
};

const GeneralTab: React.FC<Props> = ({
  t,
  currentLanguage,
  settings,
  onUpdateSettings,
  newCategory,
  setNewCategory,
  newPayment,
  setNewPayment,
  categories,
  payments,
  dragCatIndex,
  setDragCatIndex,
  dragPayIndex,
  setDragPayIndex,
  handleAddCategory,
  handleAddPayment,
  handleCategoryDragStart,
  handleCategoryDrop,
  handlePaymentDragStart,
  handlePaymentDrop,
}) => {
  return (
    <div className="space-y-8 max-w-2xl">
      <section>
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('language')}</h3>
        <div className="flex space-x-4">
          <button
            onClick={() => onUpdateSettings({ ...settings, language: 'zh' })}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
              settings.language === 'zh'
                ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-white'
                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
            }`}
          >
            <Globe size={16} />
            <span>简体中文</span>
          </button>
          <button
            onClick={() => onUpdateSettings({ ...settings, language: 'en' })}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
              settings.language === 'en'
                ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-white'
                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
            }`}
          >
            <Globe size={16} />
            <span>English</span>
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('timezone')}</h3>
        <div className="flex items-center space-x-2 max-w-xs">
          <Clock className="text-gray-500" size={20} />
          <select
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg outline-none"
            value={settings.timezone}
            onChange={(e) => onUpdateSettings({ ...settings, timezone: e.target.value })}
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
            {!COMMON_TIMEZONES.includes(settings.timezone) && (
              <option value={settings.timezone}>{settings.timezone}</option>
            )}
          </select>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('appearance')}</h3>
        <div className="flex space-x-4">
          {(['light', 'dark', 'system'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onUpdateSettings({ ...settings, theme: mode })}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
                settings.theme === mode
                  ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-white'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
              }`}
            >
              {mode === 'light' && <Sun size={16} />}
              {mode === 'dark' && <Moon size={16} />}
              {mode === 'system' && <Monitor size={16} />}
              <span className="capitalize">
                {mode === 'light' && t('theme_light')}
                {mode === 'dark' && t('theme_dark')}
                {mode === 'system' && t('theme_system')}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('categories')}</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder={currentLanguage === 'zh' ? '新增分类' : 'Add new category'}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <button
            onClick={handleAddCategory}
            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat, idx) => (
            <span
              key={cat}
              draggable
              onDragStart={() => handleCategoryDragStart(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleCategoryDrop(idx)}
              onDragEnd={() => setDragCatIndex(null)}
              className={`px-3 py-1 bg-gray-100/70 dark:bg-slate-700/60 dark:text-gray-200 rounded-full text-sm flex items-center gap-2 cursor-move select-none ${
                dragCatIndex === idx ? 'ring-2 ring-primary-400' : ''
              }`}
              title={currentLanguage === 'zh' ? '拖动调整顺序' : 'Drag to reorder'}
            >
              <CategoryGlyph category={cat} containerSize={18} size={12} />
              {displayCategoryLabel(cat, currentLanguage)}
              <button
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    customCategories: categories.filter((c) => c !== cat),
                  })
                }
                className="text-gray-400 hover:text-red-500"
              >
                <XIcon size={12} />
              </button>
            </span>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('payment_methods')}</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder={currentLanguage === 'zh' ? '新增支付方式' : 'Add payment method'}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            value={newPayment}
            onChange={(e) => setNewPayment(e.target.value)}
          />
          <button
            onClick={handleAddPayment}
            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {payments.map((pm, idx) => (
            <span
              key={pm}
              draggable
              onDragStart={() => handlePaymentDragStart(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handlePaymentDrop(idx)}
              onDragEnd={() => setDragPayIndex(null)}
              className={`px-3 py-1 bg-gray-100/70 dark:bg-slate-700/60 dark:text-gray-200 rounded-full text-sm flex items-center gap-2 cursor-move select-none ${
                dragPayIndex === idx ? 'ring-2 ring-primary-400' : ''
              }`}
              title={currentLanguage === 'zh' ? '拖动调整顺序' : 'Drag to reorder'}
            >
              <PaymentGlyph method={pm} containerSize={18} size={12} />
              {displayPaymentMethodLabel(pm, currentLanguage)}
              <button
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    customPaymentMethods: payments.filter((p) => p !== pm),
                  })
                }
                className="text-gray-400 hover:text-red-500"
              >
                <XIcon size={12} />
              </button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
};

export default GeneralTab;

