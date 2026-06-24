export const DEFAULT_REMINDER_TEMPLATE_STRING: string;
export function normalizeReminderTemplateString(templateString: string): string;
export function renderReminderTemplate(
  templateString: string,
  subscription: {
    name?: string;
    nextBillingDate?: string;
    price?: number | string;
    currency?: string;
    paymentMethod?: string;
  }
): string;
