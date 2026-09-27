
export enum Frequency {
  MONTHLY = 'Monthly',
  QUARTERLY = 'Quarterly',
  SEMI_ANNUALLY = 'Semi-Annually',
  YEARLY = 'Yearly',
}


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
  cancelledAt?: string; // YYYY-MM-DD when status is cancelled
  createdAt?: string; // YYYY-MM-DD when added to Subm
  startDate: string;
  nextBillingDate: string;
  iconUrl?: string;
  url?: string;
  notes?: string;
  notificationsEnabled: boolean;
}

export interface ServerClock {
  serverTimeMs: number;
  receivedAtMs: number;
}

// --- Settings Types ---

export interface CurrencyConfig {
  code: string;
  name: string;
}

export interface NotificationRule {
  renewalReminder: boolean;
  monthlySummary: boolean;
  reminderDays: number;
  template: string;
  monthlySummaryTemplate: string;
  channels: {
    renewalReminder: NotificationChannel[];
    monthlySummary: NotificationChannel[];
  };
}

export interface ExchangeRates {
  [key: string]: number; // e.g., 'CNY': 7.23
}

export interface ExchangeRateApiSettings {
  enabled: boolean;
  encryptedKey: string; // Server-side AES-256-GCM envelope
  lastTestedAt: number; // epoch ms
  lastRunAt0: number; // epoch ms
  lastRunAt12: number; // epoch ms
}

/** Device-local preferences; never sent to a settings mutation endpoint. */
export interface ClientPreferences {
  language: 'zh' | 'en';
  theme: 'light' | 'dark' | 'system';
  colorTheme: 'default' | 'blue' | 'violet' | 'rose';
}

/** User-editable, persisted configuration. */
export interface EditableSettings {
  wallpaper: { url: string; blur: number; overlay: number; panelOpacity: number };
  customCategories: string[];
  customPaymentMethods: string[];
  customCurrencies: CurrencyConfig[];
  notifications: {
    telegram: { enabled: boolean; botToken: string; chatId: string };
    email: { enabled: boolean; emailAddress: string };
    rules: NotificationRule;
  };
}

/** Read-only public state maintained by dedicated server operations. */
export interface ServerSettingsState {
  timezone: string;
  exchangeRates: ExchangeRates;
  lastRatesUpdate: number;
  exchangeRateApi: Omit<ExchangeRateApiSettings, 'encryptedKey'>;
  security: { twoFactorEnabled: boolean; lastPasswordChange: string };
}
export type RemoteSettings = EditableSettings & ServerSettingsState;
/** Composed view for components, not a write payload. */
export type AppSettings = ClientPreferences & RemoteSettings;

export type EditableSettingsPatch = Partial<Omit<EditableSettings, 'notifications' | 'wallpaper'>> & {
  wallpaper?: Partial<EditableSettings['wallpaper']>;
  notifications?: {
    telegram?: Partial<EditableSettings['notifications']['telegram']>;
    email?: Partial<EditableSettings['notifications']['email']>;
    rules?: Partial<Omit<NotificationRule, 'channels'>> & { channels?: Partial<NotificationRule['channels']> };
  };
};
export type SettingsUpdate = EditableSettingsPatch & Partial<ClientPreferences>;
export interface SettingsStateResponse {
  settingsState: ServerSettingsState;
  revision: number;
}
export interface ServerSettingsUpdate {
  state: Partial<ServerSettingsState>;
  revision?: number;
}
/** On-disk schema retains legacy preferences and private server credentials. */
export type StoredSettings = AppSettings & {
  exchangeRateApi: ExchangeRateApiSettings;
  security: ServerSettingsState['security'] & { twoFactorSecret: string; pendingTwoFactorSecret: string };
};

// --- Notification History Types ---

export type NotificationType = 'renewal_reminder' | 'monthly_summary' | 'subscription_change';
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
    daysUntil?: number;
    errorReason?: string;
    subscriptionId?: string;
    renewalFeedback?: string;
    periodKey?: string;
  };
}
