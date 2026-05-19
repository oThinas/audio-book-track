import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import type { DateRangeIso } from "./dashboard-period";

export type Granularity = "day" | "week" | "month";

export interface BucketRange {
  readonly startIso: string;
  readonly endIso: string;
}

const ISO_DATE = "yyyy-MM-dd";
const WEEK_OPTIONS = { weekStartsOn: 1 as const };

export function inferGranularity(range: DateRangeIso): Granularity {
  const from = parseISO(range.fromIso);
  const to = parseISO(range.toIso);
  const diffDays = differenceInCalendarDays(to, from);
  if (diffDays <= 31) return "day";
  if (diffDays <= 180) return "week";
  return "month";
}

export function bucketDates(range: DateRangeIso, granularity: Granularity): BucketRange[] {
  const from = parseISO(range.fromIso);
  const to = parseISO(range.toIso);
  const buckets: BucketRange[] = [];

  if (granularity === "day") {
    let cursor = from;
    while (cursor <= to) {
      const iso = format(cursor, ISO_DATE);
      buckets.push({ startIso: iso, endIso: iso });
      cursor = addDays(cursor, 1);
    }
    return buckets;
  }

  if (granularity === "week") {
    let cursor = startOfWeek(from, WEEK_OPTIONS);
    while (cursor <= to) {
      const weekEnd = endOfWeek(cursor, WEEK_OPTIONS);
      buckets.push({
        startIso: format(cursor, ISO_DATE),
        endIso: format(weekEnd, ISO_DATE),
      });
      cursor = addWeeks(cursor, 1);
    }
    return buckets;
  }

  let cursor = startOfMonth(from);
  while (cursor <= to) {
    buckets.push({
      startIso: format(cursor, ISO_DATE),
      endIso: format(endOfMonth(cursor), ISO_DATE),
    });
    cursor = addMonths(cursor, 1);
  }
  return buckets;
}

export function formatBucketLabel(bucket: BucketRange, granularity: Granularity): string {
  const start = parseISO(bucket.startIso);
  if (granularity === "day") {
    return format(start, "dd/MM/yyyy", { locale: ptBR });
  }
  if (granularity === "month") {
    const monthLabel = format(start, "MMMM yyyy", { locale: ptBR });
    return monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  }
  const end = parseISO(bucket.endIso);
  const startDay = format(start, "dd", { locale: ptBR });
  const endLabel = format(end, "dd/MM/yyyy", { locale: ptBR });
  return `Semana de ${startDay}–${endLabel}`;
}
