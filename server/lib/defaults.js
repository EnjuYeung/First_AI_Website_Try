export { createDefaultSettings as defaultSettings } from '../../shared/defaultSettings.js';

export const defaultUserData = () => ({
  subscriptions: [],
  settings: defaultSettings(),
  notifications: [],
});
