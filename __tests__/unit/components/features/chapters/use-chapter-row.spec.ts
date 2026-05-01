// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useChapterRow } from "@/components/features/chapters/hooks/use-chapter-row";

describe("useChapterRow", () => {
  it("starts in view mode", () => {
    const { result } = renderHook(() => useChapterRow({ isSelectionMode: false }));
    expect(result.current.mode).toBe("view");
  });

  it("enterEditMode/exitEditMode toggles mode", () => {
    const { result } = renderHook(() => useChapterRow({ isSelectionMode: false }));

    act(() => result.current.enterEditMode());
    expect(result.current.mode).toBe("edit");

    act(() => result.current.exitEditMode());
    expect(result.current.mode).toBe("view");
  });

  it("forces view mode when isSelectionMode flips to true", () => {
    const { result, rerender } = renderHook(
      ({ isSelectionMode }: { isSelectionMode: boolean }) => useChapterRow({ isSelectionMode }),
      { initialProps: { isSelectionMode: false } },
    );

    act(() => result.current.enterEditMode());
    expect(result.current.mode).toBe("edit");

    rerender({ isSelectionMode: true });
    expect(result.current.mode).toBe("view");
  });
});
