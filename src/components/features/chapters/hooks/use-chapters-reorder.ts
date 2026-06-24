"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api/api-fetch";

import type { ChapterRowEntity } from "../chapter-row";

export interface UseChaptersReorderArgs<T extends ChapterRowEntity> {
  readonly bookId: string;
  readonly chapters: ReadonlyArray<T>;
  readonly chaptersVersion: number;
  readonly onVersionChange?: (newVersion: number) => void;
  readonly onConflict?: () => void;
}

export interface UseChaptersReorderReturn<T extends ChapterRowEntity> {
  readonly orderedChapters: ReadonlyArray<T>;
  readonly chaptersVersion: number;
  readonly apply: (
    newOrderedIds: ReadonlyArray<string>,
    options?: { readonly animate?: boolean },
  ) => Promise<void>;
  readonly moveBy: (chapterId: string, delta: number) => Promise<void>;
  readonly isSaving: boolean;
}

function reorderArray<T extends { id: string }>(
  items: ReadonlyArray<T>,
  orderedIds: ReadonlyArray<string>,
): T[] {
  const byId = new Map(items.map((c) => [c.id, c]));
  const result: T[] = [];
  for (const id of orderedIds) {
    const c = byId.get(id);
    if (c) result.push(c);
  }
  return result;
}

export function useChaptersReorder<T extends ChapterRowEntity>({
  bookId,
  chapters,
  chaptersVersion,
  onVersionChange,
  onConflict,
}: UseChaptersReorderArgs<T>): UseChaptersReorderReturn<T> {
  const [orderedChapters, setOrderedChapters] = useState<ReadonlyArray<T>>(chapters);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(isSaving);
  isSavingRef.current = isSaving;

  // Sync with the parent-provided chapters when a non-reorder mutation
  // (create/delete/bulk-delete) changes the set. We skip syncing while a
  // reorder is in-flight to preserve the optimistic update.
  useEffect(() => {
    if (isSavingRef.current) return;
    setOrderedChapters(chapters);
  }, [chapters]);

  const apply = useCallback(
    async (
      newOrderedIds: ReadonlyArray<string>,
      options?: { readonly animate?: boolean },
    ): Promise<void> => {
      const previous = orderedChapters;
      const optimistic = reorderArray(previous, newOrderedIds);
      // The ↑/↓ buttons morph each row to its new position via the per-row
      // <ViewTransition> inside a startTransition (US5). The page content
      // boundary stays visually still because it's the viewport-sized scroll
      // container (layout-client), so its crossfade is between near-identical
      // snapshots — no book-title flash. Drag-and-drop keeps dnd-kit's own drop
      // animation, so it opts out of the view transition with an urgent update.
      if (options?.animate ?? true) {
        startTransition(() => {
          setOrderedChapters(optimistic);
        });
      } else {
        setOrderedChapters(optimistic);
      }
      setIsSaving(true);

      const result = await apiFetch<{ data: { chaptersVersion: number } }>(
        `/api/v1/books/${bookId}/chapters/order`,
        {
          method: "PUT",
          body: { orderedIds: [...newOrderedIds], expectedVersion: chaptersVersion },
        },
      );

      setIsSaving(false);

      if (!result.ok) {
        // Rollback is urgent feedback that the reorder failed — restore the
        // previous order immediately, not deferred inside a transition.
        setOrderedChapters(previous);
        if (
          result.kind === "api-error" &&
          result.code === "BOOK_CHAPTERS_VERSION_CONFLICT" &&
          onConflict
        ) {
          onConflict();
        }
        return;
      }

      onVersionChange?.(result.data.data.chaptersVersion);
    },
    [bookId, chaptersVersion, onConflict, onVersionChange, orderedChapters],
  );

  const moveBy = useCallback(
    async (chapterId: string, delta: number): Promise<void> => {
      const currentIds = orderedChapters.map((c) => c.id);
      const index = currentIds.indexOf(chapterId);
      if (index < 0) return;
      const target = index + delta;
      if (target < 0 || target >= currentIds.length) return;
      const next = [...currentIds];
      const [removed] = next.splice(index, 1);
      next.splice(target, 0, removed);
      await apply(next);
    },
    [apply, orderedChapters],
  );

  return { orderedChapters, chaptersVersion, apply, moveBy, isSaving };
}
