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

export const getTodayLocalYMD = (): string => formatLocalYMD(new Date());

