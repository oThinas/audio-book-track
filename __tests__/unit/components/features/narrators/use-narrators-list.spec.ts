// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { buildNarrator, buildNarratorListItem } from "@tests/helpers/seed-objects";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNarratorsList } from "@/components/features/narrators/hooks/use-narrators-list";

describe("useNarratorsList", () => {
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
    const { result } = renderHook(() => useNarratorsList([]));

    expect(result.current.narrators).toEqual([]);
    expect(result.current.sortedNarrators).toEqual([]);
    expect(result.current.isCreating).toBe(false);
    expect(result.current.narratorToDelete).toBeNull();
    expect(result.current.isDeleteDialogOpen).toBe(false);
  });

  it("sorts sortedNarrators by createdAt desc", () => {
    const older = buildNarratorListItem({
      id: "old",
      name: "Older",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
    });
    const newer = buildNarratorListItem({
      id: "new",
      name: "Newer",
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
    });

    const { result } = renderHook(() => useNarratorsList([older, newer]));

    expect(result.current.sortedNarrators.map((n) => n.id)).toEqual(["new", "old"]);
  });

  describe("handleNewClick", () => {
    it("turns on creation mode when inactive", () => {
      const { result } = renderHook(() => useNarratorsList([]));

      act(() => {
        result.current.handleNewClick();
      });

      expect(result.current.isCreating).toBe(true);
    });

    it("focuses the new-row input when creation mode is already active", () => {
      const focusSpy = vi.fn();
      const fakeInput = document.createElement("input");
      fakeInput.id = "narrator-new-name";
      fakeInput.focus = focusSpy;
      document.body.appendChild(fakeInput);

      const { result } = renderHook(() => useNarratorsList([]));

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
    const { result } = renderHook(() => useNarratorsList([]));

    act(() => {
      result.current.handleNewClick();
    });
    expect(result.current.isCreating).toBe(true);

    const created = buildNarrator({ id: "new", name: "Brand New" });
    act(() => {
      result.current.handleCreated(created);
    });

    expect(result.current.isCreating).toBe(false);
    expect(result.current.narrators).toHaveLength(1);
    expect(result.current.narrators[0]).toMatchObject({
      id: "new",
      name: "Brand New",
      chaptersCount: 0,
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("handleCancelled exits creation mode", () => {
    const { result } = renderHook(() => useNarratorsList([]));

    act(() => {
      result.current.handleNewClick();
    });
    act(() => {
      result.current.handleCancelled();
    });

    expect(result.current.isCreating).toBe(false);
  });

  it("handleUpdated preserves the existing chaptersCount", () => {
    const initial = buildNarratorListItem({ id: "n-1", name: "Old Name", chaptersCount: 5 });
    const { result } = renderHook(() => useNarratorsList([initial]));

    const updated = buildNarrator({ id: "n-1", name: "New Name" });
    act(() => {
      result.current.handleUpdated(updated);
    });

    expect(result.current.narrators).toHaveLength(1);
    expect(result.current.narrators[0]).toMatchObject({
      id: "n-1",
      name: "New Name",
      chaptersCount: 5,
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("handleRequestDelete opens the dialog with the target narrator", () => {
    const { result } = renderHook(() => useNarratorsList([]));

    const target = buildNarrator({ id: "n-1" });
    act(() => {
      result.current.handleRequestDelete(target);
    });

    expect(result.current.narratorToDelete).toEqual(target);
    expect(result.current.isDeleteDialogOpen).toBe(true);
  });

  describe("handleDeleteDialogChange", () => {
    it("clears narratorToDelete when called with false", () => {
      const { result } = renderHook(() => useNarratorsList([]));

      const target = buildNarrator({ id: "n-1" });
      act(() => {
        result.current.handleRequestDelete(target);
      });
      act(() => {
        result.current.handleDeleteDialogChange(false);
      });

      expect(result.current.narratorToDelete).toBeNull();
      expect(result.current.isDeleteDialogOpen).toBe(false);
    });

    it("is a no-op when called with true (does not change narratorToDelete)", () => {
      const { result } = renderHook(() => useNarratorsList([]));

      const target = buildNarrator({ id: "n-1" });
      act(() => {
        result.current.handleRequestDelete(target);
      });
      act(() => {
        result.current.handleDeleteDialogChange(true);
      });

      expect(result.current.narratorToDelete).toEqual(target);
    });
  });

  it("handleDeleted removes the narrator from state and refreshes", () => {
    const a = buildNarratorListItem({ id: "a" });
    const b = buildNarratorListItem({ id: "b" });
    const { result } = renderHook(() => useNarratorsList([a, b]));

    act(() => {
      result.current.handleDeleted("a");
    });

    expect(result.current.narrators.map((n) => n.id)).toEqual(["b"]);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
