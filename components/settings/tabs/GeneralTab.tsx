import React, { useEffect, useRef, useState } from 'react';
import { Check, Globe, Image, Link2, Palette, Plus, Trash2, Upload, X as XIcon } from 'lucide-react';
import { AppSettings } from '../../../types';
import { CategoryGlyph, PaymentGlyph } from '../../ui/glyphs';
import { displayCategoryLabel, displayPaymentMethodLabel } from '../../../services/displayLabels';
import { deleteUploadedWallpaper, uploadWallpaperFile } from '../../../services/storageService';

type Props = {
  t: (key: any) => string;
  currentLanguage: 'en' | 'zh';
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => boolean | Promise<boolean>;

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
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const [wallpaperDraft, setWallpaperDraft] = useState(settings.wallpaper);
  const [isUploadingWallpaper, setIsUploadingWallpaper] = useState(false);
  const [wallpaperError, setWallpaperError] = useState('');

  useEffect(() => setWallpaperDraft(settings.wallpaper), [settings.wallpaper]);

  const saveWallpaper = async (wallpaper: AppSettings['wallpaper']) => {
    const saved = await onUpdateSettings({ ...settings, wallpaper });
    if (saved !== false) setWallpaperDraft(wallpaper);
    return saved !== false;
  };

  const applyWallpaperUrl = async () => {
    const url = wallpaperDraft.url.trim();
    if (url && !/^\/api\/uploads\/wallpaper-[a-f0-9-]+\.(?:png|jpg|webp)$/i.test(url)) {
      try {
        const parsed = new URL(url);
        if (
          !['http:', 'https:'].includes(parsed.protocol) ||
          !parsed.hostname || parsed.username || parsed.password
        ) throw new Error('invalid_protocol');
      } catch {
        setWallpaperError(t('wallpaper_url_invalid'));
        return;
      }
    }
    setWallpaperError('');
    await saveWallpaper({ ...wallpaperDraft, url });
  };

  const handleWallpaperUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setWallpaperError(t('wallpaper_type_error'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setWallpaperError(t('wallpaper_size_error'));
      return;
    }

    setIsUploadingWallpaper(true);
    setWallpaperError('');
    let uploadedUrl = '';
    try {
      uploadedUrl = await uploadWallpaperFile(file);
      const saved = await saveWallpaper({ ...wallpaperDraft, url: uploadedUrl });
      if (!saved) await deleteUploadedWallpaper(uploadedUrl).catch(() => undefined);
    } catch {
      if (uploadedUrl) await deleteUploadedWallpaper(uploadedUrl).catch(() => undefined);
      setWallpaperError(t('wallpaper_upload_failed'));
    } finally {
      setIsUploadingWallpaper(false);
    }
  };

  const commitWallpaperControls = () => {
    if (
      wallpaperDraft.blur === settings.wallpaper.blur &&
      wallpaperDraft.overlay === settings.wallpaper.overlay &&
      wallpaperDraft.panelOpacity === settings.wallpaper.panelOpacity
    ) return;
    void saveWallpaper(wallpaperDraft);
  };

  const wallpaperImage = wallpaperDraft.url
    ? `url(${JSON.stringify(wallpaperDraft.url)})`
    : undefined;

  return (
    <div className="max-w-2xl space-y-8">
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
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[var(--ink)]">{t('color_theme')}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('color_theme_hint')}</p>
          </div>
          <Palette className="mt-1 shrink-0 text-[var(--rail-teal)]" size={20} />
        </div>
        <div className="theme-choice-grid" role="group" aria-label={t('color_theme')}>
          {([
            { id: 'default', swatches: ['#267a76', '#d7a33d', '#d65f50'] },
            { id: 'blue', swatches: ['#2563eb', '#60a5fa', '#dbeafe'] },
            { id: 'violet', swatches: ['#7c3aed', '#a78bfa', '#ede9fe'] },
            { id: 'rose', swatches: ['#e11d48', '#fb7185', '#ffe4e6'] },
          ] as const).map(({ id, swatches }) => {
            const selected = settings.colorTheme === id;
            return (
              <button
                key={id}
                type="button"
                className="theme-choice"
                data-active={selected}
                aria-pressed={selected}
                onClick={() => onUpdateSettings({ ...settings, colorTheme: id })}
              >
                <span className="theme-choice-preview" data-theme-preview={id} aria-hidden="true">
                  <i />
                  <b />
                  <em />
                </span>
                <span className="theme-choice-label">
                  <span>{t(`color_theme_${id}`)}</span>
                  {selected && <Check size={15} aria-label={t('selected')} />}
                </span>
                <span className="theme-choice-swatches" aria-hidden="true">
                  {swatches.map((color) => <i key={color} style={{ background: color }} />)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="wallpaper-settings">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[var(--ink)]">{t('wallpaper')}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('wallpaper_hint')}</p>
          </div>
          <Image className="mt-1 shrink-0 text-[var(--rail-teal)]" size={20} />
        </div>

        <div className="wallpaper-preview" data-empty={!wallpaperDraft.url}>
          <div
            className="wallpaper-preview-image"
            style={{
              backgroundImage: wallpaperImage,
              filter: `blur(${wallpaperDraft.blur}px)`,
            }}
          />
          <div className="wallpaper-preview-mask" style={{ opacity: wallpaperDraft.overlay / 100 }} />
          {!wallpaperDraft.url && <span>{t('wallpaper_empty')}</span>}
          <div
            className="wallpaper-preview-panel"
            style={{
              background: `color-mix(in srgb, var(--surface-solid) ${wallpaperDraft.panelOpacity}%, transparent)`,
            }}
            aria-hidden="true"
          >
            <i /><span /><span />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
            <input
              type="url"
              value={wallpaperDraft.url}
              onChange={(event) => setWallpaperDraft({ ...wallpaperDraft, url: event.target.value })}
              onKeyDown={(event) => { if (event.key === 'Enter') void applyWallpaperUrl(); }}
              placeholder={t('wallpaper_url_placeholder')}
              className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none"
            />
          </div>
          <button type="button" onClick={() => void applyWallpaperUrl()} className="secondary-action rounded-xl px-4 py-2.5 text-sm font-semibold">
            {t('apply')}
          </button>
          <button
            type="button"
            onClick={() => wallpaperInputRef.current?.click()}
            disabled={isUploadingWallpaper}
            className="secondary-action flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            <Upload size={16} />
            {isUploadingWallpaper ? t('uploading') : t('upload_wallpaper')}
          </button>
          <input
            ref={wallpaperInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleWallpaperUpload}
          />
        </div>

        {wallpaperError && <p role="alert" className="mt-2 text-sm text-[var(--alert-coral)]">{wallpaperError}</p>}

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="wallpaper-control">
            <span><b>{t('background_blur')}</b><i>{wallpaperDraft.blur}px</i></span>
            <input
              type="range" min="0" max="30" step="1" value={wallpaperDraft.blur}
              aria-label={t('background_blur')}
              onChange={(event) => setWallpaperDraft({ ...wallpaperDraft, blur: Number(event.target.value) })}
              onPointerUp={commitWallpaperControls} onKeyUp={commitWallpaperControls} onBlur={commitWallpaperControls}
            />
          </label>
          <label className="wallpaper-control">
            <span><b>{t('background_overlay')}</b><i>{wallpaperDraft.overlay}%</i></span>
            <input
              type="range" min="0" max="90" step="1" value={wallpaperDraft.overlay}
              aria-label={t('background_overlay')}
              onChange={(event) => setWallpaperDraft({ ...wallpaperDraft, overlay: Number(event.target.value) })}
              onPointerUp={commitWallpaperControls} onKeyUp={commitWallpaperControls} onBlur={commitWallpaperControls}
            />
          </label>
          <label className="wallpaper-control">
            <span><b>{t('settings_panel_opacity')}</b><i>{wallpaperDraft.panelOpacity}%</i></span>
            <input
              type="range" min="35" max="100" step="1" value={wallpaperDraft.panelOpacity}
              aria-label={t('settings_panel_opacity')}
              onChange={(event) => setWallpaperDraft({ ...wallpaperDraft, panelOpacity: Number(event.target.value) })}
              onPointerUp={commitWallpaperControls} onKeyUp={commitWallpaperControls} onBlur={commitWallpaperControls}
            />
          </label>
        </div>

        {wallpaperDraft.url && (
          <button
            type="button"
            onClick={() => void saveWallpaper({ ...wallpaperDraft, url: '' })}
            className="mt-4 flex items-center gap-2 text-sm font-medium text-[var(--alert-coral)]"
          >
            <Trash2 size={15} />{t('remove_wallpaper')}
          </button>
        )}
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
                disabled={categories.length <= 1}
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    customCategories: categories.filter((c) => c !== cat),
                  })
                }
                className="text-gray-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-gray-400"
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
                disabled={payments.length <= 1}
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    customPaymentMethods: payments.filter((p) => p !== pm),
                  })
                }
                className="text-gray-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-gray-400"
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
