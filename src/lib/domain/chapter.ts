import type { BookStatus } from "./book";

export type ChapterStatus = BookStatus;

export interface Chapter {
  readonly id: string;
  readonly bookId: string;
  readonly title: string;
  readonly position: number;
  readonly status: ChapterStatus;
  readonly narratorId: string | null;
  readonly editorId: string | null;
  readonly editedSeconds: number;
  readonly deadline: string | null;
  readonly completedAt: Date | null;
  readonly paidAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const PAID_LOCKED_FIELDS = [
  "narratorId",
  "editorId",
  "editedSeconds",
  "deadline",
  "title",
  "completedAt",
  "paidAt",
] as const;
export type PaidLockedField = (typeof PAID_LOCKED_FIELDS)[number];

const CHAPTER_STATUS_LABELS: Record<ChapterStatus, string> = {
  pending: "Pendente",
  editing: "Em edição",
  reviewing: "Em revisão",
  retake: "Retake",
  completed: "Concluído",
  paid: "Pago",
};

export function chapterStatusLabel(status: ChapterStatus): string {
  return CHAPTER_STATUS_LABELS[status];
}
