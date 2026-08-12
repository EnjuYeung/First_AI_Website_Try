const FREQUENCIES = new Set(['Monthly', 'Quarterly', 'Semi-Annually', 'Yearly']);
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOnlyKeys = (value, allowed) =>
  Object.keys(value).every((key) => allowed.includes(key));
const isBoundedString = (value, min, max) =>
  typeof value === 'string' && value.trim().length >= min && value.length <= max;
const isFiniteTimestamp = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isValidWallpaperUrl = (value) => {
  if (value === '') return true;
  if (/^\/api\/uploads\/wallpaper-[a-f0-9-]+\.(?:png|jpg|webp)$/i.test(value)) return true;
  try {
    const parsed = new URL(value);
    return (
      ['http:', 'https:'].includes(parsed.protocol) &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
};
const SUBSCRIPTION_KEYS = [
  'id', 'name', 'price', 'currency', 'frequency', 'category', 'paymentMethod',
  'status', 'cancelledAt', 'createdAt', 'startDate', 'nextBillingDate', 'iconUrl', 'url',
  'notes', 'notificationsEnabled',
];

const isValidYmd = (value, allowEmpty = false) => {
  if (allowEmpty && value === '') return true;
  if (typeof value !== 'string' || !YMD_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
};

export const validateSubscriptions = (subscriptions) => {
  if (!Array.isArray(subscriptions)) return 'subscriptions_must_be_array';
  if (subscriptions.length > 5000) return 'too_many_subscriptions';
  const ids = new Set();
  for (const sub of subscriptions) {
    if (!isPlainObject(sub)) return 'invalid_subscription';
    if (!hasOnlyKeys(sub, SUBSCRIPTION_KEYS)) return 'unknown_subscription_field';
    if (!isBoundedString(sub.id, 1, 128) || ids.has(sub.id)) {
      return 'invalid_subscription_id';
    }
    ids.add(sub.id);
    if (!isBoundedString(sub.name, 1, 200)) return 'invalid_subscription_name';
    if (typeof sub.price !== 'number' || !Number.isFinite(sub.price) || sub.price < 0 || sub.price > 1e12) {
      return 'invalid_subscription_price';
    }
    if (!/^[A-Z0-9]{2,10}$/.test(sub.currency)) {
      return 'invalid_subscription_currency';
    }
    if (!isBoundedString(sub.category, 1, 100) || !isBoundedString(sub.paymentMethod, 1, 100)) {
      return 'invalid_subscription_classification';
    }
    if (!FREQUENCIES.has(sub.frequency)) return 'invalid_subscription_frequency';
    if (!['active', 'cancelled'].includes(sub.status)) return 'invalid_subscription_status';
    if (!isValidYmd(sub.startDate) || !isValidYmd(sub.nextBillingDate, sub.status === 'cancelled')) {
      return 'invalid_subscription_date';
    }
    if (sub.cancelledAt !== undefined && !isValidYmd(sub.cancelledAt)) {
      return 'invalid_subscription_cancelled_date';
    }
    if (sub.createdAt !== undefined && !isValidYmd(sub.createdAt)) {
      return 'invalid_subscription_created_date';
    }
    if (typeof sub.notificationsEnabled !== 'boolean') {
      return 'invalid_subscription_notifications';
    }
    if (sub.notes !== undefined && (typeof sub.notes !== 'string' || sub.notes.length > 5000)) {
      return 'invalid_subscription_notes';
    }
    for (const key of ['iconUrl', 'url']) {
      if (sub[key] !== undefined && (typeof sub[key] !== 'string' || sub[key].length > 2048)) {
        return 'invalid_subscription_url';
      }
    }
  }
  return null;
};

export const validateSettings = (settings) => {
  if (!isPlainObject(settings)) return 'settings_must_be_object';
  if (!hasOnlyKeys(settings, [
    'language', 'timezone', 'theme', 'colorTheme', 'wallpaper', 'customCategories', 'customPaymentMethods',
    'customCurrencies', 'exchangeRates', 'lastRatesUpdate', 'exchangeRateApi',
    'notifications', 'security',
  ])) return 'unknown_settings_field';
  if (!['zh', 'en'].includes(settings.language)) return 'invalid_language';
  if (!['light', 'dark', 'system'].includes(settings.theme)) return 'invalid_theme';
  if (!['default', 'blue', 'violet', 'rose'].includes(settings.colorTheme)) return 'invalid_color_theme';
  if (!isBoundedString(settings.timezone, 1, 100)) {
    return 'invalid_timezone';
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: settings.timezone }).format();
  } catch {
    return 'invalid_timezone';
  }
  const wallpaper = settings.wallpaper;
  if (
    !isPlainObject(wallpaper) ||
    !hasOnlyKeys(wallpaper, ['url', 'blur', 'overlay', 'panelOpacity']) ||
    typeof wallpaper.url !== 'string' ||
    wallpaper.url.length > 2048 ||
    !isValidWallpaperUrl(wallpaper.url) ||
    !Number.isInteger(wallpaper.blur) || wallpaper.blur < 0 || wallpaper.blur > 30 ||
    !Number.isInteger(wallpaper.overlay) || wallpaper.overlay < 0 || wallpaper.overlay > 90 ||
    !Number.isInteger(wallpaper.panelOpacity) || wallpaper.panelOpacity < 35 || wallpaper.panelOpacity > 100
  ) return 'invalid_wallpaper_settings';
  const validStringList = (value) =>
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every((item) => isBoundedString(item, 1, 100));
  if (!validStringList(settings.customCategories) || !validStringList(settings.customPaymentMethods)) {
    return 'invalid_custom_lists';
  }
  if (
    !Array.isArray(settings.customCurrencies) ||
    settings.customCurrencies.length > 100 ||
    !settings.customCurrencies.every((item) =>
      isPlainObject(item) &&
      hasOnlyKeys(item, ['code', 'name']) &&
      /^[A-Z0-9]{2,10}$/.test(item.code) &&
      isBoundedString(item.name, 1, 100)
    )
  ) return 'invalid_custom_currencies';
  if (
    !isPlainObject(settings.exchangeRates) ||
    Object.keys(settings.exchangeRates).length > 200 ||
    !Object.entries(settings.exchangeRates).every(([code, rate]) =>
      /^[A-Z0-9]{2,10}$/.test(code) &&
      typeof rate === 'number' &&
      Number.isFinite(rate) &&
      rate > 0
    )
  ) return 'invalid_exchange_rates';
  if (!isFiniteTimestamp(settings.lastRatesUpdate)) return 'invalid_last_rates_update';
  const api = settings.exchangeRateApi;
  if (
    !isPlainObject(api) ||
    !hasOnlyKeys(api, ['enabled', 'encryptedKey', 'lastTestedAt', 'lastRunAt0', 'lastRunAt12']) ||
    typeof api.enabled !== 'boolean' ||
    typeof api.encryptedKey !== 'string' ||
    api.encryptedKey.length > 4096 ||
    ![api.lastTestedAt, api.lastRunAt0, api.lastRunAt12].every(isFiniteTimestamp)
  ) return 'invalid_exchange_rate_api';
  const notifications = settings.notifications;
  if (!isPlainObject(notifications) || !hasOnlyKeys(notifications, ['telegram', 'email', 'rules'])) {
    return 'invalid_notification_settings';
  }
  const telegram = notifications.telegram;
  const email = notifications.email;
  if (
    !isPlainObject(telegram) ||
    !hasOnlyKeys(telegram, ['enabled', 'botToken', 'chatId']) ||
    typeof telegram.enabled !== 'boolean' ||
    !isBoundedString(telegram.botToken, telegram.enabled ? 1 : 0, 256) ||
    !isBoundedString(telegram.chatId, telegram.enabled ? 1 : 0, 128)
  ) return 'invalid_telegram_settings';
  if (
    !isPlainObject(email) ||
    !hasOnlyKeys(email, ['enabled', 'emailAddress']) ||
    typeof email.enabled !== 'boolean' ||
    typeof email.emailAddress !== 'string' ||
    email.emailAddress.length > 320 ||
    (email.enabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.emailAddress))
  ) return 'invalid_email_settings';
  const rules = notifications.rules;
  const reminderDays = settings.notifications?.rules?.reminderDays;
  if (
    !isPlainObject(rules) ||
    !hasOnlyKeys(rules, [
      'renewalReminder', 'monthlySummary', 'reminderDays', 'template',
      'monthlySummaryTemplate', 'channels',
    ]) ||
    typeof rules.renewalReminder !== 'boolean' ||
    typeof rules.monthlySummary !== 'boolean' ||
    !Number.isInteger(reminderDays) || reminderDays < 0 || reminderDays > 365
  ) {
    return 'invalid_reminder_days';
  }
  if (typeof rules.template !== 'string' || rules.template.length > 10000) return 'invalid_template';
  if (typeof rules.monthlySummaryTemplate !== 'string' || rules.monthlySummaryTemplate.length > 10000) {
    return 'invalid_monthly_summary_template';
  }
  try {
    const template = JSON.parse(rules.template);
    if (!Array.isArray(template.lines) || template.lines.length > 50 ||
        !template.lines.every((line) => typeof line === 'string' && line.length <= 500)) {
      return 'invalid_template';
    }
  } catch {
    return 'invalid_template';
  }
  try {
    const template = JSON.parse(rules.monthlySummaryTemplate);
    if (!Array.isArray(template.lines) || template.lines.length > 50 ||
        !template.lines.every((line) => typeof line === 'string' && line.length <= 500)) {
      return 'invalid_monthly_summary_template';
    }
  } catch {
    return 'invalid_monthly_summary_template';
  }
  if (
    !isPlainObject(rules.channels) ||
    !hasOnlyKeys(rules.channels, ['renewalReminder', 'monthlySummary']) ||
    !Array.isArray(rules.channels.renewalReminder) ||
    !Array.isArray(rules.channels.monthlySummary) ||
    !rules.channels.renewalReminder.every((channel) => ['telegram', 'email'].includes(channel)) ||
    !rules.channels.monthlySummary.every((channel) => ['telegram', 'email'].includes(channel))
  ) return 'invalid_notification_channels';
  const security = settings.security;
  if (
    !isPlainObject(security) ||
    !hasOnlyKeys(security, ['twoFactorEnabled', 'twoFactorSecret', 'pendingTwoFactorSecret', 'lastPasswordChange']) ||
    typeof security.twoFactorEnabled !== 'boolean' ||
    typeof security.twoFactorSecret !== 'string' || security.twoFactorSecret.length > 256 ||
    typeof security.pendingTwoFactorSecret !== 'string' || security.pendingTwoFactorSecret.length > 256 ||
    !isBoundedString(security.lastPasswordChange, 1, 64)
  ) return 'invalid_security_settings';
  return null;
};

export const validateNotifications = (notifications) => {
  if (!Array.isArray(notifications)) return 'notifications_must_be_array';
  if (notifications.length > 10000) return 'too_many_notifications';
  for (const record of notifications) {
    if (
      !isPlainObject(record) ||
      !isBoundedString(record.id, 1, 128) ||
      !isBoundedString(record.subscriptionName, 1, 200) ||
      !['renewal_reminder', 'monthly_summary', 'subscription_change'].includes(record.type) ||
      !['success', 'failed'].includes(record.status) ||
      !['telegram', 'email'].includes(record.channel) ||
      !isFiniteTimestamp(record.timestamp) ||
      !isPlainObject(record.details) ||
      JSON.stringify(record).length > 10000
    ) {
      return 'invalid_notification';
    }
  }
  return null;
};
