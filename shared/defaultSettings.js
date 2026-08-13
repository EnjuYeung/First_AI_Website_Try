import { DEFAULT_CATEGORIES, DEFAULT_PAYMENT_METHODS, DEFAULT_RULE_CHANNELS } from './constants.js';
import { DEFAULT_REMINDER_TEMPLATE_STRING } from './reminderTemplate.js';
import { DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING } from './monthlySummaryTemplate.js';

const EXCHANGE_RATE_CODE_RE = /^[A-Z0-9]{2,10}$/;

export const normalizeExchangeRates = (incoming, fallback = { USD: 1 }) => {
  const collectValidRates = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([code, rate]) =>
          EXCHANGE_RATE_CODE_RE.test(code) &&
          typeof rate === 'number' &&
          Number.isFinite(rate) &&
          rate > 0
      )
    );
  };

  const incomingRates = collectValidRates(incoming);
  const rates = Object.keys(incomingRates).length
    ? incomingRates
    : collectValidRates(fallback);
  if (!rates.USD) rates.USD = 1;
  return rates;
};

export const createDefaultSettings = () => ({
  language: 'zh',
  timezone: 'Asia/Shanghai',
  theme: 'system',
  colorTheme: 'default',
  wallpaper: {
    url: '',
    blur: 0,
    overlay: 36,
    panelOpacity: 100,
  },
  customCategories: [...DEFAULT_CATEGORIES],
  customPaymentMethods: [...DEFAULT_PAYMENT_METHODS],
  customCurrencies: [
    { code: 'USD', name: 'US Dollar' },
    { code: 'CNY', name: 'Chinese Yuan' },
    { code: 'EUR', name: 'Euro' },
    { code: 'SGD', name: 'Singapore Dollar' },
  ],
  exchangeRates: { USD: 1, CNY: 7.2, EUR: 0.92, SGD: 1.34 },
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
      monthlySummary: false,
      reminderDays: 3,
      channels: { ...DEFAULT_RULE_CHANNELS },
      template: DEFAULT_REMINDER_TEMPLATE_STRING,
      monthlySummaryTemplate: DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING,
    },
  },
  security: {
    twoFactorEnabled: false,
    twoFactorSecret: '',
    pendingTwoFactorSecret: '',
    lastPasswordChange: '1970-01-01T00:00:00.000Z',
  },
});
