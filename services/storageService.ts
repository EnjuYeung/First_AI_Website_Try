
import { Subscription, AppSettings, DEFAULT_CATEGORIES, DEFAULT_PAYMENT_METHODS } from '../types';

const STORAGE_KEY = 'subscrybe_data_v1';
const SETTINGS_KEY = 'subscrybe_settings_v1';

export const saveSubscriptions = (subs: Subscription[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
  } catch (error) {
    console.error('Failed to save to local storage', error);
  }
};

export const loadSubscriptions = (): Subscription[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    const parsed = JSON.parse(data);
    // Migration: Ensure all subscriptions have a status
    return parsed.map((sub: any) => ({
      ...sub,
      status: sub.status || 'active'
    }));
  } catch (error) {
    console.error('Failed to load from local storage', error);
    return [];
  }
};

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
    { code: 'GBP', name: 'British Pound' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'KRW', name: 'South Korean Won' },
    { code: 'SGD', name: 'Singapore Dollar' },
  ],
  currencyApi: {
    provider: 'none',
    apiKey: '',
  },
  notifications: {
    telegram: { enabled: false, botToken: '', chatId: '' },
    email: { enabled: false, emailAddress: '' },
    rules: {
      renewalFailed: true,
      renewalReminder: true,
      renewalSuccess: false,
      subscriptionChange: true,
      reminderDays: 3
    },
    scheduledTask: false,
  },
  security: {
    twoFactorEnabled: false,
    lastPasswordChange: new Date().toISOString(),
  }
};

export const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings', error);
  }
};

export const loadSettings = (): AppSettings => {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return DEFAULT_SETTINGS;
    
    // Merge with default to handle new fields in future updates
    const parsed = JSON.parse(data);
    return { ...DEFAULT_SETTINGS, ...parsed, notifications: { ...DEFAULT_SETTINGS.notifications, ...parsed.notifications, rules: {...DEFAULT_SETTINGS.notifications.rules, ...parsed.notifications?.rules} } };
  } catch (error) {
    return DEFAULT_SETTINGS;
  }
};
