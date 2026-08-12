const DEFAULT_MONTHLY_SUMMARY_TEMPLATE = {
  lines: [
    '📊 {{month}} 月度总结',
    '',
    '💵 本月支出：{{totalPaidUsd}}',
    '✅ 有效订阅：{{activeSubscriptions}} 个',
    '🆕 新增订阅：{{newSubscriptions}}',
    '⛔ 取消订阅：{{cancelledSubscriptions}} 个',
  ],
};

export const DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING = JSON.stringify(
  DEFAULT_MONTHLY_SUMMARY_TEMPLATE,
  null,
  2,
);

export const normalizeMonthlySummaryTemplateString = (templateString) => {
  try {
    const parsed = JSON.parse(templateString || '');
    if (!Array.isArray(parsed?.lines) || parsed.lines.length === 0) {
      return DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING;
    }
    return JSON.stringify({ lines: parsed.lines }, null, 2);
  } catch {
    return DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING;
  }
};

export const renderMonthlySummaryTemplate = (templateString, summary) => {
  let parsed;
  try {
    parsed = JSON.parse(templateString || '');
  } catch {
    parsed = DEFAULT_MONTHLY_SUMMARY_TEMPLATE;
  }
  const lines = Array.isArray(parsed?.lines)
    ? parsed.lines
    : DEFAULT_MONTHLY_SUMMARY_TEMPLATE.lines;
  const values = {
    month: summary?.month || '',
    totalPaidUsd: summary?.totalPaidUsd > 0 ? `$${summary.totalPaidUsd.toFixed(2)}` : '',
    activeSubscriptions: summary?.activeSubscriptions > 0
      ? String(summary.activeSubscriptions)
      : '',
    newSubscriptions: summary?.newSubscriptions || '',
    cancelledSubscriptions: summary?.cancelledSubscriptions > 0
      ? String(summary.cancelledSubscriptions)
      : '',
  };

  return lines.flatMap((line) => {
    if (typeof line !== 'string') return [];
    const tokens = [...line.matchAll(/{{\s*([a-zA-Z]+)\s*}}/g)].map((match) => match[1]);
    if (tokens.some((token) => token in values && !values[token])) return [];
    const rendered = line.replace(/{{\s*([a-zA-Z]+)\s*}}/g, (_match, token) => (
      token in values ? values[token] : ''
    ));
    return rendered ? [rendered] : [];
  }).join('\n');
};
