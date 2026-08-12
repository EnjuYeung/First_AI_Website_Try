export const DEFAULT_RULE_CHANNELS = {
  renewalReminder: ['telegram', 'email'],
  monthlySummary: ['telegram', 'email'],
};

const VALID_NOTIFICATION_CHANNELS = new Set(['telegram', 'email']);

const cleanNotificationChannels = (value) => {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.filter((channel) => VALID_NOTIFICATION_CHANNELS.has(channel)))];
};

export const normalizeRuleChannels = (incoming, fallback = DEFAULT_RULE_CHANNELS) => {
  const fallbackRenewal = cleanNotificationChannels(fallback?.renewalReminder)
    || DEFAULT_RULE_CHANNELS.renewalReminder;
  const fallbackMonthly = cleanNotificationChannels(fallback?.monthlySummary)
    || DEFAULT_RULE_CHANNELS.monthlySummary;

  // Older installations stored one shared channel array before notification
  // rules gained independent delivery selections.
  if (Array.isArray(incoming)) {
    const shared = cleanNotificationChannels(incoming) || [];
    return { renewalReminder: [...shared], monthlySummary: [...shared] };
  }

  const source = incoming && typeof incoming === 'object' ? incoming : {};
  return {
    renewalReminder: cleanNotificationChannels(source.renewalReminder) || [...fallbackRenewal],
    monthlySummary: cleanNotificationChannels(source.monthlySummary) || [...fallbackMonthly],
  };
};

export const DEFAULT_CATEGORIES = [
  'Entertainment',
  'Software',
  'Utilities',
  'Lifestyle',
  'Education',
  'AI',
  'Cloud Services',
  'Reading',
  'Streaming',
  'Productivity',
  'Insurance',
  'Other',
];

export const DEFAULT_PAYMENT_METHODS = [
  'Credit Card',
  'Debit Card',
  'Apple Pay',
  'Google Pay',
  'WeChat Pay',
  'Alipay',
  'Crypto',
  'PayPal',
  'Other',
];
