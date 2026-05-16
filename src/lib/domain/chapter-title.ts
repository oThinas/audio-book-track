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

/**
 * Lowercased + trimmed form used to compare chapter titles for uniqueness
 * inside a book. Matches the convention used for `book.title` (where the
 * DB UNIQUE index is on `lower(title)`).
 */
export function chapterTitleKey(raw: string): string {
  return normalizeChapterTitle(raw).toLowerCase();
}

/**
 * Returns the first title in `titles` that collides (case-insensitively,
 * after trim) with another entry. Returns `null` when all titles are unique.
 * Stable: yields the first colliding occurrence so error messages can quote
 * a user-visible string.
 */
export function findDuplicateChapterTitle(titles: ReadonlyArray<string>): string | null {
  const seen = new Set<string>();
  for (const t of titles) {
    const key = chapterTitleKey(t);
    if (seen.has(key)) return t;
    seen.add(key);
  }
  return null;
}
