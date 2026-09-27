import { createDefaultSettings, normalizeExchangeRates } from './defaultSettings.js';
import { DEFAULT_RULE_CHANNELS, normalizeRuleChannels } from './constants.js';
import { DEFAULT_REMINDER_TEMPLATE_STRING, normalizeReminderTemplateString } from './reminderTemplate.js';
import { DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING, normalizeMonthlySummaryTemplateString } from './monthlySummaryTemplate.js';

const PREVIOUS_REMINDER_TEMPLATE_STRING = JSON.stringify(
  {
    lines: [
      '🔔 续订提醒通知',
      '',
      '📌 订阅 {{name}} 即将续费',
      '',
      '📅 付款日期：{{nextBillingDate}}',
      '🔒 订阅金额：{{price}} {{currency}}',
      '💳 支付方式：{{paymentMethod}}',
      '',
      '⚠️ 请及时续订以避免服务中断。',
    ],
  },
  null,
  2
);

export const normalizeSettings = (incoming, timeZone) => {
  const parsed = { ...(incoming || {}) };
  const base = createDefaultSettings();

  delete parsed.aiConfig;
  delete parsed.currencyApi;

  const exchangeRateApi = {
    ...base.exchangeRateApi,
    ...(parsed.exchangeRateApi || {}),
  };
  const exchangeRates = normalizeExchangeRates(parsed.exchangeRates, base.exchangeRates);

  const parsedRules = parsed.notifications?.rules || {};
  const parsedTemplate = parsedRules.template;
  const template =
    !parsedTemplate ||
    parsedTemplate === DEFAULT_REMINDER_TEMPLATE_STRING ||
    parsedTemplate === PREVIOUS_REMINDER_TEMPLATE_STRING
      ? DEFAULT_REMINDER_TEMPLATE_STRING
      : normalizeReminderTemplateString(parsedTemplate);
  const monthlySummaryTemplate = normalizeMonthlySummaryTemplateString(
    parsedRules.monthlySummaryTemplate || DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING,
  );

  const rules = {
    renewalReminder:
      parsedRules.renewalReminder !== undefined
        ? parsedRules.renewalReminder
        : base.notifications.rules.renewalReminder,
    monthlySummary:
      parsedRules.monthlySummary !== undefined
        ? parsedRules.monthlySummary
        : base.notifications.rules.monthlySummary,
    reminderDays: parsedRules.reminderDays ?? base.notifications.rules.reminderDays,
    template,
    monthlySummaryTemplate,
    channels: normalizeRuleChannels(parsedRules.channels, DEFAULT_RULE_CHANNELS),
  };

  return {
    ...base,
    ...parsed,
    timezone: timeZone || parsed.timezone || base.timezone,
    wallpaper: { ...base.wallpaper, ...(parsed.wallpaper || {}) },
    exchangeRateApi,
    exchangeRates,
    security: { ...base.security, ...(parsed.security || {}) },
    notifications: {
      telegram: {
        ...base.notifications.telegram,
        ...(parsed.notifications?.telegram || {}),
      },
      email: {
        ...base.notifications.email,
        ...(parsed.notifications?.email || {}),
      },
      rules,
    },
  };
};
