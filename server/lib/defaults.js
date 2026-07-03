import { createDefaultSettings } from '../../shared/defaultSettings.js';

export const defaultSettings = createDefaultSettings;

export const defaultUserData = () => ({
  subscriptions: [],
  settings: defaultSettings(),
  notifications: [],
});
