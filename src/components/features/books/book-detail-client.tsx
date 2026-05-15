"use client";

import { lazy, Suspense } from "react";

import { ChapterFocusWeekToggle } from "@/components/features/chapters/chapter-focus-week-toggle";
import { ChapterGroupingControl } from "@/components/features/chapters/chapter-grouping-control";
import { ChaptersBulkDeleteBar } from "@/components/features/chapters/chapters-bulk-delete-bar";
import { ChaptersBulkDeleteConfirm } from "@/components/features/chapters/chapters-bulk-delete-confirm";
import { type ChapterRowData, ChaptersTable } from "@/components/features/chapters/chapters-table";
import { useChaptersGroupingState } from "@/components/features/chapters/hooks/use-chapters-grouping-state";
import { useFocusWeekFilter } from "@/components/features/chapters/hooks/use-focus-week-filter";
import type { BookStatus } from "@/lib/domain/book";
import type { Studio } from "@/lib/domain/studio";

import { BookDialogSkeleton } from "./book-dialog-skeleton";
import { BookHeader } from "./book-header";
import { useBookDetail } from "./hooks/use-book-detail";

const BookEditDialog = lazy(() =>
  import("./book-edit-dialog").then((mod) => ({ default: mod.BookEditDialog })),
);

export interface BookDetailData {
  readonly id: string;
  readonly title: string;
  readonly studio: { readonly id: string; readonly name: string };
  readonly pricePerHourCents: number;
  readonly chaptersVersion: number;
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
  readonly studios: ReadonlyArray<Studio>;
}

export function BookDetailClient({ book, narrators, editors, studios }: BookDetailClientProps) {
  const {
    state,
    nonPaidChapters,
    paidCount,
    willDeleteBook,
    aggregates,
    isSelectionMode,
    selectedIds,
    confirmOpen,
    setConfirmOpen,
    bulkDeleting,
    editOpen,
    setEditOpen,
    handleChapterSaved,
    applyBookUpdate,
    handleChapterDeleted,
    handlePdfUrlChange,
    exitSelectionMode,
    enterSelectionMode,
    handleToggleSelected,
    handleToggleSelectAll,
    handleBulkDeleteConfirm,
  } = useBookDetail(book);
  const { grouping, setGrouping } = useChaptersGroupingState();
  const { enabled: focusEnabled, toggle: toggleFocus } = useFocusWeekFilter();

  return (
    <>
      {isSelectionMode && (
        <ChaptersBulkDeleteBar
          selectedCount={selectedIds.size}
          onCancel={exitSelectionMode}
          onConfirm={() => setConfirmOpen(true)}
        />
      )}
      <BookHeader
        bookId={book.id}
        title={book.title}
        studio={book.studio}
        pricePerHourCents={book.pricePerHourCents}
        pdfUrl={state.pdfUrl}
        onPdfUrlChange={handlePdfUrlChange}
        status={state.status}
        totalChapters={aggregates.totalChapters}
        completedChapters={aggregates.completedChapters}
        totalEarningsCents={aggregates.totalEarningsCents}
        hasNonPaidChapters={nonPaidChapters.length > 0}
        isSelectionMode={isSelectionMode}
        onEnterSelectionMode={enterSelectionMode}
        onEdit={() => setEditOpen(true)}
      />
      {!isSelectionMode && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <ChapterFocusWeekToggle enabled={focusEnabled} onToggle={toggleFocus} />
          <ChapterGroupingControl grouping={grouping} onGroupingChange={setGrouping} />
        </div>
      )}
      <ChaptersTable
        bookId={book.id}
        chaptersVersion={book.chaptersVersion}
        chapters={state.chapters}
        narrators={narrators}
        editors={editors}
        grouping={grouping}
        pricePerHourCents={book.pricePerHourCents}
        isSelectionMode={isSelectionMode}
        selectedIds={selectedIds}
        onChapterSaved={handleChapterSaved}
        onChapterDeleted={handleChapterDeleted}
        onToggleSelected={handleToggleSelected}
        onToggleSelectAll={handleToggleSelectAll}
      />
      <ChaptersBulkDeleteConfirm
        open={confirmOpen}
        count={selectedIds.size}
        hasPaid={paidCount > 0}
        willDeleteBook={willDeleteBook}
        onCancel={() => {
          if (!bulkDeleting) setConfirmOpen(false);
        }}
        onConfirm={handleBulkDeleteConfirm}
      />
      {editOpen && (
        <Suspense fallback={<BookDialogSkeleton open onOpenChange={setEditOpen} />}>
          <BookEditDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            book={{
              id: book.id,
              title: book.title,
              studioId: book.studio.id,
              pricePerHourCents: book.pricePerHourCents,
              currentChapters: state.chapters.length,
              hasPaidChapter: paidCount > 0,
            }}
            studios={studios}
            onUpdated={applyBookUpdate}
          />
        </Suspense>
      )}
    </>
  );
}
