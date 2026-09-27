/** Rates are currency units per USD. null means the amount cannot be converted. */
export const convertToUSD = (amount, currency, rates) => {
  if (!Number.isFinite(amount) || amount < 0) return null;
  const code = String(currency || 'USD').toUpperCase();
  if (code === 'USD') return amount;
  const rate = rates?.[code];
  return Number.isFinite(rate) && rate > 0 ? amount / rate : null;
};
