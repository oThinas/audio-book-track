// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildStudio, buildStudioListItem } from "@tests/helpers/seed-objects";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStudiosList } from "@/components/features/studios/hooks/use-studios-list";

describe("useStudiosList", () => {
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
    const { result } = renderHook(() => useStudiosList([]));

    expect(result.current.studios).toEqual([]);
    expect(result.current.sortedStudios).toEqual([]);
    expect(result.current.isCreating).toBe(false);
    expect(result.current.studioToDelete).toBeNull();
    expect(result.current.isDeleteDialogOpen).toBe(false);
  });

  it("sorts sortedStudios by createdAt desc", () => {
    const older = buildStudioListItem({
      id: "old",
      name: "Older",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
    });
    const newer = buildStudioListItem({
      id: "new",
      name: "Newer",
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
    });

    const { result } = renderHook(() => useStudiosList([older, newer]));

    expect(result.current.sortedStudios.map((s) => s.id)).toEqual(["new", "old"]);
  });

  describe("handleNewClick", () => {
    it("turns on creation mode when inactive", () => {
      const { result } = renderHook(() => useStudiosList([]));

      act(() => {
        result.current.handleNewClick();
      });

      expect(result.current.isCreating).toBe(true);
    });

    it("focuses the new-row input when creation mode is already active", () => {
      const focusSpy = vi.fn();
      const fakeInput = document.createElement("input");
      fakeInput.id = "studio-new-name";
      fakeInput.focus = focusSpy;
      document.body.appendChild(fakeInput);

      const { result } = renderHook(() => useStudiosList([]));

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

  it("handleCreated inserts with booksCount=0, exits creation mode and refreshes", () => {
    const { result } = renderHook(() => useStudiosList([]));

    act(() => {
      result.current.handleNewClick();
    });
    expect(result.current.isCreating).toBe(true);

    const created = buildStudio({ id: "new", name: "Brand New" });
    act(() => {
      result.current.handleCreated(created);
    });

    expect(result.current.isCreating).toBe(false);
    expect(result.current.studios).toHaveLength(1);
    expect(result.current.studios[0]).toMatchObject({
      id: "new",
      name: "Brand New",
      booksCount: 0,
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("handleCancelled exits creation mode", () => {
    const { result } = renderHook(() => useStudiosList([]));

    act(() => {
      result.current.handleNewClick();
    });
    act(() => {
      result.current.handleCancelled();
    });

    expect(result.current.isCreating).toBe(false);
  });

  it("handleUpdated preserves the existing booksCount", () => {
    const initial = buildStudioListItem({ id: "s-1", name: "Old Name", booksCount: 5 });
    const { result } = renderHook(() => useStudiosList([initial]));

    const updated = buildStudio({ id: "s-1", name: "New Name" });
    act(() => {
      result.current.handleUpdated(updated);
    });

    expect(result.current.studios).toHaveLength(1);
    expect(result.current.studios[0]).toMatchObject({
      id: "s-1",
      name: "New Name",
      booksCount: 5,
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("handleRequestDelete opens the dialog with the target studio", () => {
    const { result } = renderHook(() => useStudiosList([]));

    const target = buildStudio({ id: "s-1" });
    act(() => {
      result.current.handleRequestDelete(target);
    });

    expect(result.current.studioToDelete).toEqual(target);
    expect(result.current.isDeleteDialogOpen).toBe(true);
  });

  describe("handleDeleteDialogChange", () => {
    it("clears studioToDelete when called with false", () => {
      const { result } = renderHook(() => useStudiosList([]));

      const target = buildStudio({ id: "s-1" });
      act(() => {
        result.current.handleRequestDelete(target);
      });
      act(() => {
        result.current.handleDeleteDialogChange(false);
      });

      expect(result.current.studioToDelete).toBeNull();
      expect(result.current.isDeleteDialogOpen).toBe(false);
    });

    it("is a no-op when called with true (does not change studioToDelete)", () => {
      const { result } = renderHook(() => useStudiosList([]));

      const target = buildStudio({ id: "s-1" });
      act(() => {
        result.current.handleRequestDelete(target);
      });
      act(() => {
        result.current.handleDeleteDialogChange(true);
      });

      expect(result.current.studioToDelete).toEqual(target);
    });
  });

  it("handleDeleted removes the studio from state and refreshes", () => {
    const a = buildStudioListItem({ id: "a" });
    const b = buildStudioListItem({ id: "b" });
    const { result } = renderHook(() => useStudiosList([a, b]));

    act(() => {
      result.current.handleDeleted("a");
    });

    expect(result.current.studios.map((s) => s.id)).toEqual(["b"]);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
