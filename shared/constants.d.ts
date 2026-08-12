export const DEFAULT_RULE_CHANNELS: {
  renewalReminder: Array<'telegram' | 'email'>;
  monthlySummary: Array<'telegram' | 'email'>;
};
export function normalizeRuleChannels(
  incoming: unknown,
  fallback?: Partial<{
    renewalReminder: Array<'telegram' | 'email'>;
    monthlySummary: Array<'telegram' | 'email'>;
  }>,
): {
  renewalReminder: Array<'telegram' | 'email'>;
  monthlySummary: Array<'telegram' | 'email'>;
};
export const DEFAULT_CATEGORIES: string[];
export const DEFAULT_PAYMENT_METHODS: string[];
