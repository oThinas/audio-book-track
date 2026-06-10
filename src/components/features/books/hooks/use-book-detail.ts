"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ChapterRowData } from "@/components/features/chapters/chapters-table";
import type { ChapterCreatedResult } from "@/components/features/chapters/hooks/use-add-chapter";
import { apiFetch } from "@/lib/api/api-fetch";
import type { BookStatus } from "@/lib/domain/book";
import { computeBookStatus } from "@/lib/domain/book-status";
import type { ChapterStatus } from "@/lib/domain/chapter";
import { computeEarningsCents } from "@/lib/domain/earnings";
import { densifyPositions } from "@/lib/domain/normalize-positions";
import type { BookDetailData } from "../book-detail-client";
import type { UpdatedBookDetail } from "../book-edit-dialog";

const COMPLETED_STATUSES: ReadonlyArray<ChapterStatus> = ["completed", "paid"];

interface DetailState {
  readonly status: BookStatus;
  readonly chapters: ReadonlyArray<ChapterRowData>;
  readonly pdfUrl: string | null;
}

export interface UseBookDetailReturn {
  readonly state: DetailState;
  readonly chaptersVersion: number;
  readonly nonPaidChapters: ReadonlyArray<ChapterRowData>;
  readonly paidCount: number;
  readonly willDeleteBook: boolean;
  readonly aggregates: {
    readonly totalChapters: number;
    readonly completedChapters: number;
    readonly totalEarningsCents: number;
  };
  readonly isSelectionMode: boolean;
  readonly setIsSelectionMode: (next: boolean) => void;
  readonly selectedIds: ReadonlySet<string>;
  readonly confirmOpen: boolean;
  readonly setConfirmOpen: (next: boolean) => void;
  readonly bulkDeleting: boolean;
  readonly editOpen: boolean;
  readonly setEditOpen: (next: boolean) => void;
  readonly handleChapterSaved: (updated: ChapterRowData, bookStatus: ChapterStatus) => void;
  readonly applyBookUpdate: (detail: UpdatedBookDetail) => void;
  readonly handleChapterDeleted: (chapterId: string, bookDeleted: boolean) => void;
  readonly handlePdfUrlChange: (next: string | null) => void;
  readonly exitSelectionMode: () => void;
  readonly enterSelectionMode: () => void;
  readonly handleToggleSelected: (chapterId: string, selected: boolean) => void;
  readonly handleToggleSelectAll: (selected: boolean) => void;
  readonly handleBulkDeleteConfirm: () => Promise<void>;
  readonly addChapterOpen: boolean;
  readonly setAddChapterOpen: (next: boolean) => void;
  readonly handleChapterCreated: (result: ChapterCreatedResult) => void;
  readonly handleChaptersVersionBump: (newVersion: number) => void;
  readonly handleChaptersConflict: () => Promise<void>;
}

