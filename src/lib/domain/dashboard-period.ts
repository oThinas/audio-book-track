import {
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "date-fns";

export const PERIOD_PRESETS = [
  "today",
  "this-week",
  "this-month",
  "this-quarter",
  "this-year",
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export type PeriodPresetOrCustom = PeriodPreset | "custom";

export interface DateRangeIso {
  readonly fromIso: string;
  readonly toIso: string;
  readonly preset: PeriodPresetOrCustom;
}

const ISO_DATE = "yyyy-MM-dd";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const WEEK_OPTIONS = { weekStartsOn: 1 as const };

function parseLocal(iso: string): Date | null {
  if (!ISO_DATE_RE.test(iso)) return null;
  const date = parseISO(iso);
  return isValid(date) ? date : null;
}

export function getPresetRange(preset: PeriodPreset, todayIso: string): DateRangeIso {
  const today = parseISO(todayIso);
  if (!isValid(today)) {
    throw new Error(`Invalid todayIso: ${todayIso}`);
  }

  switch (preset) {
    case "today":
      return { fromIso: todayIso, toIso: todayIso, preset };
    case "this-week":
      return {
        fromIso: format(startOfWeek(today, WEEK_OPTIONS), ISO_DATE),
        toIso: format(endOfWeek(today, WEEK_OPTIONS), ISO_DATE),
        preset,
      };
    case "this-month":
      return {
        fromIso: format(startOfMonth(today), ISO_DATE),
        toIso: format(endOfMonth(today), ISO_DATE),
        preset,
      };
    case "this-quarter":
      return {
        fromIso: format(startOfQuarter(today), ISO_DATE),
        toIso: format(endOfQuarter(today), ISO_DATE),
        preset,
      };
    case "this-year":
      return {
        fromIso: format(startOfYear(today), ISO_DATE),
        toIso: format(endOfYear(today), ISO_DATE),
        preset,
      };
  }
}

function isPreset(value: string | null): value is PeriodPreset {
  return value !== null && (PERIOD_PRESETS as readonly string[]).includes(value);
}

export function parsePeriodSearchParams(params: URLSearchParams, todayIso: string): DateRangeIso {
  const presetParam = params.get("preset");
  if (isPreset(presetParam)) {
    return getPresetRange(presetParam, todayIso);
  }

  const fromParam = params.get("from");
  const toParam = params.get("to");
  if (fromParam !== null && toParam !== null) {
    const from = parseLocal(fromParam);
    const to = parseLocal(toParam);
    if (from && to && fromParam <= toParam) {
      return { fromIso: fromParam, toIso: toParam, preset: "custom" };
    }
  }

  return getPresetRange("this-month", todayIso);
}
