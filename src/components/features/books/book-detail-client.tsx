"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ChaptersBulkDeleteBar } from "@/components/features/chapters/chapters-bulk-delete-bar";
import { ChaptersBulkDeleteConfirm } from "@/components/features/chapters/chapters-bulk-delete-confirm";
import { type ChapterRowData, ChaptersTable } from "@/components/features/chapters/chapters-table";
import type { BookStatus } from "@/lib/domain/book";
import { computeBookStatus } from "@/lib/domain/book-status";
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
  const router = useRouter();
  const [state, setState] = useState<DetailState>({
    status: book.status,
    chapters: book.chapters,
  });
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const nonPaidChapters = state.chapters.filter((c) => c.status !== "paid");
  const paidCount = state.chapters.length - nonPaidChapters.length;
  const willDeleteBook =
    selectedIds.size === nonPaidChapters.length && nonPaidChapters.length > 0 && paidCount === 0;

  function handleChapterSaved(updated: ChapterRowData, bookStatus: ChapterStatus) {
    setState((prev) => ({
      status: bookStatus,
      chapters: prev.chapters.map((chapter) => (chapter.id === updated.id ? updated : chapter)),
    }));
  }

  function handleChapterDeleted(chapterId: string, bookDeleted: boolean) {
    if (bookDeleted) {
      router.push("/books");
      return;
    }
    setState((prev) => {
      const remaining = prev.chapters.filter((chapter) => chapter.id !== chapterId);
      return {
        status: remaining.length === 0 ? prev.status : computeBookStatus(remaining),
        chapters: remaining,
      };
    });
  }

  function exitSelectionMode() {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }

  function handleToggleSelected(chapterId: string, selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(chapterId);
      else next.delete(chapterId);
      return next;
    });
  }

  function handleToggleSelectAll(selected: boolean) {
    setSelectedIds(selected ? new Set(nonPaidChapters.map((c) => c.id)) : new Set());
  }

  async function handleBulkDeleteConfirm() {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const response = await fetch(`/api/v1/books/${book.id}/chapters/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterIds: Array.from(selectedIds) }),
      });
      if (response.status !== 204) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(body?.error?.message ?? "Erro ao excluir capítulos.");
        return;
      }
      const bookDeleted = response.headers.get("X-Book-Deleted") === "true";
      if (bookDeleted) {
        router.push("/books");
        return;
      }
      setState((prev) => {
        const remaining = prev.chapters.filter((c) => !selectedIds.has(c.id));
        return {
          status: remaining.length === 0 ? prev.status : computeBookStatus(remaining),
          chapters: remaining,
        };
      });
      setConfirmOpen(false);
      exitSelectionMode();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro de rede ao excluir capítulos.");
    } finally {
      setBulkDeleting(false);
    }
  }

  const aggregates = recomputeAggregates(state.chapters, book.pricePerHourCents);

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
        title={book.title}
        studio={book.studio}
        pricePerHourCents={book.pricePerHourCents}
        status={state.status}
        totalChapters={aggregates.totalChapters}
        completedChapters={aggregates.completedChapters}
        totalEarningsCents={aggregates.totalEarningsCents}
        hasNonPaidChapters={nonPaidChapters.length > 0}
        isSelectionMode={isSelectionMode}
        onEnterSelectionMode={() => setIsSelectionMode(true)}
      />
      <ChaptersTable
        chapters={state.chapters}
        narrators={narrators}
        editors={editors}
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
    </>
  );
}
