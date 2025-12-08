
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

export const COMMON_TIMEZONES = [
  'UTC',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney'
];

export const ISO_CURRENCIES = [
    { code: 'USD', name: 'United States Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'CNY', name: 'Chinese Yuan' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'KRW', name: 'South Korean Won' },
    { code: 'TWD', name: 'New Taiwan Dollar' },
    { code: 'HKD', name: 'Hong Kong Dollar' },
    { code: 'SGD', name: 'Singapore Dollar' },
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'CAD', name: 'Canadian Dollar' },
    { code: 'CHF', name: 'Swiss Franc' },
    { code: 'INR', name: 'Indian Rupee' },
    { code: 'RUB', name: 'Russian Ruble' },
    { code: 'BRL', name: 'Brazilian Real' },
    { code: 'THB', name: 'Thai Baht' },
    { code: 'VND', name: 'Vietnamese Dong' },
    { code: 'IDR', name: 'Indonesian Rupiah' },
    { code: 'MYR', name: 'Malaysian Ringgit' },
    { code: 'PHP', name: 'Philippine Peso' },
    { code: 'NZD', name: 'New Zealand Dollar' },
    { code: 'ZAR', name: 'South African Rand' },
    { code: 'MXN', name: 'Mexican Peso' },
    { code: 'SEK', name: 'Swedish Krona' },
    { code: 'NOK', name: 'Norwegian Krone' },
    { code: 'DKK', name: 'Danish Krone' },
    { code: 'TRY', name: 'Turkish Lira' },
    { code: 'SAR', name: 'Saudi Riyal' },
    { code: 'AED', name: 'United Arab Emirates Dirham' },
    { code: 'PLN', name: 'Polish Zloty' },
    { code: 'ILS', name: 'Israeli New Shekel' },
    { code: 'ARS', name: 'Argentine Peso' },
    { code: 'CLP', name: 'Chilean Peso' },
    { code: 'COP', name: 'Colombian Peso' },
    { code: 'EGP', name: 'Egyptian Pound' },
    { code: 'HUF', name: 'Hungarian Forint' },
    { code: 'CZK', name: 'Czech Koruna' },
    { code: 'RON', name: 'Romanian Leu' },
    { code: 'NGN', name: 'Nigerian Naira' },
    { code: 'PKR', name: 'Pakistani Rupee' },
    { code: 'BDT', name: 'Bangladeshi Taka' },
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

export interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
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
  aiConfig: AIConfig; // New AI Configuration
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