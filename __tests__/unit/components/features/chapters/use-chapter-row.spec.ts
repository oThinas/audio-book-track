// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChapterRow } from "@/components/features/chapters/hooks/use-chapter-row";

describe("useChapterRow", () => {
  it("starts in view mode with no field to activate", () => {
    const { result } = renderHook(() => useChapterRow({ isSelectionMode: false }));
    expect(result.current.mode).toBe("view");
    expect(result.current.activateField).toBeNull();
  });

  it("enterEditMode/exitEditMode toggles mode", () => {
    const { result } = renderHook(() => useChapterRow({ isSelectionMode: false }));

    act(() => result.current.enterEditMode());
    expect(result.current.mode).toBe("edit");

    act(() => result.current.exitEditMode());
    expect(result.current.mode).toBe("view");
  });

  it("enterEditMode(field) records the field to activate", () => {
    const { result } = renderHook(() => useChapterRow({ isSelectionMode: false }));

    act(() => result.current.enterEditMode("status"));
    expect(result.current.mode).toBe("edit");
    expect(result.current.activateField).toBe("status");
  });

  it("enterEditMode() without a field (pencil) leaves activateField null", () => {
    const { result } = renderHook(() => useChapterRow({ isSelectionMode: false }));

    act(() => result.current.enterEditMode());
    expect(result.current.mode).toBe("edit");
    expect(result.current.activateField).toBeNull();
  });

  it("exitEditMode clears activateField", () => {
    const { result } = renderHook(() => useChapterRow({ isSelectionMode: false }));

    act(() => result.current.enterEditMode("deadline"));
    expect(result.current.activateField).toBe("deadline");

    act(() => result.current.exitEditMode());
    expect(result.current.mode).toBe("view");
    expect(result.current.activateField).toBeNull();
  });

  it("forces view mode and clears activateField when isSelectionMode flips to true", () => {
    const { result, rerender } = renderHook(
      ({ isSelectionMode }: { isSelectionMode: boolean }) => useChapterRow({ isSelectionMode }),
      { initialProps: { isSelectionMode: false } },
    );

    act(() => result.current.enterEditMode("narrator"));
    expect(result.current.mode).toBe("edit");
    expect(result.current.activateField).toBe("narrator");

    rerender({ isSelectionMode: true });
    expect(result.current.mode).toBe("view");
    expect(result.current.activateField).toBeNull();
  });

  describe("getEditTriggerProps", () => {
    it("onDoubleClick enters edit mode targeting the given field", () => {
      const { result } = renderHook(() => useChapterRow({ isSelectionMode: false }));

      act(() => result.current.getEditTriggerProps("editor").onDoubleClick());
      expect(result.current.mode).toBe("edit");
      expect(result.current.activateField).toBe("editor");
    });

    it("onMouseDown suppresses native selection only on a double-click (detail > 1)", () => {
      const { result } = renderHook(() => useChapterRow({ isSelectionMode: false }));
      const props = result.current.getEditTriggerProps("title");

      const singleClick = { detail: 1, preventDefault: vi.fn() };
      props.onMouseDown(singleClick as unknown as React.MouseEvent);
      expect(singleClick.preventDefault).not.toHaveBeenCalled();

      const doubleClick = { detail: 2, preventDefault: vi.fn() };
      props.onMouseDown(doubleClick as unknown as React.MouseEvent);
      expect(doubleClick.preventDefault).toHaveBeenCalledTimes(1);
    });
  });
});
