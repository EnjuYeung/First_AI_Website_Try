
import { Subscription, AppSettings, DEFAULT_CATEGORIES, DEFAULT_PAYMENT_METHODS, NotificationRecord } from '../types';

const API_BASE = '/api';

export interface PersistedData {
  subscriptions: Subscription[];
  settings: AppSettings;
  notifications: NotificationRecord[];
}

const DEFAULT_REMINDER_TEMPLATE = JSON.stringify(
  {
    lines: [
      '🔔 续订提醒通知',
      '',
      '📌 订阅{{name}}即将付款',
      '',
      '📅 付款日期：{{nextBillingDate}}',
      '💰 订阅金额：{{price}} {{currency}}',
      '💳 支付方式：{{paymentMethod}}',
      '',
      '⚠️ 请及时续订以避免服务中断。'
    ]
  },
  null,
  2
);

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
  aiConfig: {
    baseUrl: '',
    apiKey: '',
    model: ''
  },
  notifications: {
    telegram: { enabled: false, botToken: '', chatId: '' },
    email: { enabled: false, emailAddress: '' },
    rules: {
      renewalReminder: true,
      reminderDays: 3,
      template: DEFAULT_REMINDER_TEMPLATE,
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

const defaultData = (): PersistedData => ({
  subscriptions: [],
  settings: getDefaultSettings(),
  notifications: []
});

export const getDefaultSettings = (): AppSettings => JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

const authHeaders = () => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

const mergeSettings = (incoming?: AppSettings): AppSettings => {
  const parsed = incoming || {};
  if ('currencyApi' in parsed) {
    // @ts-ignore
    delete (parsed as any).currencyApi;
  }

  const parsedRules = parsed.notifications?.rules || {};
  const normalizedRules = {
    renewalReminder: parsedRules.renewalReminder !== undefined ? parsedRules.renewalReminder : DEFAULT_SETTINGS.notifications.rules.renewalReminder,
    reminderDays: parsedRules.reminderDays ?? DEFAULT_SETTINGS.notifications.rules.reminderDays,
    template: parsedRules.template || DEFAULT_REMINDER_TEMPLATE,
    channels: {
      ...DEFAULT_SETTINGS.notifications.rules.channels,
      ...(parsedRules.channels || {})
    }
  };

  return {
    ...getDefaultSettings(),
    ...parsed,
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...parsed.notifications,
      rules: { 
        ...normalizedRules
      }
    },
    security: {
      ...DEFAULT_SETTINGS.security,
      ...parsed.security
    },
    exchangeRates: parsed.exchangeRates || DEFAULT_SETTINGS.exchangeRates,
    customCurrencies: parsed.customCurrencies || DEFAULT_SETTINGS.customCurrencies,
    aiConfig: parsed.aiConfig || DEFAULT_SETTINGS.aiConfig
  };
};

export const fetchAllData = async (): Promise<PersistedData> => {
  try {
    const resp = await fetch(`${API_BASE}/data`, {
      headers: authHeaders()
    });
    if (resp.status === 401) throw new Error('unauthorized');
    if (!resp.ok) throw new Error('failed_to_fetch');
    const data = await resp.json();
    return {
      subscriptions: data.subscriptions || [],
      notifications: data.notifications || [],
      settings: mergeSettings(data.settings)
    };
  } catch (error: any) {
    if (error?.message === 'unauthorized') {
      throw error;
    }
    console.error('Failed to fetch data from server', error);
    return defaultData();
  }
};

export const saveAllData = async (data: PersistedData): Promise<void> => {
  try {
    await fetch(`${API_BASE}/data`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error('Failed to save data to server', error);
  }
};
