import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../services/storageService', async original => ({
  ...await original<typeof import('../services/storageService')>(),
  uploadWallpaperFile: vi.fn(), deleteUploadedWallpaper: vi.fn(),
}));
import GeneralTab from '../components/settings/tabs/GeneralTab';
import { getDefaultSettings, uploadWallpaperFile } from '../services/storageService';
import { getT } from '../services/i18n';
import { applyEditableSettings } from '../shared/settingsOwnership.js';
import { SettingsUpdate } from '../types';

beforeEach(() => vi.clearAllMocks());

describe('General settings', () => {
  it('updates the palette, wallpaper URL, and panel opacity', async () => {
    const settings = getDefaultSettings();
    settings.language = 'en';
    const onUpdateSettings = vi.fn().mockResolvedValue(true);

    render(
      <GeneralTab
        t={getT('en')}
        currentLanguage="en"
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />,
    );

    expect(screen.queryByText('Timezone')).toBeNull();
    expect(screen.queryByText('Appearance')).toBeNull();
    expect(screen.getByText('Color theme')).toBeTruthy();
    expect(screen.getByText('Wallpaper')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
    expect(onUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ colorTheme: 'blue' }));

    fireEvent.change(screen.getByPlaceholderText('https://example.com/wallpaper.jpg'), {
      target: { value: 'https://images.example.test/background.webp' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({
      wallpaper: expect.objectContaining({
        url: 'https://images.example.test/background.webp',
      }),
    }));

    const panelOpacity = screen.getByLabelText('Panel opacity');
    fireEvent.change(panelOpacity, { target: { value: '68' } });
    fireEvent.blur(panelOpacity);
    expect(onUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({
      wallpaper: expect.objectContaining({ panelOpacity: 68 }),
    }));
  });

  it('saves only the changed control and preserves an unapplied URL draft', async () => {
    const save = vi.fn();
    const Page = () => {
      const [settings, setSettings] = useState(getDefaultSettings);
      return <GeneralTab settings={settings} currentLanguage="en" t={getT('en')}
        onUpdateSettings={async patch => {
          save(patch);
          setSettings(current => applyEditableSettings(current, patch));
          return true;
        }} />;
    };
    render(<Page />);
    const url = screen.getByPlaceholderText('https://example.com/wallpaper.jpg');
    fireEvent.change(url, { target: { value: 'https://example.test/unapplied.png' } });
    const blur = screen.getByLabelText('Background blur');
    fireEvent.change(blur, { target: { value: '6' } });
    fireEvent.blur(blur);
    await waitFor(() => expect(save).toHaveBeenCalledWith({ wallpaper: { blur: 6 } }));
    expect((url as HTMLInputElement).value).toBe('https://example.test/unapplied.png');
  });

  it('keeps control changes made while a wallpaper upload is pending', async () => {
    let finishUpload!: (url: string) => void;
    vi.mocked(uploadWallpaperFile).mockReturnValue(new Promise(resolve => { finishUpload = resolve; }));
    const save = vi.fn();
    let latest = getDefaultSettings();
    const Page = () => {
      const [settings, setSettings] = useState(latest);
      latest = settings;
      return <GeneralTab settings={settings} currentLanguage="en" t={getT('en')}
        onUpdateSettings={async (patch: SettingsUpdate) => {
          save(patch);
          setSettings(current => applyEditableSettings(current, patch));
          return true;
        }} />;
    };
    const { container } = render(<Page />);
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['synthetic image'], 'wall.png', { type: 'image/png' })] },
    });
    const blur = screen.getByLabelText('Background blur');
    fireEvent.change(blur, { target: { value: '6' } });
    fireEvent.blur(blur);
    await waitFor(() => expect(latest.wallpaper.blur).toBe(6));
    await act(async () => { finishUpload('/api/uploads/wallpaper-aabb.png'); });
    await waitFor(() => expect(latest.wallpaper.url).toBe('/api/uploads/wallpaper-aabb.png'));
    expect(latest.wallpaper.blur).toBe(6);
    expect((blur as HTMLInputElement).value).toBe('6');
    expect(save).toHaveBeenLastCalledWith({ wallpaper: { url: '/api/uploads/wallpaper-aabb.png' } });
  });
});
