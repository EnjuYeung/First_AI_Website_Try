import type { ExchangeRates } from '../types';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CNY: '¥',
  EUR: '€',
  GBP: '£',
  HKD: 'HK$',
  JPY: '¥',
  SGD: 'S$',
  AUD: 'A$',
  CAD: 'C$',
};

const normalizeCode = (code: string) => (code || 'USD').toUpperCase();

export const convertToUSD = (
  amount: number,
  currency: string,
  rates: ExchangeRates | undefined
): number => {
  const value = Number.isFinite(amount) ? amount : 0;
  const normalizedCurrency = normalizeCode(currency);
  if (normalizedCurrency === 'USD') return value;

  const rate = rates?.[normalizedCurrency];
  return Number.isFinite(rate) && Number(rate) > 0 ? value / Number(rate) : value;
};

const getCurrencySymbol = (code: string) => {
  const normalized = normalizeCode(code);
  if (CURRENCY_SYMBOLS[normalized]) return CURRENCY_SYMBOLS[normalized];
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalized,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    const symbol = parts.find((part) => part.type === 'currency')?.value;
    return symbol || '¤';
  } catch {
    return '¤';
  }
};

export const formatCurrency = (
  amount: number,
  code: string,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
) => {
  const value = Number.isFinite(amount) ? amount : 0;
  const minimumFractionDigits = options?.minimumFractionDigits ?? 2;
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2;
  const symbol = getCurrencySymbol(code);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
  return `${symbol}${formatted}`;
};
