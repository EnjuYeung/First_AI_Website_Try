
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
  status: 'active' | 'cancelled'; // New status field
  startDate: string;
  nextBillingDate: string;
  iconUrl?: string;
  url?: string;
  notes?: string;
  notificationsEnabled: boolean;
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
  renewalFailed: boolean;
  renewalReminder: boolean;
  renewalSuccess: boolean;
  subscriptionChange: boolean;
  reminderDays: number;
}

export interface ExchangeRates {
  [key: string]: number; // e.g., 'CNY': 7.23
}

export interface AppSettings {
  language: 'zh' | 'en';
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  customCategories: string[];
  customPaymentMethods: string[];
  customCurrencies: CurrencyConfig[];
  exchangeRates: ExchangeRates; // Store rates locally
  lastRatesUpdate: number; // Timestamp of last update
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

// --- Notification History Types ---

export type NotificationType = 'renewal_reminder' | 'renewal_success' | 'renewal_failed' | 'subscription_change';
export type NotificationStatus = 'success' | 'failed';
export type NotificationChannel = 'telegram' | 'email';

export interface NotificationRecord {
  id: string;
  subscriptionName: string;
  type: NotificationType;
  status: NotificationStatus;
  channel: NotificationChannel;
  timestamp: number;
  // Dynamic fields for the template
  details: {
    amount?: number;
    currency?: string;
    date?: string;
    paymentMethod?: string;
    message?: string;
    receiver?: string;
    daysUntil?: number;
    errorReason?: string;
  };
}
