const FREQUENCY_MONTHS = {
  Monthly: 1,
  Quarterly: 3,
  'Semi-Annually': 6,
  Yearly: 12,
};

const parseYmdParts = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
};

const daysInMonth = (year, month) => {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
};

const formatYmdParts = ({ year, month, day }) =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const addBillingCycleYMD = (currentYmd, frequency, anchorYmd = currentYmd) => {
  const current = parseYmdParts(currentYmd);
  const anchor = parseYmdParts(anchorYmd);
  const months = FREQUENCY_MONTHS[frequency];
  if (!current || !anchor || !months) return '';

  const targetMonthIndex = current.year * 12 + (current.month - 1) + months;
  const year = Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12 + 1;
  const day = Math.min(anchor.day, daysInMonth(year, month));
  return formatYmdParts({ year, month, day });
};

export const calculateNextBillingDateYMD = (startYmd, frequency, todayYmd) => {
  if (!parseYmdParts(startYmd) || !parseYmdParts(todayYmd) || !FREQUENCY_MONTHS[frequency]) {
    return '';
  }
  if (startYmd > todayYmd) return startYmd;

  let next = startYmd;
  for (let iteration = 0; iteration < 12000 && next <= todayYmd; iteration += 1) {
    const advanced = addBillingCycleYMD(next, frequency, startYmd);
    if (!advanced || advanced <= next) return '';
    next = advanced;
  }
  return next > todayYmd ? next : '';
};

export const advanceOverdueNextBillingDateYMD = (nextYmd, frequency, anchorYmd, todayYmd) => {
  if (!parseYmdParts(nextYmd) || !parseYmdParts(todayYmd) || !FREQUENCY_MONTHS[frequency]) {
    return nextYmd || '';
  }
  if (nextYmd >= todayYmd) return nextYmd;

  const anchor = parseYmdParts(anchorYmd) ? anchorYmd : nextYmd;
  let next = nextYmd;
  for (let iteration = 0; iteration < 12000 && next < todayYmd; iteration += 1) {
    const advanced = addBillingCycleYMD(next, frequency, anchor);
    if (!advanced || advanced <= next) return next;
    next = advanced;
  }
  return next;
};

export const rollForwardActiveSubscriptions = (subscriptions, todayYmd) => {
  if (!Array.isArray(subscriptions)) return [];
  let changed = false;
  const next = subscriptions.map((sub) => {
    if (!sub || typeof sub !== 'object' || sub.status !== 'active' || !sub.nextBillingDate) {
      return sub;
    }
    const rolledDate = advanceOverdueNextBillingDateYMD(
      sub.nextBillingDate,
      sub.frequency,
      sub.startDate,
      todayYmd,
    );
    if (!rolledDate || rolledDate === sub.nextBillingDate) return sub;
    changed = true;
    return { ...sub, nextBillingDate: rolledDate };
  });
  return changed ? next : subscriptions;
};
