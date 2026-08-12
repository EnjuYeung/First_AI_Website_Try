export const DEFAULT_MONTHLY_SUMMARY_TEMPLATE_STRING: string;
export function normalizeMonthlySummaryTemplateString(templateString: string): string;
export function renderMonthlySummaryTemplate(
  templateString: string,
  summary: {
    month: string;
    totalPaidUsd: number;
    activeSubscriptions: number;
    newSubscriptions: string;
    cancelledSubscriptions: number;
  },
): string;
