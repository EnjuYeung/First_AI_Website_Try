import type { ClientPreferences, EditableSettingsPatch, RemoteSettings, ServerSettingsState } from '../types';
export const EDITABLE_SETTINGS_KEYS: readonly string[];
export const CLIENT_PREFERENCE_KEYS: readonly string[];
export const SERVER_SETTINGS_KEYS: readonly string[];
export function pickEditableSettings(value: object): EditableSettingsPatch;
export function pickClientPreferences(value: object): Partial<ClientPreferences>;
export function publicServerSettings(value: unknown): ServerSettingsState;
export function publicRemoteSettings(value: unknown): RemoteSettings;
export function applyEditableSettings<T extends RemoteSettings>(current: T, patch: EditableSettingsPatch): T;
