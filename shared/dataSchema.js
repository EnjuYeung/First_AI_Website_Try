const FREQUENCIES = new Set(['Monthly', 'Quarterly', 'Semi-Annually', 'Yearly']);
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

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
  const ids = new Set();
  for (const sub of subscriptions) {
    if (!isPlainObject(sub)) return 'invalid_subscription';
    if (typeof sub.id !== 'string' || !sub.id.trim() || ids.has(sub.id)) {
      return 'invalid_subscription_id';
    }
    ids.add(sub.id);
    if (typeof sub.name !== 'string' || !sub.name.trim()) return 'invalid_subscription_name';
    if (typeof sub.price !== 'number' || !Number.isFinite(sub.price) || sub.price < 0) {
      return 'invalid_subscription_price';
    }
    if (typeof sub.currency !== 'string' || !sub.currency.trim()) {
      return 'invalid_subscription_currency';
    }
    if (!FREQUENCIES.has(sub.frequency)) return 'invalid_subscription_frequency';
    if (!['active', 'cancelled'].includes(sub.status)) return 'invalid_subscription_status';
    if (!isValidYmd(sub.startDate) || !isValidYmd(sub.nextBillingDate, sub.status === 'cancelled')) {
      return 'invalid_subscription_date';
    }
    if (sub.cancelledAt !== undefined && !isValidYmd(sub.cancelledAt)) {
      return 'invalid_subscription_cancelled_date';
    }
    if (typeof sub.notificationsEnabled !== 'boolean') {
      return 'invalid_subscription_notifications';
    }
  }
  return null;
};

export const validateSettings = (settings) => {
  if (!isPlainObject(settings)) return 'settings_must_be_object';
  if (!['zh', 'en'].includes(settings.language)) return 'invalid_language';
  if (!['light', 'dark', 'system'].includes(settings.theme)) return 'invalid_theme';
  if (typeof settings.timezone !== 'string' || !settings.timezone.trim()) {
    return 'invalid_timezone';
  }
  const reminderDays = settings.notifications?.rules?.reminderDays;
  if (!Number.isInteger(reminderDays) || reminderDays < 0 || reminderDays > 365) {
    return 'invalid_reminder_days';
  }
  return null;
};

export const validateNotifications = (notifications) => {
  if (!Array.isArray(notifications)) return 'notifications_must_be_array';
  for (const record of notifications) {
    if (!isPlainObject(record) || typeof record.id !== 'string' || !record.id.trim()) {
      return 'invalid_notification';
    }
  }
  return null;
};

export const validateDataPatch = (payload) => {
  if (!isPlainObject(payload)) return 'invalid_payload';
  const keys = Object.keys(payload);
  if (!keys.length || keys.some((key) => !['subscriptions', 'settings', 'notifications'].includes(key))) {
    return 'invalid_patch_fields';
  }
  if ('subscriptions' in payload) {
    const error = validateSubscriptions(payload.subscriptions);
    if (error) return error;
  }
  if ('settings' in payload) {
    const error = validateSettings(payload.settings);
    if (error) return error;
  }
  if ('notifications' in payload) {
    const error = validateNotifications(payload.notifications);
    if (error) return error;
  }
  return null;
};
