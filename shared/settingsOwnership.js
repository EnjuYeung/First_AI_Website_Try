export const EDITABLE_SETTINGS_KEYS = ['wallpaper', 'customCategories', 'customPaymentMethods', 'customCurrencies', 'notifications'];
export const CLIENT_PREFERENCE_KEYS = ['language', 'theme', 'colorTheme'];
export const SERVER_SETTINGS_KEYS = ['timezone', 'exchangeRates', 'lastRatesUpdate', 'exchangeRateApi', 'security'];
const pick = (source, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(source || {}, key)).map(key => [key, source[key]]));

export const pickEditableSettings = value => pick(value, EDITABLE_SETTINGS_KEYS);
export const pickClientPreferences = value => pick(value, CLIENT_PREFERENCE_KEYS);
export const publicServerSettings = settings => ({
  timezone: settings.timezone,
  exchangeRates: settings.exchangeRates,
  lastRatesUpdate: settings.lastRatesUpdate,
  exchangeRateApi: {
    enabled: Boolean(settings.exchangeRateApi?.enabled),
    lastTestedAt: settings.exchangeRateApi?.lastTestedAt || 0,
    lastRunAt0: settings.exchangeRateApi?.lastRunAt0 || 0,
    lastRunAt12: settings.exchangeRateApi?.lastRunAt12 || 0,
  },
  security: {
    twoFactorEnabled: Boolean(settings.security?.twoFactorEnabled),
    lastPasswordChange: settings.security?.lastPasswordChange,
  },
});
export const publicRemoteSettings = settings => ({ ...pickEditableSettings(settings), ...publicServerSettings(settings) });

/** Merge only editable fields; arrays replace, configuration objects merge by field. */
export const applyEditableSettings = (current, patch) => {
  const next = { ...current, ...pickEditableSettings(patch) };
  if (patch.wallpaper && typeof patch.wallpaper === 'object' && !Array.isArray(patch.wallpaper)) {
    next.wallpaper = { ...current.wallpaper, ...patch.wallpaper };
  }
  if (patch.notifications && typeof patch.notifications === 'object' && !Array.isArray(patch.notifications)) {
    next.notifications = { ...current.notifications, ...patch.notifications };
    for (const key of ['telegram', 'email', 'rules']) {
      const value = patch.notifications[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        next.notifications[key] = { ...current.notifications[key], ...value };
      }
    }
    const channels = patch.notifications.rules?.channels;
    if (channels && typeof channels === 'object' && !Array.isArray(channels)) {
      next.notifications.rules.channels = { ...current.notifications.rules.channels, ...channels };
    }
  }
  return next;
};
