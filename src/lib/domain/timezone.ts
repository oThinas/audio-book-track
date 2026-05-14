import { endOfWeek, startOfWeek } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export const APP_TIMEZONE = "America/Sao_Paulo" as const;

const ISO_DATE = "yyyy-MM-dd";

const WEEK_OPTIONS = { weekStartsOn: 1 as const };

export function todayInAppTimezone(now: () => Date = () => new Date()): string {
  return formatInTimeZone(now(), APP_TIMEZONE, ISO_DATE);
}

export function currentWeekRangeInAppTimezone(now: () => Date = () => new Date()): {
  readonly mondayIso: string;
  readonly sundayIso: string;
} {
  const zoned = toZonedTime(now(), APP_TIMEZONE);
  const monday = startOfWeek(zoned, WEEK_OPTIONS);
  const sunday = endOfWeek(zoned, WEEK_OPTIONS);
  return {
    mondayIso: formatInTimeZone(monday, APP_TIMEZONE, ISO_DATE),
    sundayIso: formatInTimeZone(sunday, APP_TIMEZONE, ISO_DATE),
  };
}
