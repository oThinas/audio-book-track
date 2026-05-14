import { endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

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
  // Get today's calendar date in SP (independent of host TZ).
  const todayIso = formatInTimeZone(now(), APP_TIMEZONE, ISO_DATE);
  // Parse as local-naive midnight: getters return the SP calendar date on any
  // host. date-fns date arithmetic uses these local getters, so the result is
  // host-TZ-independent as long as we re-format with native `format` (which
  // also uses local getters) rather than `formatInTimeZone` (which would
  // shift the instant back through the SP offset and double-convert).
  const localToday = parseISO(todayIso);
  const monday = startOfWeek(localToday, WEEK_OPTIONS);
  const sunday = endOfWeek(localToday, WEEK_OPTIONS);
  return {
    mondayIso: format(monday, ISO_DATE),
    sundayIso: format(sunday, ISO_DATE),
  };
}
