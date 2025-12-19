import {
  DEFAULT_CATEGORIES,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_RULE_CHANNELS,
} from '../../shared/constants.js';
import { DEFAULT_REMINDER_TEMPLATE_STRING } from '../../shared/reminderTemplate.js';

export const defaultSettings = () => ({
  language: 'zh',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
  theme: 'system',
  customCategories: [...DEFAULT_CATEGORIES],
  customPaymentMethods: [...DEFAULT_PAYMENT_METHODS],
  customCurrencies: [
    { code: 'USD', name: 'US Dollar' },
    { code: 'CNY', name: 'Chinese Yuan' },
    { code: 'EUR', name: 'Euro' },
    { code: 'SGD', name: 'Singapore Dollar' },
  ],
  exchangeRates: {
    USD: 1,
    CNY: 7.2,
    EUR: 0.92,
    SGD: 1.34,
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
      channels: { ...DEFAULT_RULE_CHANNELS },
      template: DEFAULT_REMINDER_TEMPLATE_STRING,
    },
    scheduledTask: false,
  },
  security: {
    twoFactorEnabled: false,
    twoFactorSecret: '',
    pendingTwoFactorSecret: '',
    lastPasswordChange: new Date().toISOString(),
  },
});

export const defaultUserData = () => ({
  subscriptions: [],
  settings: defaultSettings(),
  notifications: [],
});

