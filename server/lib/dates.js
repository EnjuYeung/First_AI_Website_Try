const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseLocalYMD = (value) => {
  const match = YMD_RE.exec(String(value || '').trim());
  if (!match) return new Date(value);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const daysUntilDate = (dateString) => {
  if (!dateString) return Infinity;
  const toStartOfDay = (d) => {
    const clone = new Date(d);
    clone.setHours(0, 0, 0, 0);
    return clone;
  };

  const todayStart = toStartOfDay(new Date());
  const targetStart = toStartOfDay(parseLocalYMD(dateString));
  const diff = targetStart.getTime() - todayStart.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export const formatDateInTimeZone = (timeZone, date = new Date()) => {
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

