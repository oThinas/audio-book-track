"use client";

import { useState } from "react";

import { type ChapterRowData, ChaptersTable } from "@/components/features/chapters/chapters-table";
import type { BookStatus } from "@/lib/domain/book";
import type { ChapterStatus } from "@/lib/domain/chapter";
import { computeEarningsCents } from "@/lib/domain/earnings";

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

export interface PersonOption {
  readonly id: string;
  readonly name: string;
}

interface BookDetailClientProps {
  readonly book: BookDetailData;
  readonly narrators: ReadonlyArray<PersonOption>;
  readonly editors: ReadonlyArray<PersonOption>;
}

const COMPLETED_STATUSES: ReadonlyArray<ChapterStatus> = ["completed", "paid"];

interface DetailState {
  readonly status: BookStatus;
  readonly chapters: ReadonlyArray<ChapterRowData>;
}

function recomputeAggregates(
  chapters: ReadonlyArray<ChapterRowData>,
  pricePerHourCents: number,
): {
  readonly totalChapters: number;
  readonly completedChapters: number;
  readonly totalEarningsCents: number;
} {
  let completedChapters = 0;
  let totalEarningsCents = 0;
  for (const chapter of chapters) {
    if (COMPLETED_STATUSES.includes(chapter.status)) completedChapters += 1;
    totalEarningsCents += computeEarningsCents(chapter.editedSeconds, pricePerHourCents);
  }
  return {
    totalChapters: chapters.length,
    completedChapters,
    totalEarningsCents,
  };
}

export function BookDetailClient({ book, narrators, editors }: BookDetailClientProps) {
  const [state, setState] = useState<DetailState>({
    status: book.status,
    chapters: book.chapters,
  });

  function handleChapterSaved(updated: ChapterRowData, bookStatus: ChapterStatus) {
    setState((prev) => ({
      status: bookStatus,
      chapters: prev.chapters.map((chapter) => (chapter.id === updated.id ? updated : chapter)),
    }));
  }

  const aggregates = recomputeAggregates(state.chapters, book.pricePerHourCents);

  return (
    <>
      <BookHeader
        title={book.title}
        studio={book.studio}
        pricePerHourCents={book.pricePerHourCents}
        status={state.status}
        totalChapters={aggregates.totalChapters}
        completedChapters={aggregates.completedChapters}
        totalEarningsCents={aggregates.totalEarningsCents}
      />
      <ChaptersTable
        chapters={state.chapters}
        narrators={narrators}
        editors={editors}
        onChapterSaved={handleChapterSaved}
      />
    </>
  );
}
