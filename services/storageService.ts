
import { Subscription, AppSettings, DEFAULT_CATEGORIES, DEFAULT_PAYMENT_METHODS, NotificationRecord } from '../types';
import { canonicalCategoryKey, canonicalPaymentMethodKey } from './displayLabels';
import { authHeaderOnly, authJsonHeaders, apiFetch, apiFetchJson, UnauthorizedError } from './apiClient';
import { DEFAULT_REMINDER_TEMPLATE_STRING, normalizeReminderTemplateString } from '../shared/reminderTemplate.js';

const API_BASE = '/api';

export interface PersistedData {
  subscriptions: Subscription[];
  settings: AppSettings;
  notifications: NotificationRecord[];
}

const DEFAULT_SETTINGS: AppSettings = {
  language: 'zh',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
  theme: 'system',
  customCategories: DEFAULT_CATEGORIES,
  customPaymentMethods: DEFAULT_PAYMENT_METHODS,
  customCurrencies: [
    { code: 'USD', name: 'US Dollar' },
    { code: 'CNY', name: 'Chinese Yuan' },
    { code: 'EUR', name: 'Euro' },
    { code: 'SGD', name: 'Singapore Dollar' },
  ],
  exchangeRates: {
    'USD': 1,
    'CNY': 7.2,
    'EUR': 0.92,
    'SGD': 1.34
  },
  lastRatesUpdate: 0,
  exchangeRateApi: {
    enabled: false,
    encryptedKey: '',
    lastTestedAt: 0,
    lastRunAt0: 0,
    lastRunAt12: 0,
  },
  notifications: {
    telegram: { enabled: false, botToken: '', chatId: '' },
    email: { enabled: false, emailAddress: '' },
    rules: {
      renewalReminder: true,
      reminderDays: 3,
      template: DEFAULT_REMINDER_TEMPLATE_STRING,
      channels: {
        renewalReminder: ['telegram', 'email']
      }
    },
    scheduledTask: false,
  },
  security: {
    twoFactorEnabled: false,
    twoFactorSecret: '',
    pendingTwoFactorSecret: '',
    lastPasswordChange: new Date().toISOString(),
  }
};

export const getDefaultSettings = (): AppSettings => JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

export const uploadIconFile = async (file: File): Promise<string> => {
  const form = new FormData();
  form.append('file', file);
  const resp = await apiFetch(`${API_BASE}/icons`, {
    method: 'POST',
    headers: authHeaderOnly(),
    body: form
  });
  if (!resp.ok) {
    let message = 'upload_failed';
    try {
      const parsed = await resp.json();
      message = parsed?.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const data = await resp.json();
  if (!data?.ok || !data?.url) throw new Error('upload_failed');
  return String(data.url);
};

const normalizeSubscription = (sub: any): Subscription => {
  const category = canonicalCategoryKey(sub?.category || 'Other') || 'Other';
  const paymentMethod = canonicalPaymentMethodKey(sub?.paymentMethod || 'Credit Card') || 'Credit Card';
  return {
    ...sub,
    category,
    paymentMethod,
  } as Subscription;
};

const mergeSettings = (incoming?: AppSettings): AppSettings => {
  const parsed: Partial<AppSettings> = incoming || {};
  if ('currencyApi' in parsed) {
    // @ts-ignore
    delete (parsed as any).currencyApi;
  }
  if ('aiConfig' in parsed) {
    // @ts-ignore - strip removed legacy config
    delete (parsed as any).aiConfig;
  }

  const parsedRules: Partial<AppSettings['notifications']['rules']> = parsed.notifications?.rules || {};
  const normalizedTemplate =
    !parsedRules.template || parsedRules.template === DEFAULT_REMINDER_TEMPLATE_STRING
      ? DEFAULT_REMINDER_TEMPLATE_STRING
      : normalizeReminderTemplateString(parsedRules.template);
  const normalizedRules = {
    renewalReminder: parsedRules.renewalReminder !== undefined ? parsedRules.renewalReminder : DEFAULT_SETTINGS.notifications.rules.renewalReminder,
    reminderDays: parsedRules.reminderDays ?? DEFAULT_SETTINGS.notifications.rules.reminderDays,
    template: normalizedTemplate,
    channels: {
      ...DEFAULT_SETTINGS.notifications.rules.channels,
      ...(parsedRules.channels || {})
    }
  };

  const mergeStringList = (existing: any, defaults: string[], canonicalize: (v: string) => string) => {
    const raw = Array.isArray(existing) ? existing : [];
    const list: string[] = [];
    const seen = new Set<string>();

    raw.forEach((v) => {
      if (typeof v !== 'string') return;
      const canon = canonicalize(v);
      if (!canon) return;
      const key = canon.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push(canon);
    });

    defaults.forEach((item) => {
      const canon = canonicalize(item);
      const key = canon.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push(canon);
    });

    return list;
  };

  return {
    ...getDefaultSettings(),
    ...parsed,
    exchangeRateApi: {
      ...DEFAULT_SETTINGS.exchangeRateApi,
      ...(parsed as any).exchangeRateApi,
    },
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...(parsed.notifications || {}),
      rules: { 
        ...normalizedRules
      }
    },
    security: {
      ...DEFAULT_SETTINGS.security,
      ...(parsed.security || {})
    },
    exchangeRates: parsed.exchangeRates || DEFAULT_SETTINGS.exchangeRates,
    customCurrencies: parsed.customCurrencies || DEFAULT_SETTINGS.customCurrencies,
    customCategories: mergeStringList((parsed as any).customCategories, DEFAULT_SETTINGS.customCategories, canonicalCategoryKey),
    customPaymentMethods: mergeStringList((parsed as any).customPaymentMethods, DEFAULT_SETTINGS.customPaymentMethods, canonicalPaymentMethodKey)
  };
};

export const fetchAllData = async (): Promise<PersistedData> => {
  try {
    const data = await apiFetchJson<any>(`${API_BASE}/data`, { headers: authJsonHeaders() });
    return {
      subscriptions: (data.subscriptions || []).map(normalizeSubscription),
      notifications: data.notifications || [],
      settings: mergeSettings(data.settings)
    };
  } catch (error: any) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    console.error('Failed to fetch data from server', error);
    throw error;
  }
};

export const saveAllData = async (data: PersistedData): Promise<void> => {
  try {
    await apiFetch(`${API_BASE}/data`, {
      method: 'PUT',
      headers: authJsonHeaders(),
      body: JSON.stringify(data)
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    console.error('Failed to save data to server', error);
  }
};
