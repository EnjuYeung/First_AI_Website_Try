import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Globe, Image, Link2, Monitor, Moon, Palette, Plus, Sun, Trash2, Upload, X as XIcon } from 'lucide-react';
import { AppSettings, SettingsUpdate } from '../../../types';
import { CategoryGlyph, PaymentGlyph } from '../../ui/glyphs';
import { canonicalCategoryKey, canonicalPaymentMethodKey, displayCategoryLabel, displayPaymentMethodLabel } from '../../../services/displayLabels';
import { deleteUploadedWallpaper, uploadWallpaperFile } from '../../../services/storageService';

type Props = {
  t: (key: any) => string;
  currentLanguage: 'en' | 'zh';
  settings: AppSettings;
  onUpdateSettings: (patch: SettingsUpdate) => boolean | Promise<boolean>;
};

const reorder = (list: string[], from: number, to: number) => {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

const GeneralTab: React.FC<Props> = ({
  t,
  currentLanguage,
  settings,
  onUpdateSettings,
}) => {
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const [newCategory, setNewCategory] = useState('');
  const [newPayment, setNewPayment] = useState('');
  const [dragCatIndex, setDragCatIndex] = useState<number | null>(null);
  const [dragPayIndex, setDragPayIndex] = useState<number | null>(null);
  const categories = settings.customCategories;
  const payments = settings.customPaymentMethods;

  const handleAddCategory = () => {
    const value = canonicalCategoryKey(newCategory);
    if (value && !categories.some((item) => canonicalCategoryKey(item).toLowerCase() === value.toLowerCase())) {
      onUpdateSettings({ customCategories: [...categories, value] });
      setNewCategory('');
    }
  };

  const handleAddPayment = () => {
    const value = canonicalPaymentMethodKey(newPayment);
    if (value && !payments.some((item) => canonicalPaymentMethodKey(item).toLowerCase() === value.toLowerCase())) {
      onUpdateSettings({ customPaymentMethods: [...payments, value] });
      setNewPayment('');
    }
  };
  const [wallpaperDraft, setWallpaperDraft] = useState(settings.wallpaper);
  const [isUploadingWallpaper, setIsUploadingWallpaper] = useState(false);
  const [wallpaperError, setWallpaperError] = useState('');
  const previousWallpaper = useRef(settings.wallpaper);

  useEffect(() => {
    const previous = previousWallpaper.current;
    previousWallpaper.current = settings.wallpaper;
    setWallpaperDraft(current => ({
      url: current.url === previous.url ? settings.wallpaper.url : current.url,
      blur: current.blur === previous.blur ? settings.wallpaper.blur : current.blur,
      overlay: current.overlay === previous.overlay ? settings.wallpaper.overlay : current.overlay,
      panelOpacity: current.panelOpacity === previous.panelOpacity ? settings.wallpaper.panelOpacity : current.panelOpacity,
    }));
  }, [settings.wallpaper]);

  const saveWallpaper = async (wallpaper: Partial<AppSettings['wallpaper']>) => {
    const saved = await onUpdateSettings({ wallpaper });
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
    setWallpaperDraft(current => ({ ...current, url }));
    await saveWallpaper({ url });
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
      setWallpaperDraft(current => ({ ...current, url: uploadedUrl }));
      const saved = await saveWallpaper({ url: uploadedUrl });
      if (!saved) await deleteUploadedWallpaper(uploadedUrl).catch(() => undefined);
    } catch {
      if (uploadedUrl) await deleteUploadedWallpaper(uploadedUrl).catch(() => undefined);
      setWallpaperError(t('wallpaper_upload_failed'));
    } finally {
      setIsUploadingWallpaper(false);
    }
  };

  const commitWallpaperControls = () => {
    const patch = Object.fromEntries(
      (['blur', 'overlay', 'panelOpacity'] as const)
        .filter(key => wallpaperDraft[key] !== settings.wallpaper[key])
        .map(key => [key, wallpaperDraft[key]])
    );
    if (Object.keys(patch).length) void saveWallpaper(patch);
  };

  const wallpaperImage = wallpaperDraft.url
    ? `url(${JSON.stringify(wallpaperDraft.url)})`
    : undefined;

  return (
    <div className="settings-bento-grid">
      <section className="settings-card settings-language">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('language')}</h3>
        <div className="flex space-x-4">
          <button
            onClick={() => onUpdateSettings({ language: 'zh' })}
            aria-pressed={settings.language === 'zh'}
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
            onClick={() => onUpdateSettings({ language: 'en' })}
            aria-pressed={settings.language === 'en'}
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

      <section className="settings-card">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-[var(--ink)]">{t('appearance')}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('color_theme_hint')}</p>
          </div>
          <Palette className="mt-1 shrink-0 text-[var(--rail-teal)]" size={20} />
        </div>
        <div className="appearance-modes" role="group" aria-label={t('appearance')}>
          {([
            { id: 'light', Icon: Sun, label: currentLanguage === 'zh' ? '浅色' : 'Light' },
            { id: 'dark', Icon: Moon, label: currentLanguage === 'zh' ? '深色' : 'Dark' },
            { id: 'system', Icon: Monitor, label: currentLanguage === 'zh' ? '跟随系统' : 'System' },
          ] as const).map(({ id, Icon, label }) => (
            <button key={id} type="button" aria-pressed={settings.theme === id} onClick={() => onUpdateSettings({ theme: id })}>
              <Icon size={15} aria-hidden="true" />{label}
            </button>
          ))}
        </div>
        <h4 className="mb-3 text-sm font-semibold text-[var(--ink-soft)]">{t('color_theme')}</h4>
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
                onClick={() => onUpdateSettings({ colorTheme: id })}
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

      <section className="settings-card wallpaper-settings">
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
              aria-label={t('wallpaper') + ' URL'}
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
            onClick={() => {
              setWallpaperDraft(current => ({ ...current, url: '' }));
              void saveWallpaper({ url: '' });
            }}
            className="mt-4 flex items-center gap-2 text-sm font-medium text-[var(--alert-coral)]"
          >
            <Trash2 size={15} />{t('remove_wallpaper')}
          </button>
        )}
      </section>

      <section className="settings-card">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('categories')}</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            aria-label={t('add_category')}
            placeholder={t('add_category')}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <button
            onClick={handleAddCategory}
            aria-label={t('add_category')}
            className="primary-action rounded-lg p-2"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat, idx) => (
            <span
              key={cat}
              role="group"
              aria-label={displayCategoryLabel(cat, currentLanguage)}
              draggable
              onDragStart={() => setDragCatIndex(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragCatIndex !== null && dragCatIndex !== idx) {
                  onUpdateSettings({ customCategories: reorder(categories, dragCatIndex, idx) });
                }
                setDragCatIndex(null);
              }}
              onDragEnd={() => setDragCatIndex(null)}
              className={`preference-item text-sm flex items-center gap-2 cursor-move select-none ${
                dragCatIndex === idx ? 'ring-2 ring-primary-400' : ''
              }`}
              title={t('drag_to_reorder')}
            >
              <CategoryGlyph category={cat} containerSize={18} size={12} />
              <span className="min-w-0 flex-1">{displayCategoryLabel(cat, currentLanguage)}</span>
              <button type="button" className="preference-control" disabled={idx === 0} aria-label={`${currentLanguage === 'zh' ? '上移' : 'Move up'} ${displayCategoryLabel(cat, currentLanguage)}`} onClick={() => onUpdateSettings({ customCategories: reorder(categories, idx, idx - 1) })}><ChevronUp size={14} aria-hidden="true" /></button>
              <button type="button" className="preference-control" disabled={idx === categories.length - 1} aria-label={`${currentLanguage === 'zh' ? '下移' : 'Move down'} ${displayCategoryLabel(cat, currentLanguage)}`} onClick={() => onUpdateSettings({ customCategories: reorder(categories, idx, idx + 1) })}><ChevronDown size={14} aria-hidden="true" /></button>
              <button
                aria-label={`${t('remove')} ${displayCategoryLabel(cat, currentLanguage)}`}
                disabled={categories.length <= 1}
                onClick={() =>
                  onUpdateSettings({
                    customCategories: categories.filter((c) => c !== cat),
                  })
                }
                className="preference-control preference-remove"
              >
                <XIcon size={12} />
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{t('payment_methods')}</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            aria-label={t('add_payment_method')}
            placeholder={t('add_payment_method')}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            value={newPayment}
            onChange={(e) => setNewPayment(e.target.value)}
          />
          <button
            onClick={handleAddPayment}
            aria-label={t('add_payment_method')}
            className="primary-action rounded-lg p-2"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {payments.map((pm, idx) => (
            <span
              key={pm}
              role="group"
              aria-label={displayPaymentMethodLabel(pm, currentLanguage)}
              draggable
              onDragStart={() => setDragPayIndex(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragPayIndex !== null && dragPayIndex !== idx) {
                  onUpdateSettings({ customPaymentMethods: reorder(payments, dragPayIndex, idx) });
                }
                setDragPayIndex(null);
              }}
              onDragEnd={() => setDragPayIndex(null)}
              className={`preference-item text-sm flex items-center gap-2 cursor-move select-none ${
                dragPayIndex === idx ? 'ring-2 ring-primary-400' : ''
              }`}
              title={t('drag_to_reorder')}
            >
              <PaymentGlyph method={pm} containerSize={18} size={12} />
              <span className="min-w-0 flex-1">{displayPaymentMethodLabel(pm, currentLanguage)}</span>
              <button type="button" className="preference-control" disabled={idx === 0} aria-label={`${currentLanguage === 'zh' ? '上移' : 'Move up'} ${displayPaymentMethodLabel(pm, currentLanguage)}`} onClick={() => onUpdateSettings({ customPaymentMethods: reorder(payments, idx, idx - 1) })}><ChevronUp size={14} aria-hidden="true" /></button>
              <button type="button" className="preference-control" disabled={idx === payments.length - 1} aria-label={`${currentLanguage === 'zh' ? '下移' : 'Move down'} ${displayPaymentMethodLabel(pm, currentLanguage)}`} onClick={() => onUpdateSettings({ customPaymentMethods: reorder(payments, idx, idx + 1) })}><ChevronDown size={14} aria-hidden="true" /></button>
              <button
                aria-label={`${t('remove')} ${displayPaymentMethodLabel(pm, currentLanguage)}`}
                disabled={payments.length <= 1}
                onClick={() =>
                  onUpdateSettings({
                    customPaymentMethods: payments.filter((p) => p !== pm),
                  })
                }
                className="preference-control preference-remove"
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
