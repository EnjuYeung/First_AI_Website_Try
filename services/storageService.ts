
import { Subscription, AppSettings, DEFAULT_CATEGORIES, DEFAULT_PAYMENT_METHODS, NotificationRecord } from '../types';

const STORAGE_KEY = 'subscrybe_data_v1';
const SETTINGS_KEY = 'subscrybe_settings_v1';
const NOTIFICATIONS_KEY = 'subscrybe_notifications_v1';

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
    { code: 'SGD', name: 'Singapore Dollar' },
  ],
  exchangeRates: {
    'USD': 1,
    'CNY': 7.2,
    'EUR': 0.92,
    'SGD': 1.34
  },
  lastRatesUpdate: 0,
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
    
    // Clean up legacy fields if they exist in local storage
    if ('currencyApi' in parsed) {
        delete parsed.currencyApi;
    }

    return { 
        ...DEFAULT_SETTINGS, 
        ...parsed, 
        notifications: { 
            ...DEFAULT_SETTINGS.notifications, 
            ...parsed.notifications, 
            rules: {...DEFAULT_SETTINGS.notifications.rules, ...parsed.notifications?.rules} 
        },
        // Ensure exchangeRates structure exists if loading old data
        exchangeRates: parsed.exchangeRates || DEFAULT_SETTINGS.exchangeRates,
        customCurrencies: parsed.customCurrencies || DEFAULT_SETTINGS.customCurrencies
    };
  } catch (error) {
    return DEFAULT_SETTINGS;
  }
};

// --- Notification Storage ---

const generateMockNotifications = (): NotificationRecord[] => {
  const records: NotificationRecord[] = [
    {
      id: '1',
      subscriptionName: 'Netflix',
      type: 'renewal_success',
      status: 'success',
      channel: 'telegram',
      timestamp: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
      details: {
        amount: 15.99,
        currency: 'USD',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'Credit Card',
        receiver: '123456789',
        message: 'Payment processed successfully.'
      }
    },
    {
      id: '2',
      subscriptionName: 'Spotify',
      type: 'renewal_reminder',
      status: 'success',
      channel: 'email',
      timestamp: Date.now() - 1000 * 60 * 60 * 25, // Yesterday
      details: {
        amount: 9.99,
        currency: 'USD',
        date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString().split('T')[0], // 2 days from now
        daysUntil: 2,
        receiver: 'user@example.com',
        message: 'Please ensure sufficient funds.'
      }
    },
    {
      id: '3',
      subscriptionName: 'Adobe Creative Cloud',
      type: 'renewal_failed',
      status: 'failed',
      channel: 'telegram',
      timestamp: Date.now() - 1000 * 60 * 60 * 48, // 2 days ago
      details: {
        amount: 54.99,
        currency: 'USD',
        date: new Date().toISOString().split('T')[0],
        errorReason: 'Insufficient funds',
        receiver: '123456789'
      }
    },
    {
      id: '4',
      subscriptionName: 'GitHub Copilot',
      type: 'renewal_reminder',
      status: 'success',
      channel: 'telegram',
      timestamp: Date.now() - 1000 * 60 * 60 * 72, // 3 days ago
      details: {
        amount: 10.00,
        currency: 'USD',
        daysUntil: 3,
        date: new Date().toISOString().split('T')[0],
        receiver: '123456789'
      }
    }
  ];
  return records;
};

export const loadNotificationHistory = (): NotificationRecord[] => {
  try {
    const data = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!data) {
        // Return Mock Data for demonstration if empty
        const mocks = generateMockNotifications();
        saveNotificationHistory(mocks);
        return mocks;
    }
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

export const saveNotificationHistory = (records: NotificationRecord[]): void => {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('Failed to save notifications', error);
  }
};
