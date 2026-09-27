import { validateSettings } from '../../shared/dataSchema.js';
import { normalizeRuleChannels } from '../../shared/constants.js';
import {
  EDITABLE_SETTINGS_KEYS, CLIENT_PREFERENCE_KEYS, SERVER_SETTINGS_KEYS,
  applyEditableSettings, pickClientPreferences, publicRemoteSettings, publicServerSettings,
} from '../../shared/settingsOwnership.js';

export const clientSettings = (settings, timeZone) => ({
  ...pickClientPreferences(settings),
  ...publicRemoteSettings(settings),
  ...(timeZone ? { timezone: timeZone } : {}),
});

export const settingsStateResult = data => ({
  settingsState: publicServerSettings(data.settings),
  revision: data.revisions?.settings,
});

/** Legacy full PUTs remain accepted, but ownership is enforced here once. */
export const applySettingsUpdate = (current, incoming, timeZone) => {
  const fail = message => { const error = new Error(message); error.statusCode = 400; throw error; };
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) fail('settings_must_be_object');
  const accepted = [...EDITABLE_SETTINGS_KEYS, ...CLIENT_PREFERENCE_KEYS, ...SERVER_SETTINGS_KEYS];
  if (Object.keys(incoming).some(key => !accepted.includes(key))) fail('unknown_settings_field');
  let patch = incoming;
  if (incoming.notifications && typeof incoming.notifications === 'object' && !Array.isArray(incoming.notifications)) {
    const { scheduledTask: _legacy, ...notifications } = incoming.notifications;
    patch = { ...incoming, notifications };
  }
  const next = applyEditableSettings(current, patch);
  next.timezone = timeZone;
  if (next.notifications?.rules) {
    next.notifications = { ...next.notifications, rules: {
      ...next.notifications.rules,
      channels: normalizeRuleChannels(next.notifications.rules.channels),
    } };
  }
  const error = validateSettings(next);
  if (error) fail(error);
  return next;
};
