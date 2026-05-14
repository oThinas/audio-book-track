import type { Chapter, ChapterStatus } from "./chapter";

const ACTIVE_STATUSES: ReadonlySet<ChapterStatus> = new Set<ChapterStatus>([
  "pending",
  "editing",
  "reviewing",
  "retake",
]);

export interface FocusWeekContext {
  readonly todayIso: string;
  readonly mondayIso: string;
  readonly sundayIso: string;
}

export function isOverdue(chapter: Chapter, ctx: FocusWeekContext): boolean {
  if (chapter.deadline === null) return false;
  if (!ACTIVE_STATUSES.has(chapter.status)) return false;
  return chapter.deadline < ctx.todayIso;
}

export function isInFocusWeek(chapter: Chapter, ctx: FocusWeekContext): boolean {
  if (chapter.deadline === null) return false;
  if (!ACTIVE_STATUSES.has(chapter.status)) return false;
  if (chapter.deadline < ctx.todayIso) return true;
  return chapter.deadline >= ctx.mondayIso && chapter.deadline <= ctx.sundayIso;
}
