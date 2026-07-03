import type { AppSettings } from '../types';
export function createDefaultSettings(): AppSettings;
export function normalizeExchangeRates(
  incoming: unknown,
  fallback?: Record<string, number>
): Record<string, number>;
