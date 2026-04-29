export type BookStatus = "pending" | "editing" | "reviewing" | "retake" | "completed" | "paid";

export const BOOK_STATUS_VALUES: readonly BookStatus[] = [
  "pending",
  "editing",
  "reviewing",
  "retake",
  "completed",
  "paid",
] as const;

export interface Book {
  readonly id: string;
  readonly title: string;
  readonly studioId: string;
  readonly pricePerHourCents: number;
  readonly pdfUrl: string | null;
  readonly status: BookStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
