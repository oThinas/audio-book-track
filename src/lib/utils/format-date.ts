import { differenceInCalendarDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { format as formatTz } from "date-fns-tz";

import type { FocusWeekContext } from "@/lib/domain/chapter-deadline";

export function formatDeadline(iso: string): string {
  const date = parseISO(iso);
  return formatTz(date, "dd/MM/yyyy", { locale: ptBR });
}

export function formatRelativeDeadline(iso: string, ctx: FocusWeekContext): string {
  const deadline = parseISO(iso);
  const today = parseISO(ctx.todayIso);
  const diff = differenceInCalendarDays(deadline, today);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  if (diff > 0) return `em ${diff} dias`;
  return `atrasado há ${Math.abs(diff)} dias`;
}
