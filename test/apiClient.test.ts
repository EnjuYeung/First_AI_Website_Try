import { describe, expect, it, vi } from 'vitest';
import { apiFetchJson, SESSION_EXPIRED_EVENT, UnauthorizedError } from '../services/apiClient';
import { fetchAllData, getDefaultSettings } from '../services/storageService';

describe('API 401 semantics', () => {
  it('preserves a reauthentication failure without treating the session as expired', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: 'reauthentication_required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )));

    const error = await apiFetchJson('/api/2fa/disable').catch((value) => value);
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(error).toMatchObject({ message: 'reauthentication_required', sessionExpired: false });
  });

  it('signals an expired authenticated session for auth middleware failures', async () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: 'Invalid token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )));

    const error = await apiFetchJson('/api/data').catch((value) => value);
    expect(error).toMatchObject({ message: 'Invalid token', sessionExpired: true });
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
  });
});

describe('persisted settings normalization', () => {
  it('does not resurrect default categories or payment methods the user removed', async () => {
    const settings = getDefaultSettings();
    settings.customCategories = ['Custom only'];
    settings.customPaymentMethods = ['Cash only'];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      subscriptions: [],
      notifications: [],
      settings,
      revisions: { subscriptions: 1, settings: 1, notifications: 1 },
      serverTime: 1_786_080_000_000,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const data = await fetchAllData();
    expect(data.settings.customCategories).toEqual(['Custom only']);
    expect(data.settings.customPaymentMethods).toEqual(['Cash only']);
    expect(data.serverTime).toBe(1_786_080_000_000);
  });

  it('migrates a legacy shared notification channel list to both rules', async () => {
    const settings = getDefaultSettings();
    (settings.notifications.rules as any).channels = ['telegram', 'invalid', 'telegram'];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      subscriptions: [],
      notifications: [],
      settings,
      revisions: { subscriptions: 1, settings: 1, notifications: 1 },
      serverTime: 1_786_080_000_000,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const data = await fetchAllData();
    expect(data.settings.notifications.rules.channels).toEqual({
      renewalReminder: ['telegram'],
      monthlySummary: ['telegram'],
    });
  });
});
