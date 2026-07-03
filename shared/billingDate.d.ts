export type BillingFrequency = 'Monthly' | 'Quarterly' | 'Semi-Annually' | 'Yearly';

export function addBillingCycleYMD(
  currentYmd: string,
  frequency: BillingFrequency,
  anchorYmd?: string
): string;

export function calculateNextBillingDateYMD(
  startYmd: string,
  frequency: BillingFrequency,
  todayYmd: string
): string;
