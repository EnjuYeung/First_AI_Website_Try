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

export function advanceOverdueNextBillingDateYMD(
  nextYmd: string,
  frequency: BillingFrequency,
  anchorYmd: string,
  todayYmd: string
): string;

export function rollForwardActiveSubscriptions<T extends {
  status?: string;
  nextBillingDate?: string;
  frequency?: string;
  startDate?: string;
}>(subscriptions: T[], todayYmd: string): T[];
