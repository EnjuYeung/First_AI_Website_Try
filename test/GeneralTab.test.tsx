import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GeneralTab from '../components/settings/tabs/GeneralTab';
import { getDefaultSettings } from '../services/storageService';
import { getT } from '../services/i18n';

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
        newCategory=""
        setNewCategory={vi.fn()}
        newPayment=""
        setNewPayment={vi.fn()}
        categories={settings.customCategories}
        payments={settings.customPaymentMethods}
        dragCatIndex={null}
        setDragCatIndex={vi.fn()}
        dragPayIndex={null}
        setDragPayIndex={vi.fn()}
        handleAddCategory={vi.fn()}
        handleAddPayment={vi.fn()}
        handleCategoryDragStart={vi.fn()}
        handleCategoryDrop={vi.fn()}
        handlePaymentDragStart={vi.fn()}
        handlePaymentDrop={vi.fn()}
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
});
