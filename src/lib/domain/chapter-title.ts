export const CHAPTER_TITLE_MAX = 100;

export function normalizeChapterTitle(raw: string): string {
  return raw.trim();
}

export type ChapterTitleValidationFailure = "empty" | "too_long" | "has_newline";

export type ChapterTitleValidationResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: ChapterTitleValidationFailure };

export function validateChapterTitle(raw: string): ChapterTitleValidationResult {
  if (/[\n\r]/.test(raw)) {
    return { ok: false, reason: "has_newline" };
  }
  const trimmed = normalizeChapterTitle(raw);
  if (trimmed.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (trimmed.length > CHAPTER_TITLE_MAX) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, value: trimmed };
}
