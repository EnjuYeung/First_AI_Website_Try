const TOKEN_REPLACERS = {
  name: (sub) => sub?.name ?? '未填写',
  nextBillingDate: (sub) => sub?.nextBillingDate ?? '未填写',
  price: (sub) => sub?.price ?? '',
  currency: (sub) => sub?.currency ?? '',
  paymentMethod: (sub) => sub?.paymentMethod ?? '未填写',
};

const DEFAULT_REMINDER_TEMPLATE = {
  lines: [
    '🔔 续订提醒通知',
    '',
    '📌 订阅 {{name}} 即将续费',
    '',
    '📅 付款日期：{{nextBillingDate}}',
    '',
    '🔒 订阅金额：{{price}} {{currency}}',
    '💳 支付方式：{{paymentMethod}}',
    '',
    '⚠️ 请及时续订以避免服务中断。',
  ],
};

export const DEFAULT_REMINDER_TEMPLATE_STRING = JSON.stringify(
  DEFAULT_REMINDER_TEMPLATE,
  null,
  2
);

export const normalizeReminderTemplateString = (templateString) => {
  try {
    const parsed = JSON.parse(templateString || '');
    if (!parsed?.lines || !Array.isArray(parsed.lines) || parsed.lines.length === 0) {
      return DEFAULT_REMINDER_TEMPLATE_STRING;
    }
    return JSON.stringify({ lines: parsed.lines }, null, 2);
  } catch {
    return DEFAULT_REMINDER_TEMPLATE_STRING;
  }
};

export const renderReminderTemplate = (templateString, subscription) => {
  let parsed;
  try {
    parsed = JSON.parse(templateString || '');
  } catch {
    parsed = DEFAULT_REMINDER_TEMPLATE;
  }
  const lines = Array.isArray(parsed?.lines) ? parsed.lines : DEFAULT_REMINDER_TEMPLATE.lines;

  const replaceLine = (line) => {
    if (typeof line !== 'string') return '';
    return line.replace(/{{\s*([a-zA-Z]+)\s*}}/g, (_m, key) => {
      const fn = TOKEN_REPLACERS[key];
      if (!fn) return '';
      const value = fn(subscription);
      return String(value ?? '');
    });
  };

  return lines.map(replaceLine).filter(Boolean).join('\n');
};
