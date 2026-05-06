// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildEditor, buildEditorListItem } from "@tests/helpers/seed";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorsList } from "@/components/features/editors/hooks/use-editors-list";

describe("useEditorsList", () => {
  let refreshMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    refreshMock = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: refreshMock,
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    } as unknown as ReturnType<typeof useRouter>);
  });

  it("returns an empty state when initial is empty", () => {
    const { result } = renderHook(() => useEditorsList([]));

    expect(result.current.editors).toEqual([]);
    expect(result.current.sortedEditors).toEqual([]);
    expect(result.current.isCreating).toBe(false);
    expect(result.current.editorToDelete).toBeNull();
    expect(result.current.isDeleteDialogOpen).toBe(false);
  });

  it("sorts sortedEditors by createdAt desc", () => {
    const older = buildEditorListItem({
      id: "old",
      name: "Older",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
    });
    const newer = buildEditorListItem({
      id: "new",
      name: "Newer",
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
    });

    const { result } = renderHook(() => useEditorsList([older, newer]));

    expect(result.current.sortedEditors.map((e) => e.id)).toEqual(["new", "old"]);
  });

  describe("handleNewClick", () => {
    it("turns on creation mode when inactive", () => {
      const { result } = renderHook(() => useEditorsList([]));

      act(() => {
        result.current.handleNewClick();
      });

      expect(result.current.isCreating).toBe(true);
    });

    it("focuses the new-row input when creation mode is already active", () => {
      const focusSpy = vi.fn();
      const fakeInput = document.createElement("input");
      fakeInput.id = "editor-new-name";
      fakeInput.focus = focusSpy;
      document.body.appendChild(fakeInput);

      const { result } = renderHook(() => useEditorsList([]));

      act(() => {
        result.current.handleNewClick();
      });
      act(() => {
        result.current.handleNewClick();
      });

      expect(focusSpy).toHaveBeenCalledTimes(1);
      expect(result.current.isCreating).toBe(true);

      document.body.removeChild(fakeInput);
    });
  });

  it("handleCreated inserts with chaptersCount=0, exits creation mode and refreshes", () => {
    const { result } = renderHook(() => useEditorsList([]));

    act(() => {
      result.current.handleNewClick();
    });

    const created = buildEditor({ id: "new", name: "Brand New" });
    act(() => {
      result.current.handleCreated(created);
    });

    expect(result.current.isCreating).toBe(false);
    expect(result.current.editors).toHaveLength(1);
    expect(result.current.editors[0]).toMatchObject({
      id: "new",
      name: "Brand New",
      chaptersCount: 0,
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("handleCancelled exits creation mode", () => {
    const { result } = renderHook(() => useEditorsList([]));

    act(() => {
      result.current.handleNewClick();
    });
    act(() => {
      result.current.handleCancelled();
    });

    expect(result.current.isCreating).toBe(false);
  });

  it("handleUpdated preserves the existing chaptersCount", () => {
    const initial = buildEditorListItem({ id: "e-1", name: "Old Name", chaptersCount: 5 });
    const { result } = renderHook(() => useEditorsList([initial]));

    const updated = buildEditor({ id: "e-1", name: "New Name" });
    act(() => {
      result.current.handleUpdated(updated);
    });

    expect(result.current.editors).toHaveLength(1);
    expect(result.current.editors[0]).toMatchObject({
      id: "e-1",
      name: "New Name",
      chaptersCount: 5,
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("handleRequestDelete opens the dialog with the target editor", () => {
    const { result } = renderHook(() => useEditorsList([]));

    const target = buildEditor({ id: "e-1" });
    act(() => {
      result.current.handleRequestDelete(target);
    });

    expect(result.current.editorToDelete).toEqual(target);
    expect(result.current.isDeleteDialogOpen).toBe(true);
  });

  describe("handleDeleteDialogChange", () => {
    it("clears editorToDelete when called with false", () => {
      const { result } = renderHook(() => useEditorsList([]));

      const target = buildEditor({ id: "e-1" });
      act(() => {
        result.current.handleRequestDelete(target);
      });
      act(() => {
        result.current.handleDeleteDialogChange(false);
      });

      expect(result.current.editorToDelete).toBeNull();
      expect(result.current.isDeleteDialogOpen).toBe(false);
    });

    it("is a no-op when called with true", () => {
      const { result } = renderHook(() => useEditorsList([]));

      const target = buildEditor({ id: "e-1" });
      act(() => {
        result.current.handleRequestDelete(target);
      });
      act(() => {
        result.current.handleDeleteDialogChange(true);
      });

      expect(result.current.editorToDelete).toEqual(target);
    });
  });

  it("handleDeleted removes the editor from state and refreshes", () => {
    const a = buildEditorListItem({ id: "a" });
    const b = buildEditorListItem({ id: "b" });
    const { result } = renderHook(() => useEditorsList([a, b]));

    act(() => {
      result.current.handleDeleted("a");
    });

    expect(result.current.editors.map((e) => e.id)).toEqual(["b"]);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