function recomputeAggregates(
  chapters: ReadonlyArray<ChapterRowData>,
  pricePerHourCents: number,
): { totalChapters: number; completedChapters: number; totalEarningsCents: number } {
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

export function useBookDetail(book: BookDetailData): UseBookDetailReturn {
  const router = useRouter();
  const [state, setState] = useState<DetailState>({
    status: book.status,
    chapters: book.chapters,
    pdfUrl: book.pdfUrl,
  });
  const [chaptersVersion, setChaptersVersion] = useState<number>(book.chaptersVersion);

  // Re-sync local state whenever the server-rendered `book` prop changes
  // (e.g. after `router.refresh()` following create/edit). Without this the
  // useState initial value would freeze the first render's chapters and the
  // user would have to reload the page to see new chapters.
  useEffect(() => {
    setState({
      status: book.status,
      chapters: book.chapters,
      pdfUrl: book.pdfUrl,
    });
  }, [book.status, book.chapters, book.pdfUrl]);

  // Sync the lifted chaptersVersion when the server-rendered token changes.
  // This catches up edit/delete/bulk-delete (which bump on the server but
  // don't return the new token) once their `router.refresh()` completes.
  useEffect(() => {
    setChaptersVersion(book.chaptersVersion);
  }, [book.chaptersVersion]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addChapterOpen, setAddChapterOpen] = useState(false);

  const nonPaidChapters = state.chapters.filter((c) => c.status !== "paid");
  const paidCount = state.chapters.length - nonPaidChapters.length;
  const willDeleteBook =
    selectedIds.size === nonPaidChapters.length && nonPaidChapters.length > 0 && paidCount === 0;
  const aggregates = recomputeAggregates(state.chapters, book.pricePerHourCents);

  function handleChapterSaved(updated: ChapterRowData, bookStatus: ChapterStatus) {
    setState((prev) => ({
      ...prev,
      status: bookStatus,
      chapters: prev.chapters.map((chapter) => (chapter.id === updated.id ? updated : chapter)),
    }));
    // Edit bumps `book.chapters_version` on the server but the PATCH response
    // doesn't return it. Refetch so the sync effect picks up the new token.
    router.refresh();
  }

  function applyBookUpdate(detail: UpdatedBookDetail) {
    setState((prev) => ({
      ...prev,
      status: detail.status,
      chapters: detail.chapters.map((c) => ({
        id: c.id,
        title: c.title,
        position: c.position,
        status: c.status,
        narrator: c.narrator,
        editor: c.editor,
        editedSeconds: c.editedSeconds,
        deadline: c.deadline,
      })),
    }));
    router.refresh();
  }

  function handleChapterDeleted(chapterId: string, bookDeleted: boolean) {
    if (bookDeleted) {
      router.push("/books");
      return;
    }
    setState((prev) => {
      const remaining = prev.chapters.filter((chapter) => chapter.id !== chapterId);
      return {
        ...prev,
        status: remaining.length === 0 ? prev.status : computeBookStatus(remaining),
        chapters: remaining,
      };
    });
    // Delete bumps `book.chapters_version` on the server. The 204 response
    // can't carry it, so refresh and let the sync effect catch up.
    router.refresh();
  }

  function handlePdfUrlChange(next: string | null) {
    setState((prev) => ({ ...prev, pdfUrl: next }));
    router.refresh();
  }

  function handleChapterCreated(result: ChapterCreatedResult) {
    const { chapter, bookStatus, chaptersVersion } = result;
    setState((prev) => {
      const newRow: ChapterRowData = {
        id: chapter.id,
        title: chapter.title,
        position: chapter.position,
        status: chapter.status,
        narrator: null,
        editor: null,
        editedSeconds: 0,
        deadline: null,
      };
      const withNew = [...prev.chapters];
      const insertAt = Math.min(Math.max(chapter.position, 0), withNew.length);
      withNew.splice(insertAt, 0, newRow);
      const positionById = new Map(densifyPositions(withNew).map((p) => [p.id, p.position]));
      return {
        ...prev,
        status: bookStatus,
        chapters: withNew.map((c) => ({ ...c, position: positionById.get(c.id) ?? c.position })),
      };
    });
    setChaptersVersion(chaptersVersion);
    // Optimistic insert above already shows the new chapter; refresh is only a
    // background re-sync (it may hang under loading.tsx — #86151 — without harm).
    router.refresh();
  }

  function handleChaptersVersionBump(newVersion: number) {
    setChaptersVersion(newVersion);
  }

  // Re-sync the whole detail after a version conflict via a dedicated GET
  // instead of router.refresh() (which can hang under loading.tsx — #86151).
  async function handleChaptersConflict() {
    const result = await apiFetch<{ data: BookDetailData }>(`/api/v1/books/${book.id}`);
    if (!result.ok) return;
    const detail = result.data.data;
    setState({ status: detail.status, chapters: detail.chapters, pdfUrl: detail.pdfUrl });
    setChaptersVersion(detail.chaptersVersion);
  }

  function exitSelectionMode() {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }

  function enterSelectionMode() {
    setIsSelectionMode(true);
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
      const result = await apiFetch<null>(`/api/v1/books/${book.id}/chapters/bulk-delete`, {
        method: "POST",
        body: { chapterIds: Array.from(selectedIds) },
      });
      if (!result.ok) return;
      const bookDeleted = result.headers.get("X-Book-Deleted") === "true";
      if (bookDeleted) {
        router.push("/books");
        return;
      }
      setState((prev) => {
        const remaining = prev.chapters.filter((c) => !selectedIds.has(c.id));
        return {
          ...prev,
          status: remaining.length === 0 ? prev.status : computeBookStatus(remaining),
          chapters: remaining,
        };
      });
      setConfirmOpen(false);
      exitSelectionMode();
      // Re-sync the lifted token from the response header so the next mutation
      // sends the right expectedVersion even if the refresh below hangs.
      const version = result.headers.get("X-Chapters-Version");
      if (version !== null) setChaptersVersion(Number(version));
      // Background re-sync only (may hang under loading.tsx — #86151 — no harm).
      router.refresh();
    } finally {
      setBulkDeleting(false);
    }
  }

  return {
    state,
    chaptersVersion,
    nonPaidChapters,
    paidCount,
    willDeleteBook,
    aggregates,
    isSelectionMode,
    setIsSelectionMode,
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
    addChapterOpen,
    setAddChapterOpen,
    handleChapterCreated,
    handleChaptersVersionBump,
    handleChaptersConflict,
  };
}
