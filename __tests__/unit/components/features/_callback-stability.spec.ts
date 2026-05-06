// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { buildEditor, buildNarrator, buildStudio } from "@tests/helpers/seed";
import { describe, expect, it } from "vitest";

import { useBookDetail } from "@/components/features/books/hooks/use-book-detail";
import { useEditorRow } from "@/components/features/editors/hooks/use-editor-row";
import { useEditorsList } from "@/components/features/editors/hooks/use-editors-list";
import { useNarratorRow } from "@/components/features/narrators/hooks/use-narrator-row";
import { useNarratorsList } from "@/components/features/narrators/hooks/use-narrators-list";
import { useStudioRow } from "@/components/features/studios/hooks/use-studio-row";
import { useStudiosList } from "@/components/features/studios/hooks/use-studios-list";

/**
 * Guards `React.memo` on row components from silently regressing.
 *
 * `useStudioRow`, `useNarratorRow`, `useEditorRow` and the four list hooks
 * pass callbacks down to memoized rows. If any callback identity changes
 * across a parent re-render with the same inputs, every row re-renders
 * defeating memoization. These tests rerender each hook with the same
 * args and assert the public callbacks keep the same reference.
 */

describe("Callback identity stability across re-renders (T139)", () => {
  describe("useStudiosList", () => {
    it("preserves callback identity when rerendered with the same initial list", () => {
      const initial = [{ ...buildStudio({ id: "s-1" }), booksCount: 0 }] as const;
      const { result, rerender } = renderHook(
        ({ list }: { list: typeof initial }) => useStudiosList(list),
        { initialProps: { list: initial } },
      );
      const before = {
        handleNewClick: result.current.handleNewClick,
        handleCreated: result.current.handleCreated,
        handleCancelled: result.current.handleCancelled,
        handleUpdated: result.current.handleUpdated,
        handleRequestDelete: result.current.handleRequestDelete,
        handleDeleteDialogChange: result.current.handleDeleteDialogChange,
        handleDeleted: result.current.handleDeleted,
      };
      rerender({ list: initial });
      expect(result.current.handleNewClick).toBe(before.handleNewClick);
      expect(result.current.handleCreated).toBe(before.handleCreated);
      expect(result.current.handleCancelled).toBe(before.handleCancelled);
      expect(result.current.handleUpdated).toBe(before.handleUpdated);
      expect(result.current.handleRequestDelete).toBe(before.handleRequestDelete);
      expect(result.current.handleDeleteDialogChange).toBe(before.handleDeleteDialogChange);
      expect(result.current.handleDeleted).toBe(before.handleDeleted);
    });
  });

  describe("useNarratorsList", () => {
    it("preserves callback identity when rerendered with the same initial list", () => {
      const initial = [{ ...buildNarrator({ id: "n-1" }), chaptersCount: 0 }] as const;
      const { result, rerender } = renderHook(
        ({ list }: { list: typeof initial }) => useNarratorsList(list),
        { initialProps: { list: initial } },
      );
      const before = {
        handleCreated: result.current.handleCreated,
        handleUpdated: result.current.handleUpdated,
        handleRequestDelete: result.current.handleRequestDelete,
        handleDeleted: result.current.handleDeleted,
      };
      rerender({ list: initial });
      expect(result.current.handleCreated).toBe(before.handleCreated);
      expect(result.current.handleUpdated).toBe(before.handleUpdated);
      expect(result.current.handleRequestDelete).toBe(before.handleRequestDelete);
      expect(result.current.handleDeleted).toBe(before.handleDeleted);
    });
  });

  describe("useEditorsList", () => {
    it("preserves callback identity when rerendered with the same initial list", () => {
      const initial = [{ ...buildEditor({ id: "e-1" }), chaptersCount: 0 }] as const;
      const { result, rerender } = renderHook(
        ({ list }: { list: typeof initial }) => useEditorsList(list),
        { initialProps: { list: initial } },
      );
      const before = {
        handleCreated: result.current.handleCreated,
        handleUpdated: result.current.handleUpdated,
        handleRequestDelete: result.current.handleRequestDelete,
        handleDeleted: result.current.handleDeleted,
      };
      rerender({ list: initial });
      expect(result.current.handleCreated).toBe(before.handleCreated);
      expect(result.current.handleUpdated).toBe(before.handleUpdated);
      expect(result.current.handleRequestDelete).toBe(before.handleRequestDelete);
      expect(result.current.handleDeleted).toBe(before.handleDeleted);
    });
  });

  describe("useStudioRow", () => {
    it("preserves callback identity when rerendered with the same args", () => {
      const studio = { ...buildStudio({ id: "s-1" }), booksCount: 0 };
      const onUpdated = () => {};
      const onRequestDelete = () => {};
      const { result, rerender } = renderHook(() =>
        useStudioRow({ studio, onUpdated, onRequestDelete }),
      );
      const before = {
        handleStartEdit: result.current.handleStartEdit,
        handleCancelEdit: result.current.handleCancelEdit,
        handleEditCompleted: result.current.handleEditCompleted,
        handleRequestDelete: result.current.handleRequestDelete,
      };
      rerender();
      expect(result.current.handleStartEdit).toBe(before.handleStartEdit);
      expect(result.current.handleCancelEdit).toBe(before.handleCancelEdit);
      expect(result.current.handleEditCompleted).toBe(before.handleEditCompleted);
      expect(result.current.handleRequestDelete).toBe(before.handleRequestDelete);
    });
  });

  describe("useNarratorRow", () => {
    it("preserves callback identity when rerendered with the same args", () => {
      const narrator = { ...buildNarrator({ id: "n-1" }), chaptersCount: 0 };
      const onUpdated = () => {};
      const onRequestDelete = () => {};
      const { result, rerender } = renderHook(() =>
        useNarratorRow({ narrator, onUpdated, onRequestDelete }),
      );
      const before = {
        handleStartEdit: result.current.handleStartEdit,
        handleCancelEdit: result.current.handleCancelEdit,
        handleEditCompleted: result.current.handleEditCompleted,
        handleRequestDelete: result.current.handleRequestDelete,
      };
      rerender();
      expect(result.current.handleStartEdit).toBe(before.handleStartEdit);
      expect(result.current.handleCancelEdit).toBe(before.handleCancelEdit);
      expect(result.current.handleEditCompleted).toBe(before.handleEditCompleted);
      expect(result.current.handleRequestDelete).toBe(before.handleRequestDelete);
    });
  });

  describe("useEditorRow", () => {
    it("preserves callback identity when rerendered with the same args", () => {
      const editor = { ...buildEditor({ id: "e-1" }), chaptersCount: 0 };
      const onUpdated = () => {};
      const onRequestDelete = () => {};
      const { result, rerender } = renderHook(() =>
        useEditorRow({ editor, onUpdated, onRequestDelete }),
      );
      const before = {
        handleStartEdit: result.current.handleStartEdit,
        handleCancelEdit: result.current.handleCancelEdit,
        handleEditCompleted: result.current.handleEditCompleted,
        handleRequestDelete: result.current.handleRequestDelete,
      };
      rerender();
      expect(result.current.handleStartEdit).toBe(before.handleStartEdit);
      expect(result.current.handleCancelEdit).toBe(before.handleCancelEdit);
      expect(result.current.handleEditCompleted).toBe(before.handleEditCompleted);
      expect(result.current.handleRequestDelete).toBe(before.handleRequestDelete);
    });
  });

  describe("useBookDetail", () => {
    it("preserves callback identity when rerendered with the same book", () => {
      const book = {
        id: "b-1",
        title: "Livro",
        status: "pending" as const,
        pricePerHourCents: 7500,
        pdfUrl: null,
        chapters: [],
        studio: { id: "s-1", name: "Sonora" },
      };
      const { result, rerender } = renderHook(
        ({ data }: { data: typeof book }) => useBookDetail(data),
        { initialProps: { data: book } },
      );
      const before = {
        handleChapterSaved: result.current.handleChapterSaved,
        applyBookUpdate: result.current.applyBookUpdate,
        handleChapterDeleted: result.current.handleChapterDeleted,
        handlePdfUrlChange: result.current.handlePdfUrlChange,
        exitSelectionMode: result.current.exitSelectionMode,
        enterSelectionMode: result.current.enterSelectionMode,
        handleToggleSelected: result.current.handleToggleSelected,
        handleBulkDeleteConfirm: result.current.handleBulkDeleteConfirm,
      };
      rerender({ data: book });
      expect(result.current.handleChapterSaved).toBe(before.handleChapterSaved);
      expect(result.current.applyBookUpdate).toBe(before.applyBookUpdate);
      expect(result.current.handleChapterDeleted).toBe(before.handleChapterDeleted);
      expect(result.current.handlePdfUrlChange).toBe(before.handlePdfUrlChange);
      expect(result.current.exitSelectionMode).toBe(before.exitSelectionMode);
      expect(result.current.enterSelectionMode).toBe(before.enterSelectionMode);
      expect(result.current.handleToggleSelected).toBe(before.handleToggleSelected);
      expect(result.current.handleBulkDeleteConfirm).toBe(before.handleBulkDeleteConfirm);
    });
  });
});
