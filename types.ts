export enum Frequency {
  MONTHLY = 'Monthly',
  QUARTERLY = 'Quarterly',
  SEMI_ANNUALLY = 'Semi-Annually',
  YEARLY = 'Yearly',
}

// Default categories as constants, but type is string to allow custom
export const DEFAULT_CATEGORIES = [
  'Entertainment',
  'Software',
  'Utilities',
  'Lifestyle',
  'Education',
  'Other'
];

// Default payment methods as constants, but type is string
export const DEFAULT_PAYMENT_METHODS = [
  'Credit Card',
  'Debit Card',
  'Crypto',
  'PayPal',
  'Other'
];

export interface Subscription {
  id: string;
  name: string;
  price: number;
  currency: string;
  frequency: Frequency;
  category: string; // Changed from Enum to string
  paymentMethod: string; // Changed from Enum to string
  startDate: string;
  nextBillingDate: string;
  iconUrl?: string;
  url?: string;
  notes?: string;
}

export interface SpendingData {
  name: string;
  value: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

// --- Settings Types ---

export interface CurrencyConfig {
  code: string;
  name: string;
}

export interface NotificationRule {
  expiryWarning: boolean;
  renewalFailed: boolean;
  renewalReminder: boolean;
  renewalSuccess: boolean;
  subscriptionChange: boolean;
  reminderDays: number;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  customCategories: string[];
  customPaymentMethods: string[];
  customCurrencies: CurrencyConfig[];
  currencyApi: {
    provider: 'tianapi' | 'apilayer' | 'none';
    apiKey: string;
  };
  notifications: {
    telegram: {
      enabled: boolean;
      botToken: string;
      chatId: string;
    };
    email: {
      enabled: boolean;
      emailAddress: string;
    };
    rules: NotificationRule;
    scheduledTask: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    lastPasswordChange: string;
  };
}

export interface ExchangeRates {
  [key: string]: number; // e.g., 'CNY': 7.23
}