export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const RAIL_LANE_COUNT = 3;
const SAME_LANE_MIN_DAY_GAP = 3;
const DAY_MS = 86_400_000;

export const getZonedRailDateTimeParts = (
  timestamp: number,
  timeZone: string,
): ZonedDateTimeParts => {
  const date = new Date(timestamp);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      hour: Number(values.hour) % 24,
      minute: Number(values.minute),
      second: Number(values.second),
    };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
  }
};

export const getDaysInRailMonth = (timestamp: number, timeZone: string): number => {
  const { year, month } = getZonedRailDateTimeParts(timestamp, timeZone);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

export const railPositionForDay = (day: number, daysInMonth: number): number => {
  if (daysInMonth <= 0) return 0;
  return Math.min(100, Math.max(0, ((day - 1) / daysInMonth) * 100));
};

export const railPositionForInstant = (timestamp: number, timeZone: string): number => {
  const parts = getZonedRailDateTimeParts(timestamp, timeZone);
  const daysInMonth = getDaysInRailMonth(timestamp, timeZone);
  const elapsedToday = (
    parts.hour * 3_600_000
    + parts.minute * 60_000
    + parts.second * 1_000
    + new Date(timestamp).getMilliseconds()
  ) / DAY_MS;
  return Math.min(100, Math.max(0, ((parts.day - 1 + elapsedToday) / daysInMonth) * 100));
};

export const assignRailLanes = (days: number[]): number[] => {
  const lastDayByLane = Array.from({ length: RAIL_LANE_COUNT }, () => -Infinity);
  return days.map((day) => {
    const availableLane = lastDayByLane.findIndex(
      (lastDay) => day - lastDay >= SAME_LANE_MIN_DAY_GAP,
    );
    const lane = availableLane >= 0 ? availableLane : 0;
    lastDayByLane[lane] = day;
    return lane;
  });
};
