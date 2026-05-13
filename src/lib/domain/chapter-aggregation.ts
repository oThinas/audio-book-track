import type { GroupingDimension } from "@/lib/url/grouping-param";
import type { ChapterStatus } from "./chapter";
import { computeEarningsCents } from "./earnings";

const STATUS_ORDER: ReadonlyArray<ChapterStatus> = [
  "pending",
  "editing",
  "reviewing",
  "retake",
  "completed",
  "paid",
];

/**
 * Singular / plural per status. Used in breakdown ("3 concluídos · 1 em revisão").
 */
const STATUS_LABEL: Record<ChapterStatus, { readonly singular: string; readonly plural: string }> =
  {
    pending: { singular: "pendente", plural: "pendentes" },
    editing: { singular: "em edição", plural: "em edição" },
    reviewing: { singular: "em revisão", plural: "em revisão" },
    retake: { singular: "retake", plural: "retake" },
    completed: { singular: "concluído", plural: "concluídos" },
    paid: { singular: "pago", plural: "pagos" },
  };

export type StatusBreakdown = Readonly<Record<ChapterStatus, number>>;

interface ChapterLike {
  readonly editedSeconds: number;
  readonly status: ChapterStatus;
}

interface BookPriceLike {
  readonly pricePerHourCents: number;
}

/**
 * Computes earnings in cents for ONE chapter using the auditable domain formula
 * (Principle II). Conversion to BRL is the presentation layer's responsibility.
 */
export function computeChapterEarningsCents(
  chapter: { readonly editedSeconds: number },
  book: BookPriceLike,
): number {
  return computeEarningsCents(chapter.editedSeconds, book.pricePerHourCents);
}

/**
 * Sums earnings for a collection of chapters.
 *
 * **Important**: rounds PER chapter before summing — Principle II guarantees
 * that summing seconds first and then applying the formula would yield a total
 * different from the auditable total the user sees on each individual row.
 */
export function sumChapterEarningsCents(
  chapters: ReadonlyArray<{ readonly editedSeconds: number }>,
  book: BookPriceLike,
): number {
  return chapters.reduce((total, chapter) => total + computeChapterEarningsCents(chapter, book), 0);
}

/**
 * Sums edited duration for a collection of chapters. Chapters with
 * `editedSeconds = 0` contribute 0 but still count as members of the group
 * (caller's responsibility).
 */
export function sumEditedSeconds(chapters: ReadonlyArray<ChapterLike>): number {
  return chapters.reduce((total, chapter) => total + chapter.editedSeconds, 0);
}

/**
 * Counts chapters by status. Always returns the full record with every status
 * present (zeroed when absent) to simplify consumption.
 */
export function countByStatus(chapters: ReadonlyArray<ChapterLike>): StatusBreakdown {
  const counts: Record<ChapterStatus, number> = {
    pending: 0,
    editing: 0,
    reviewing: 0,
    retake: 0,
    completed: 0,
    paid: 0,
  };
  for (const chapter of chapters) {
    counts[chapter.status] += 1;
  }
  return counts;
}

/**
 * Formats the breakdown for display in the group summary row.
 *
 * - When `dimensionAtLevel === "status"`, the summary row already represents a
 *   specific status → show only the total count (avoids redundancy, FR-015).
 * - Otherwise, lists statuses with count > 0 in enum order, separated by ` · `
 *   (e.g. "1 em revisão · 3 concluídos"). Singular/plural per status.
 * - Empty list → empty string.
 */
export function formatStatusBreakdown(
  breakdown: StatusBreakdown,
  dimensionAtLevel: GroupingDimension | null,
): string {
  if (dimensionAtLevel === "status") {
    const total = STATUS_ORDER.reduce((acc, status) => acc + breakdown[status], 0);
    return `${total} ${total === 1 ? "capítulo" : "capítulos"}`;
  }

  const parts: string[] = [];
  for (const status of STATUS_ORDER) {
    const count = breakdown[status];
    if (count === 0) continue;
    const labels = STATUS_LABEL[status];
    parts.push(`${count} ${count === 1 ? labels.singular : labels.plural}`);
  }
  return parts.join(" · ");
}
