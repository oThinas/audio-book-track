"use client";

import { type ChapterRowData, ChaptersTable } from "@/components/features/chapters/chapters-table";
import type { BookStatus } from "@/lib/domain/book";

import { BookHeader } from "./book-header";

export interface BookDetailData {
  readonly id: string;
  readonly title: string;
  readonly studio: { readonly id: string; readonly name: string };
  readonly pricePerHourCents: number;
  readonly pdfUrl: string | null;
  readonly status: BookStatus;
  readonly totalChapters: number;
  readonly completedChapters: number;
  readonly totalEarningsCents: number;
  readonly chapters: ReadonlyArray<ChapterRowData>;
}

interface BookDetailClientProps {
  readonly book: BookDetailData;
}

export function BookDetailClient({ book }: BookDetailClientProps) {
  return (
    <>
      <BookHeader
        title={book.title}
        studio={book.studio}
        pricePerHourCents={book.pricePerHourCents}
        status={book.status}
        totalChapters={book.totalChapters}
        completedChapters={book.completedChapters}
        totalEarningsCents={book.totalEarningsCents}
      />
      <ChaptersTable chapters={book.chapters} />
    </>
  );
}
