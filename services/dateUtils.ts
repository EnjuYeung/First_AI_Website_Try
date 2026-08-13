const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseLocalYMD = (ymd: string): Date => {
  const match = YMD_RE.exec(String(ymd || '').trim());
  if (!match) return new Date(NaN);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const formatLocalYMD = (date: Date): string => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatYMDInTimeZone = (date: Date, timeZone?: string): string => {
  if (!timeZone) return formatLocalYMD(date);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return formatLocalYMD(date);
  }
};

export const getTodayYMD = (timeZone?: string, now = new Date()): string =>
  formatYMDInTimeZone(now, timeZone);

const ymdEpochDay = (ymd: string): number => {
  const match = YMD_RE.exec(String(ymd || '').trim());
  if (!match) return NaN;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== Number(match[1]) ||
    parsed.getUTCMonth() !== Number(match[2]) - 1 ||
    parsed.getUTCDate() !== Number(match[3])
  ) return NaN;
  return Math.floor(timestamp / 86_400_000);
};

export const daysUntilYMD = (targetYmd: string, timeZone?: string, now = new Date()): number => {
  const target = ymdEpochDay(targetYmd);
  const today = ymdEpochDay(getTodayYMD(timeZone, now));
  return Number.isFinite(target) && Number.isFinite(today) ? target - today : Infinity;
};
