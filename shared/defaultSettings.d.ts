import type { StoredSettings } from '../types';
export function createDefaultSettings(): StoredSettings;
export function normalizeExchangeRates(
  incoming: unknown,
  fallback?: Record<string, number>
): Record<string, number>;
