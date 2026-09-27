import { describe, expect, it, vi } from 'vitest';
import { updateSettingsFields, getDefaultSettings } from '../services/storageService';
import { applyEditableSettings, publicRemoteSettings } from '../shared/settingsOwnership.js';
import { createDefaultSettings } from '../shared/defaultSettings.js';

describe('settings API ownership', () => {
  it('sends only editable changes even if a legacy caller supplies a composed view', async () => {
    const settings = getDefaultSettings();
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: settings, revision: 9 }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await updateSettingsFields({ ...settings, wallpaper: { blur: 6 } }, 8);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.wallpaper).toEqual({ blur: 6 });
    for (const field of ['language', 'theme', 'colorTheme', 'timezone', 'exchangeRates', 'exchangeRateApi', 'lastRatesUpdate', 'security']) {
      expect(body).not.toHaveProperty(field);
    }
    expect(fetch.mock.calls[0][1].headers['If-Match']).toBe('"8"');
  });

  it('merges independent queued patches without resetting sibling fields', () => {
    const initial = publicRemoteSettings(createDefaultSettings());
    const first = applyEditableSettings(initial, { customCategories: ['Mine'] });
    const second = applyEditableSettings(first, { notifications: { rules: { monthlySummary: true } } });
    expect(second.customCategories).toEqual(['Mine']);
    expect(second.notifications.telegram).toEqual(initial.notifications.telegram);
    expect(second.notifications.rules.renewalReminder).toBe(initial.notifications.rules.renewalReminder);
    expect(second.notifications.rules.monthlySummary).toBe(true);
    expect(initial.notifications.rules.monthlySummary).toBe(false);
    expect(getDefaultSettings().security).not.toHaveProperty('twoFactorSecret');
    expect(getDefaultSettings().exchangeRateApi).not.toHaveProperty('encryptedKey');
  });
});
