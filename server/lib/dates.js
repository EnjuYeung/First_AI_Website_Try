const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseLocalYMD = (value) => {
  const match = YMD_RE.exec(String(value || '').trim());
  if (!match) return new Date(NaN);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const formatLocalYMD = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ymdToEpochDay = (value) => {
  const match = YMD_RE.exec(String(value || '').trim());
  if (!match) return NaN;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return NaN;
  }
  return Math.floor(timestamp / (1000 * 60 * 60 * 24));
};

export const daysUntilDate = (dateString, timeZone, now = new Date()) => {
  if (!dateString) return Infinity;
  const today = timeZone ? formatDateInTimeZone(timeZone, now) : formatLocalYMD(now);
  const targetDay = ymdToEpochDay(dateString);
  const todayDay = ymdToEpochDay(today);
  if (!Number.isFinite(targetDay) || !Number.isFinite(todayDay)) return NaN;
  return targetDay - todayDay;
};

export const formatDateInTimeZone = (timeZone, date = new Date()) => {
  if (!timeZone) return formatLocalYMD(date);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

export const getTimePartsInTimeZone = (timeZone, date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { hour: Number(map.hour), minute: Number(map.minute) };
};
